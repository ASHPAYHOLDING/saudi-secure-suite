
-- ============================================================
-- RECONCILIATION ENGINE
-- ============================================================

-- 1. reconciliation_runs
CREATE TABLE public.reconciliation_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  run_type        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'running',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  date_from       DATE,
  date_to         DATE,
  total_checked   INT NOT NULL DEFAULT 0,
  total_matched   INT NOT NULL DEFAULT 0,
  total_issues    INT NOT NULL DEFAULT 0,
  critical_count  INT NOT NULL DEFAULT 0,
  warning_count   INT NOT NULL DEFAULT 0,
  info_count      INT NOT NULL DEFAULT 0,
  summary         JSONB DEFAULT '{}'::jsonb,
  triggered_by    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view reconciliation_runs"
  ON public.reconciliation_runs FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members insert reconciliation_runs"
  ON public.reconciliation_runs FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- 2. reconciliation_issues
CREATE TABLE public.reconciliation_issues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  severity        TEXT NOT NULL DEFAULT 'warning',
  issue_type      TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  entity_label    TEXT,
  expected_value  NUMERIC,
  actual_value    NUMERIC,
  difference      NUMERIC,
  description     TEXT NOT NULL,
  description_en  TEXT,
  is_resolved     BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reconciliation_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view reconciliation_issues"
  ON public.reconciliation_issues FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members update reconciliation_issues"
  ON public.reconciliation_issues FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE INDEX idx_recon_issues_run ON public.reconciliation_issues(run_id);
CREATE INDEX idx_recon_issues_severity ON public.reconciliation_issues(tenant_id, severity, is_resolved);
CREATE INDEX idx_recon_runs_tenant ON public.reconciliation_runs(tenant_id, run_type, created_at DESC);

-- ============================================================
-- 3. RECONCILIATION FUNCTIONS (use tenant_members)
-- ============================================================

CREATE OR REPLACE FUNCTION public.reconcile_invoices_vs_payments(p_tenant_id UUID, p_date_from DATE DEFAULT NULL, p_date_to DATE DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run_id UUID; v_total INT := 0; v_matched INT := 0; v_critical INT := 0; v_warning INT := 0; v_info INT := 0; rec RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenant_members WHERE tenant_id = p_tenant_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO reconciliation_runs (tenant_id, run_type, date_from, date_to, triggered_by)
  VALUES (p_tenant_id, 'invoice_payments', p_date_from, p_date_to, auth.uid()) RETURNING id INTO v_run_id;

  FOR rec IN
    SELECT i.id, i.invoice_number, i.grand_total, i.amount_paid, i.amount_due,
      COALESCE(SUM(ip.amount), 0) AS payments_sum
    FROM invoices i LEFT JOIN invoice_payments ip ON ip.invoice_id = i.id AND ip.tenant_id = i.tenant_id
    WHERE i.tenant_id = p_tenant_id AND i.status NOT IN ('draft','cancelled','void')
      AND (p_date_from IS NULL OR i.invoice_date >= p_date_from)
      AND (p_date_to IS NULL OR i.invoice_date <= p_date_to)
    GROUP BY i.id, i.invoice_number, i.grand_total, i.amount_paid, i.amount_due
  LOOP
    v_total := v_total + 1;
    IF ABS(rec.amount_paid - rec.payments_sum) > 0.01 THEN
      INSERT INTO reconciliation_issues (run_id,tenant_id,severity,issue_type,entity_type,entity_id,entity_label,expected_value,actual_value,difference,description,description_en)
      VALUES (v_run_id,p_tenant_id,'critical','amount_mismatch','invoice',rec.id,rec.invoice_number,rec.payments_sum,rec.amount_paid,rec.amount_paid-rec.payments_sum,
        'مبلغ المدفوع في الفاتورة لا يطابق مجموع الدفعات المسجلة','Invoice amount_paid does not match sum of payment records');
      v_critical := v_critical + 1;
    ELSIF ABS(rec.amount_due - (rec.grand_total - rec.amount_paid)) > 0.01 THEN
      INSERT INTO reconciliation_issues (run_id,tenant_id,severity,issue_type,entity_type,entity_id,entity_label,expected_value,actual_value,difference,description,description_en)
      VALUES (v_run_id,p_tenant_id,'warning','amount_mismatch','invoice',rec.id,rec.invoice_number,rec.grand_total-rec.amount_paid,rec.amount_due,rec.amount_due-(rec.grand_total-rec.amount_paid),
        'المبلغ المستحق لا يتطابق مع (الإجمالي - المدفوع)','amount_due != grand_total - amount_paid');
      v_warning := v_warning + 1;
    ELSE
      v_matched := v_matched + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.source_id=rec.id AND je.source_type='invoice' AND je.tenant_id=p_tenant_id AND je.status='posted') THEN
      INSERT INTO reconciliation_issues (run_id,tenant_id,severity,issue_type,entity_type,entity_id,entity_label,expected_value,actual_value,difference,description,description_en)
      VALUES (v_run_id,p_tenant_id,'critical','missing_journal','invoice',rec.id,rec.invoice_number,rec.grand_total,0,rec.grand_total,
        'فاتورة معتمدة بدون قيد يومية','Approved invoice has no posted journal entry');
      v_critical := v_critical + 1;
    END IF;
  END LOOP;

  FOR rec IN
    SELECT ip.id, ip.amount, ip.invoice_id, ip.reference_number
    FROM invoice_payments ip LEFT JOIN invoices i ON i.id=ip.invoice_id AND i.tenant_id=ip.tenant_id
    WHERE ip.tenant_id=p_tenant_id AND i.id IS NULL
  LOOP
    INSERT INTO reconciliation_issues (run_id,tenant_id,severity,issue_type,entity_type,entity_id,entity_label,expected_value,actual_value,difference,description,description_en)
    VALUES (v_run_id,p_tenant_id,'critical','orphan_payment','payment',rec.id,rec.reference_number,0,rec.amount,rec.amount,
      'دفعة مسجلة لفاتورة غير موجودة','Payment references non-existent invoice');
    v_critical := v_critical + 1;
  END LOOP;

  UPDATE reconciliation_runs SET status='completed',completed_at=now(),total_checked=v_total,total_matched=v_matched,
    total_issues=v_critical+v_warning+v_info,critical_count=v_critical,warning_count=v_warning,info_count=v_info,
    summary=jsonb_build_object('invoices_checked',v_total,'matched',v_matched,'mismatches',v_critical+v_warning)
  WHERE id=v_run_id;
  RETURN v_run_id;
END;$$;

CREATE OR REPLACE FUNCTION public.reconcile_wallet_vs_journal(p_tenant_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run_id UUID; v_total INT := 0; v_matched INT := 0; v_critical INT := 0; v_warning INT := 0; rec RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenant_members WHERE tenant_id=p_tenant_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF;

  INSERT INTO reconciliation_runs (tenant_id,run_type,triggered_by) VALUES (p_tenant_id,'wallet_journal',auth.uid()) RETURNING id INTO v_run_id;

  FOR rec IN
    SELECT tw.id AS wallet_id, tw.balance_available, tw.currency,
      COALESCE(SUM(CASE WHEN wt.type='credit' THEN wt.amount ELSE -wt.amount END),0) AS computed_balance,
      (SELECT wt2.balance_after FROM wallet_transactions wt2 WHERE wt2.wallet_id=tw.id ORDER BY wt2.created_at DESC LIMIT 1) AS last_balance_after
    FROM tenant_wallets tw LEFT JOIN wallet_transactions wt ON wt.wallet_id=tw.id
    WHERE tw.tenant_id=p_tenant_id GROUP BY tw.id, tw.balance_available, tw.currency
  LOOP
    v_total := v_total + 1;
    IF ABS(rec.balance_available - rec.computed_balance) > 0.01 THEN
      INSERT INTO reconciliation_issues (run_id,tenant_id,severity,issue_type,entity_type,entity_id,entity_label,expected_value,actual_value,difference,description,description_en)
      VALUES (v_run_id,p_tenant_id,'critical','balance_drift','wallet',rec.wallet_id,rec.currency,rec.computed_balance,rec.balance_available,rec.balance_available-rec.computed_balance,
        'رصيد المحفظة لا يتطابق مع مجموع العمليات','Wallet balance does not match sum of transactions');
      v_critical := v_critical + 1;
    ELSIF rec.last_balance_after IS NOT NULL AND ABS(rec.balance_available - rec.last_balance_after) > 0.01 THEN
      INSERT INTO reconciliation_issues (run_id,tenant_id,severity,issue_type,entity_type,entity_id,entity_label,expected_value,actual_value,difference,description,description_en)
      VALUES (v_run_id,p_tenant_id,'warning','balance_drift','wallet',rec.wallet_id,rec.currency,rec.last_balance_after,rec.balance_available,rec.balance_available-rec.last_balance_after,
        'رصيد المحفظة لا يتطابق مع آخر عملية','Wallet balance differs from last balance_after');
      v_warning := v_warning + 1;
    ELSE
      v_matched := v_matched + 1;
    END IF;
  END LOOP;

  FOR rec IN
    SELECT wt.id, wt.wallet_id, wt.balance_before, wt.balance_after,
      LAG(wt.balance_after) OVER (PARTITION BY wt.wallet_id ORDER BY wt.created_at) AS prev_balance_after
    FROM wallet_transactions wt JOIN tenant_wallets tw ON tw.id=wt.wallet_id AND tw.tenant_id=p_tenant_id
  LOOP
    IF rec.prev_balance_after IS NOT NULL AND ABS(rec.balance_before - rec.prev_balance_after) > 0.01 THEN
      INSERT INTO reconciliation_issues (run_id,tenant_id,severity,issue_type,entity_type,entity_id,entity_label,expected_value,actual_value,difference,description,description_en)
      VALUES (v_run_id,p_tenant_id,'critical','balance_drift','wallet_transaction',rec.id,rec.wallet_id::text,rec.prev_balance_after,rec.balance_before,rec.balance_before-rec.prev_balance_after,
        'فجوة في سلسلة الأرصدة','Balance chain break: balance_before != previous balance_after');
      v_critical := v_critical + 1;
    END IF;
  END LOOP;

  UPDATE reconciliation_runs SET status='completed',completed_at=now(),total_checked=v_total,total_matched=v_matched,
    total_issues=v_critical+v_warning,critical_count=v_critical,warning_count=v_warning,info_count=0 WHERE id=v_run_id;
  RETURN v_run_id;
END;$$;

CREATE OR REPLACE FUNCTION public.reconcile_vat_totals(p_tenant_id UUID, p_date_from DATE DEFAULT NULL, p_date_to DATE DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run_id UUID; v_total INT := 0; v_matched INT := 0; v_critical INT := 0; v_warning INT := 0; v_info INT := 0; rec RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenant_members WHERE tenant_id=p_tenant_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF;

  INSERT INTO reconciliation_runs (tenant_id,run_type,date_from,date_to,triggered_by)
  VALUES (p_tenant_id,'vat_totals',p_date_from,p_date_to,auth.uid()) RETURNING id INTO v_run_id;

  FOR rec IN
    SELECT i.id, i.invoice_number, i.vat_total,
      COALESCE((SELECT SUM(jel.credit-jel.debit) FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
        WHERE je.source_id=i.id AND je.source_type='invoice' AND je.tenant_id=p_tenant_id AND je.status='posted'
        AND (jel.account_name ILIKE '%ضريبة%' OR jel.account_name ILIKE '%vat%' OR jel.account_name ILIKE '%tax%')),0) AS journal_vat
    FROM invoices i WHERE i.tenant_id=p_tenant_id AND i.status NOT IN ('draft','cancelled','void')
      AND (p_date_from IS NULL OR i.invoice_date>=p_date_from) AND (p_date_to IS NULL OR i.invoice_date<=p_date_to)
  LOOP
    v_total := v_total + 1;
    IF ABS(rec.vat_total - rec.journal_vat) > 0.01 THEN
      INSERT INTO reconciliation_issues (run_id,tenant_id,severity,issue_type,entity_type,entity_id,entity_label,expected_value,actual_value,difference,description,description_en)
      VALUES (v_run_id,p_tenant_id,CASE WHEN ABS(rec.vat_total-rec.journal_vat)>1 THEN 'critical' ELSE 'warning' END,
        'vat_discrepancy','invoice',rec.id,rec.invoice_number,rec.vat_total,rec.journal_vat,rec.vat_total-rec.journal_vat,
        'مبلغ الضريبة في الفاتورة لا يتطابق مع القيد','Invoice VAT != journal VAT');
      IF ABS(rec.vat_total-rec.journal_vat)>1 THEN v_critical:=v_critical+1; ELSE v_warning:=v_warning+1; END IF;
    ELSE v_matched:=v_matched+1;
    END IF;
  END LOOP;

  FOR rec IN
    SELECT e.id, e.expense_number, e.vat_amount,
      COALESCE((SELECT SUM(jel.debit-jel.credit) FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
        WHERE je.source_id=e.id AND je.source_type='expense' AND je.tenant_id=p_tenant_id AND je.status='posted'
        AND (jel.account_name ILIKE '%ضريبة%' OR jel.account_name ILIKE '%vat%' OR jel.account_name ILIKE '%tax%')),0) AS journal_vat
    FROM expenses e WHERE e.tenant_id=p_tenant_id AND e.status NOT IN ('draft','rejected')
      AND (p_date_from IS NULL OR e.expense_date>=p_date_from) AND (p_date_to IS NULL OR e.expense_date<=p_date_to)
  LOOP
    v_total := v_total + 1;
    IF ABS(rec.vat_amount - rec.journal_vat) > 0.01 THEN
      INSERT INTO reconciliation_issues (run_id,tenant_id,severity,issue_type,entity_type,entity_id,entity_label,expected_value,actual_value,difference,description,description_en)
      VALUES (v_run_id,p_tenant_id,CASE WHEN ABS(rec.vat_amount-rec.journal_vat)>1 THEN 'critical' ELSE 'warning' END,
        'vat_discrepancy','expense',rec.id,rec.expense_number,rec.vat_amount,rec.journal_vat,rec.vat_amount-rec.journal_vat,
        'مبلغ الضريبة في المصروف لا يتطابق مع القيد','Expense VAT != journal VAT');
      IF ABS(rec.vat_amount-rec.journal_vat)>1 THEN v_critical:=v_critical+1; ELSE v_warning:=v_warning+1; END IF;
    ELSE v_matched:=v_matched+1;
    END IF;
  END LOOP;

  UPDATE reconciliation_runs SET status='completed',completed_at=now(),total_checked=v_total,total_matched=v_matched,
    total_issues=v_critical+v_warning+v_info,critical_count=v_critical,warning_count=v_warning,info_count=v_info WHERE id=v_run_id;
  RETURN v_run_id;
END;$$;

CREATE OR REPLACE FUNCTION public.reconcile_subscription_revenue(p_tenant_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run_id UUID; v_total INT := 0; v_matched INT := 0; v_critical INT := 0; v_warning INT := 0; v_info INT := 0; rec RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenant_members WHERE tenant_id=p_tenant_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF;

  INSERT INTO reconciliation_runs (tenant_id,run_type,triggered_by) VALUES (p_tenant_id,'subscription_revenue',auth.uid()) RETURNING id INTO v_run_id;

  FOR rec IN
    SELECT s.id, s.plan_id, s.billing_cycle, sp.id AS plan_exists, sp.name_ar, sp.price_monthly, sp.price_yearly
    FROM subscriptions s LEFT JOIN subscription_plans sp ON sp.id=s.plan_id
    WHERE s.tenant_id=p_tenant_id AND s.status='active'
  LOOP
    v_total := v_total + 1;
    IF rec.plan_exists IS NULL THEN
      INSERT INTO reconciliation_issues (run_id,tenant_id,severity,issue_type,entity_type,entity_id,entity_label,description,description_en)
      VALUES (v_run_id,p_tenant_id,'critical','missing_subscription_entry','subscription',rec.id,rec.id::text,
        'اشتراك نشط يشير إلى خطة غير موجودة','Active subscription references non-existent plan');
      v_critical:=v_critical+1;
    ELSIF rec.billing_cycle='monthly' AND (rec.price_monthly IS NULL OR rec.price_monthly<=0) THEN
      INSERT INTO reconciliation_issues (run_id,tenant_id,severity,issue_type,entity_type,entity_id,entity_label,actual_value,description,description_en)
      VALUES (v_run_id,p_tenant_id,'warning','missing_subscription_entry','subscription',rec.id,rec.name_ar,rec.price_monthly,
        'اشتراك شهري بسعر صفر','Monthly subscription with zero price');
      v_warning:=v_warning+1;
    ELSIF rec.billing_cycle='yearly' AND (rec.price_yearly IS NULL OR rec.price_yearly<=0) THEN
      INSERT INTO reconciliation_issues (run_id,tenant_id,severity,issue_type,entity_type,entity_id,entity_label,actual_value,description,description_en)
      VALUES (v_run_id,p_tenant_id,'warning','missing_subscription_entry','subscription',rec.id,rec.name_ar,rec.price_yearly,
        'اشتراك سنوي بسعر صفر','Yearly subscription with zero price');
      v_warning:=v_warning+1;
    ELSE v_matched:=v_matched+1;
    END IF;
  END LOOP;

  FOR rec IN
    SELECT s.id, sp.name_ar FROM subscriptions s JOIN subscription_plans sp ON sp.id=s.plan_id
    WHERE s.tenant_id=p_tenant_id AND s.status='active' AND s.current_period_end<now() AND s.grace_ends_at<now()
  LOOP
    INSERT INTO reconciliation_issues (run_id,tenant_id,severity,issue_type,entity_type,entity_id,entity_label,description,description_en)
    VALUES (v_run_id,p_tenant_id,'warning','missing_subscription_entry','subscription',rec.id,rec.name_ar,
      'اشتراك منتهي لا يزال نشط','Expired subscription still active');
    v_warning:=v_warning+1; v_total:=v_total+1;
  END LOOP;

  UPDATE reconciliation_runs SET status='completed',completed_at=now(),total_checked=v_total,total_matched=v_matched,
    total_issues=v_critical+v_warning+v_info,critical_count=v_critical,warning_count=v_warning,info_count=v_info WHERE id=v_run_id;
  RETURN v_run_id;
END;$$;
