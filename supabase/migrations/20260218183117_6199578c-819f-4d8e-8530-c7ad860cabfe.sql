
-- ============================================================
-- ANALYTICS WAREHOUSE – Ledger-based Views & RPC
-- ============================================================

-- 1. analytics_definitions table
CREATE TABLE IF NOT EXISTS public.analytics_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key    TEXT NOT NULL UNIQUE,
  name_ar       TEXT NOT NULL,
  name_en       TEXT,
  sql_source    TEXT NOT NULL,
  formula_description TEXT,
  depends_on_tables   TEXT[] NOT NULL DEFAULT '{}',
  category      TEXT NOT NULL DEFAULT 'financial',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage analytics_definitions"
  ON public.analytics_definitions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read analytics_definitions"
  ON public.analytics_definitions FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 2. Helper function
CREATE OR REPLACE FUNCTION public.classify_account(p_account_name TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_account_name ILIKE '%إيراد%' OR p_account_name ILIKE '%revenue%'
      OR p_account_name ILIKE '%مبيعات%' OR p_account_name ILIKE '%sales%'
      THEN 'revenue'
    WHEN p_account_name ILIKE '%تكلفة%' OR p_account_name ILIKE '%cost%'
      OR p_account_name ILIKE '%cogs%'
      THEN 'cogs'
    WHEN p_account_name ILIKE '%مصروف%' OR p_account_name ILIKE '%expense%'
      OR p_account_name ILIKE '%رواتب%' OR p_account_name ILIKE '%إيجار%'
      OR p_account_name ILIKE '%salary%' OR p_account_name ILIKE '%rent%'
      THEN 'expense'
    WHEN p_account_name ILIKE '%نقد%' OR p_account_name ILIKE '%cash%'
      OR p_account_name ILIKE '%بنك%' OR p_account_name ILIKE '%bank%'
      OR p_account_name ILIKE '%مدين%' OR p_account_name ILIKE '%receivable%'
      OR p_account_name ILIKE '%مخزون%' OR p_account_name ILIKE '%inventory%'
      OR p_account_name ILIKE '%أصول%' OR p_account_name ILIKE '%asset%'
      THEN 'asset'
    WHEN p_account_name ILIKE '%دائن%' OR p_account_name ILIKE '%payable%'
      OR p_account_name ILIKE '%التزام%' OR p_account_name ILIKE '%liability%'
      OR p_account_name ILIKE '%ضريبة%' OR p_account_name ILIKE '%vat%'
      OR p_account_name ILIKE '%tax%'
      THEN 'liability'
    WHEN p_account_name ILIKE '%رأس مال%' OR p_account_name ILIKE '%equity%'
      OR p_account_name ILIKE '%capital%' OR p_account_name ILIKE '%أرباح محتجزة%'
      OR p_account_name ILIKE '%retained%'
      THEN 'equity'
    ELSE 'other'
  END;
$$;

-- 3. Views (security_invoker = on)

CREATE OR REPLACE VIEW public.revenue_summary_view
WITH (security_invoker = on) AS
SELECT
  je.tenant_id, je.branch_id,
  date_trunc('month', je.entry_date)::date AS period,
  jel.account_name,
  SUM(jel.credit) AS total_credit, SUM(jel.debit) AS total_debit,
  SUM(jel.credit) - SUM(jel.debit) AS net_revenue
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.status = 'posted' AND public.classify_account(jel.account_name) = 'revenue'
GROUP BY je.tenant_id, je.branch_id, period, jel.account_name;

CREATE OR REPLACE VIEW public.expense_summary_view
WITH (security_invoker = on) AS
SELECT
  je.tenant_id, je.branch_id,
  date_trunc('month', je.entry_date)::date AS period,
  jel.account_name, je.source_type,
  SUM(jel.debit) AS total_debit, SUM(jel.credit) AS total_credit,
  SUM(jel.debit) - SUM(jel.credit) AS net_expense
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.status = 'posted' AND public.classify_account(jel.account_name) IN ('expense','cogs')
GROUP BY je.tenant_id, je.branch_id, period, jel.account_name, je.source_type;

CREATE OR REPLACE VIEW public.profit_loss_view
WITH (security_invoker = on) AS
SELECT
  je.tenant_id, je.branch_id,
  date_trunc('month', je.entry_date)::date AS period,
  public.classify_account(jel.account_name) AS category,
  SUM(CASE WHEN public.classify_account(jel.account_name) = 'revenue' THEN jel.credit - jel.debit ELSE 0 END) AS revenue,
  SUM(CASE WHEN public.classify_account(jel.account_name) IN ('expense','cogs') THEN jel.debit - jel.credit ELSE 0 END) AS expenses,
  SUM(CASE WHEN public.classify_account(jel.account_name) = 'revenue' THEN jel.credit - jel.debit
           WHEN public.classify_account(jel.account_name) IN ('expense','cogs') THEN -(jel.debit - jel.credit)
           ELSE 0 END) AS net_profit
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.status = 'posted' AND public.classify_account(jel.account_name) IN ('revenue','expense','cogs')
GROUP BY je.tenant_id, je.branch_id, period, category;

CREATE OR REPLACE VIEW public.balance_sheet_view
WITH (security_invoker = on) AS
SELECT
  je.tenant_id, je.branch_id,
  public.classify_account(jel.account_name) AS category,
  jel.account_name,
  SUM(jel.debit) AS total_debit, SUM(jel.credit) AS total_credit,
  CASE WHEN public.classify_account(jel.account_name) = 'asset'
    THEN SUM(jel.debit) - SUM(jel.credit)
    ELSE SUM(jel.credit) - SUM(jel.debit)
  END AS balance
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.status = 'posted' AND public.classify_account(jel.account_name) IN ('asset','liability','equity')
GROUP BY je.tenant_id, je.branch_id, category, jel.account_name;

CREATE OR REPLACE VIEW public.cashflow_view
WITH (security_invoker = on) AS
SELECT
  je.tenant_id, je.branch_id,
  date_trunc('month', je.entry_date)::date AS period,
  je.source_type,
  SUM(jel.debit) AS cash_in, SUM(jel.credit) AS cash_out,
  SUM(jel.debit) - SUM(jel.credit) AS net_cash
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.status = 'posted'
  AND (jel.account_name ILIKE '%نقد%' OR jel.account_name ILIKE '%cash%'
    OR jel.account_name ILIKE '%بنك%' OR jel.account_name ILIKE '%bank%')
GROUP BY je.tenant_id, je.branch_id, period, je.source_type;

CREATE OR REPLACE VIEW public.vat_summary_view
WITH (security_invoker = on) AS
SELECT
  je.tenant_id, je.branch_id,
  date_trunc('month', je.entry_date)::date AS period,
  jel.account_name, je.source_type,
  SUM(jel.debit) AS vat_input, SUM(jel.credit) AS vat_output,
  SUM(jel.credit) - SUM(jel.debit) AS net_vat_payable
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.status = 'posted'
  AND (jel.account_name ILIKE '%ضريبة%' OR jel.account_name ILIKE '%vat%' OR jel.account_name ILIKE '%tax%')
GROUP BY je.tenant_id, je.branch_id, period, jel.account_name, je.source_type;

CREATE OR REPLACE VIEW public.ar_aging_view
WITH (security_invoker = on) AS
SELECT
  i.tenant_id, i.branch_id, i.id AS invoice_id, i.invoice_number,
  i.customer_id, i.due_date, i.amount_due, i.currency,
  COALESCE(SUM(jel.debit) FILTER (WHERE jel.account_name ILIKE '%مدين%' OR jel.account_name ILIKE '%receivable%'), 0) -
  COALESCE(SUM(jel.credit) FILTER (WHERE jel.account_name ILIKE '%مدين%' OR jel.account_name ILIKE '%receivable%'), 0) AS ledger_balance,
  CASE
    WHEN CURRENT_DATE - i.due_date <= 0 THEN 'current'
    WHEN CURRENT_DATE - i.due_date <= 30 THEN '1-30'
    WHEN CURRENT_DATE - i.due_date <= 60 THEN '31-60'
    WHEN CURRENT_DATE - i.due_date <= 90 THEN '61-90'
    ELSE '90+'
  END AS aging_bucket,
  CURRENT_DATE - i.due_date AS days_overdue
FROM public.invoices i
LEFT JOIN public.journal_entries je ON je.source_id = i.id AND je.source_type = 'invoice' AND je.status = 'posted' AND je.tenant_id = i.tenant_id
LEFT JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE i.status NOT IN ('draft','cancelled','void') AND i.amount_due > 0
GROUP BY i.tenant_id, i.branch_id, i.id, i.invoice_number, i.customer_id, i.due_date, i.amount_due, i.currency;

CREATE OR REPLACE VIEW public.ap_aging_view
WITH (security_invoker = on) AS
SELECT
  po.tenant_id, po.branch_id, po.id AS purchase_order_id, po.order_number,
  po.supplier_id, po.expected_delivery_date AS due_date, po.grand_total, po.currency,
  COALESCE(SUM(jel.credit) FILTER (WHERE jel.account_name ILIKE '%دائن%' OR jel.account_name ILIKE '%payable%'), 0) -
  COALESCE(SUM(jel.debit) FILTER (WHERE jel.account_name ILIKE '%دائن%' OR jel.account_name ILIKE '%payable%'), 0) AS ledger_balance,
  CASE
    WHEN CURRENT_DATE - po.expected_delivery_date <= 0 THEN 'current'
    WHEN CURRENT_DATE - po.expected_delivery_date <= 30 THEN '1-30'
    WHEN CURRENT_DATE - po.expected_delivery_date <= 60 THEN '31-60'
    WHEN CURRENT_DATE - po.expected_delivery_date <= 90 THEN '61-90'
    ELSE '90+'
  END AS aging_bucket,
  CURRENT_DATE - po.expected_delivery_date AS days_overdue
FROM public.purchase_orders po
LEFT JOIN public.journal_entries je ON je.source_id = po.id AND je.source_type = 'purchase_order' AND je.status = 'posted' AND je.tenant_id = po.tenant_id
LEFT JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE po.status NOT IN ('draft','cancelled','rejected')
GROUP BY po.tenant_id, po.branch_id, po.id, po.order_number, po.supplier_id, po.expected_delivery_date, po.grand_total, po.currency;

CREATE OR REPLACE VIEW public.subscription_revenue_view
WITH (security_invoker = on) AS
SELECT
  s.tenant_id, s.status AS subscription_status, s.billing_cycle,
  sp.name_ar AS plan_name, sp.price_monthly, sp.price_yearly,
  CASE s.billing_cycle WHEN 'monthly' THEN sp.price_monthly WHEN 'yearly' THEN sp.price_yearly ELSE 0 END AS recurring_amount,
  s.current_period_start, s.current_period_end, s.cancel_at_period_end, s.created_at AS subscribed_at
FROM public.subscriptions s
JOIN public.subscription_plans sp ON sp.id = s.plan_id;

CREATE OR REPLACE VIEW public.wallet_activity_view
WITH (security_invoker = on) AS
SELECT
  tw.tenant_id,
  wt.type AS transaction_type, wt.source, wt.reason,
  date_trunc('month', wt.created_at)::date AS period,
  COUNT(*) AS transaction_count,
  SUM(wt.amount) AS total_amount,
  SUM(CASE WHEN wt.type = 'credit' THEN wt.amount ELSE 0 END) AS total_credits,
  SUM(CASE WHEN wt.type = 'debit' THEN wt.amount ELSE 0 END) AS total_debits
FROM public.wallet_transactions wt
JOIN public.tenant_wallets tw ON tw.id = wt.wallet_id
GROUP BY tw.tenant_id, wt.type, wt.source, wt.reason, period;

-- 4. RPC: get_metric_breakdown
CREATE OR REPLACE FUNCTION public.get_metric_breakdown(
  p_metric_key TEXT, p_tenant_id UUID, p_date_from DATE, p_date_to DATE
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenant_users WHERE tenant_id = p_tenant_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  CASE p_metric_key
  WHEN 'revenue' THEN
    SELECT jsonb_build_object('metric','revenue','value',COALESCE(SUM(jel.credit-jel.debit),0),
      'source','journal_entries → revenue accounts',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('account',jel.account_name,'period',date_trunc('month',je.entry_date)::date,'amount',jel.credit-jel.debit)),'[]'::jsonb))
    INTO result FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
    WHERE je.tenant_id=p_tenant_id AND je.status='posted' AND je.entry_date BETWEEN p_date_from AND p_date_to AND classify_account(jel.account_name)='revenue';

  WHEN 'expenses' THEN
    SELECT jsonb_build_object('metric','expenses','value',COALESCE(SUM(jel.debit-jel.credit),0),
      'source','journal_entries → expense/cogs accounts',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('account',jel.account_name,'source_type',je.source_type,'period',date_trunc('month',je.entry_date)::date,'amount',jel.debit-jel.credit)),'[]'::jsonb))
    INTO result FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
    WHERE je.tenant_id=p_tenant_id AND je.status='posted' AND je.entry_date BETWEEN p_date_from AND p_date_to AND classify_account(jel.account_name) IN ('expense','cogs');

  WHEN 'net_profit' THEN
    SELECT jsonb_build_object('metric','net_profit',
      'value',COALESCE(SUM(CASE WHEN classify_account(jel.account_name)='revenue' THEN jel.credit-jel.debit WHEN classify_account(jel.account_name) IN ('expense','cogs') THEN -(jel.debit-jel.credit) ELSE 0 END),0),
      'source','journal_entries → revenue - expenses',
      'drilldown',jsonb_build_object(
        'revenue',(SELECT COALESCE(SUM(l.credit-l.debit),0) FROM journal_entries e JOIN journal_entry_lines l ON l.journal_entry_id=e.id WHERE e.tenant_id=p_tenant_id AND e.status='posted' AND e.entry_date BETWEEN p_date_from AND p_date_to AND classify_account(l.account_name)='revenue'),
        'expenses',(SELECT COALESCE(SUM(l.debit-l.credit),0) FROM journal_entries e JOIN journal_entry_lines l ON l.journal_entry_id=e.id WHERE e.tenant_id=p_tenant_id AND e.status='posted' AND e.entry_date BETWEEN p_date_from AND p_date_to AND classify_account(l.account_name) IN ('expense','cogs'))))
    INTO result FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
    WHERE je.tenant_id=p_tenant_id AND je.status='posted' AND je.entry_date BETWEEN p_date_from AND p_date_to;

  WHEN 'vat_payable' THEN
    SELECT jsonb_build_object('metric','vat_payable','value',COALESCE(SUM(jel.credit-jel.debit),0),
      'source','journal_entries → vat/tax accounts',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('account',jel.account_name,'source_type',je.source_type,'period',date_trunc('month',je.entry_date)::date,'vat_output',jel.credit,'vat_input',jel.debit,'net',jel.credit-jel.debit)),'[]'::jsonb))
    INTO result FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
    WHERE je.tenant_id=p_tenant_id AND je.status='posted' AND je.entry_date BETWEEN p_date_from AND p_date_to
      AND (jel.account_name ILIKE '%ضريبة%' OR jel.account_name ILIKE '%vat%' OR jel.account_name ILIKE '%tax%');

  WHEN 'cashflow' THEN
    SELECT jsonb_build_object('metric','cashflow','value',COALESCE(SUM(jel.debit-jel.credit),0),
      'source','journal_entries → cash/bank accounts',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('source_type',je.source_type,'period',date_trunc('month',je.entry_date)::date,'cash_in',jel.debit,'cash_out',jel.credit)),'[]'::jsonb))
    INTO result FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
    WHERE je.tenant_id=p_tenant_id AND je.status='posted' AND je.entry_date BETWEEN p_date_from AND p_date_to
      AND (jel.account_name ILIKE '%نقد%' OR jel.account_name ILIKE '%cash%' OR jel.account_name ILIKE '%بنك%' OR jel.account_name ILIKE '%bank%');

  WHEN 'ar_aging' THEN
    SELECT jsonb_build_object('metric','ar_aging','value',COALESCE(SUM(i.amount_due),0),
      'source','invoices + journal_entries → receivable accounts',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('invoice_number',i.invoice_number,'customer_id',i.customer_id,'amount_due',i.amount_due,'due_date',i.due_date,'days_overdue',CURRENT_DATE-i.due_date,
        'bucket',CASE WHEN CURRENT_DATE-i.due_date<=0 THEN 'current' WHEN CURRENT_DATE-i.due_date<=30 THEN '1-30' WHEN CURRENT_DATE-i.due_date<=60 THEN '31-60' WHEN CURRENT_DATE-i.due_date<=90 THEN '61-90' ELSE '90+' END)),'[]'::jsonb))
    INTO result FROM invoices i WHERE i.tenant_id=p_tenant_id AND i.status NOT IN ('draft','cancelled','void') AND i.amount_due>0 AND i.invoice_date BETWEEN p_date_from AND p_date_to;

  WHEN 'ap_aging' THEN
    SELECT jsonb_build_object('metric','ap_aging','value',COALESCE(SUM(po.grand_total),0),
      'source','purchase_orders + journal_entries → payable accounts',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('order_number',po.order_number,'supplier_id',po.supplier_id,'amount',po.grand_total,'due_date',po.expected_delivery_date,'days_overdue',CURRENT_DATE-po.expected_delivery_date,
        'bucket',CASE WHEN CURRENT_DATE-po.expected_delivery_date<=0 THEN 'current' WHEN CURRENT_DATE-po.expected_delivery_date<=30 THEN '1-30' WHEN CURRENT_DATE-po.expected_delivery_date<=60 THEN '31-60' WHEN CURRENT_DATE-po.expected_delivery_date<=90 THEN '61-90' ELSE '90+' END)),'[]'::jsonb))
    INTO result FROM purchase_orders po WHERE po.tenant_id=p_tenant_id AND po.status NOT IN ('draft','cancelled','rejected') AND po.order_date BETWEEN p_date_from AND p_date_to;

  WHEN 'wallet_activity' THEN
    SELECT jsonb_build_object('metric','wallet_activity','value',COALESCE(SUM(wt.amount),0),
      'source','wallet_transactions',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('type',wt.type,'source',wt.source,'amount',wt.amount,'date',wt.created_at)),'[]'::jsonb))
    INTO result FROM wallet_transactions wt JOIN tenant_wallets tw ON tw.id=wt.wallet_id
    WHERE tw.tenant_id=p_tenant_id AND wt.created_at>=p_date_from AND wt.created_at<p_date_to+1;

  WHEN 'subscription_revenue' THEN
    SELECT jsonb_build_object('metric','subscription_revenue',
      'value',COALESCE(SUM(CASE s.billing_cycle WHEN 'monthly' THEN sp.price_monthly WHEN 'yearly' THEN sp.price_yearly ELSE 0 END),0),
      'source','subscriptions + subscription_plans',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('plan',sp.name_ar,'cycle',s.billing_cycle,'status',s.status,
        'amount',CASE s.billing_cycle WHEN 'monthly' THEN sp.price_monthly WHEN 'yearly' THEN sp.price_yearly ELSE 0 END,
        'period_start',s.current_period_start,'period_end',s.current_period_end)),'[]'::jsonb))
    INTO result FROM subscriptions s JOIN subscription_plans sp ON sp.id=s.plan_id
    WHERE s.tenant_id=p_tenant_id AND s.status='active';

  ELSE
    result := jsonb_build_object('error','Unknown metric_key: '||p_metric_key,'available_keys',ARRAY['revenue','expenses','net_profit','vat_payable','cashflow','ar_aging','ap_aging','wallet_activity','subscription_revenue']);
  END CASE;

  RETURN result;
END;
$$;

-- 5. Seed definitions
INSERT INTO public.analytics_definitions (metric_key,name_ar,name_en,sql_source,formula_description,depends_on_tables,category) VALUES
('revenue','الإيرادات','Revenue','revenue_summary_view','SUM(credit-debit) WHERE classify_account=revenue','{journal_entries,journal_entry_lines}','financial'),
('expenses','المصروفات','Expenses','expense_summary_view','SUM(debit-credit) WHERE classify_account IN (expense,cogs)','{journal_entries,journal_entry_lines}','financial'),
('net_profit','صافي الربح','Net Profit','profit_loss_view','revenue - expenses (from ledger)','{journal_entries,journal_entry_lines}','financial'),
('vat_payable','ضريبة القيمة المضافة المستحقة','VAT Payable','vat_summary_view','SUM(vat_output-vat_input) from tax accounts','{journal_entries,journal_entry_lines}','tax'),
('cashflow','التدفق النقدي','Cashflow','cashflow_view','SUM(debit-credit) on cash/bank accounts','{journal_entries,journal_entry_lines}','financial'),
('ar_aging','أعمار الذمم المدينة','AR Aging','ar_aging_view','Outstanding receivables bucketed by aging','{invoices,journal_entries,journal_entry_lines}','operational'),
('ap_aging','أعمار الذمم الدائنة','AP Aging','ap_aging_view','Outstanding payables bucketed by aging','{purchase_orders,journal_entries,journal_entry_lines}','operational'),
('wallet_activity','نشاط المحفظة','Wallet Activity','wallet_activity_view','SUM(amount) grouped by type/source','{wallet_transactions,tenant_wallets}','operational'),
('subscription_revenue','إيرادات الاشتراكات','Subscription Revenue','subscription_revenue_view','Active subscription recurring amounts','{subscriptions,subscription_plans}','financial'),
('balance_sheet','الميزانية العمومية','Balance Sheet','balance_sheet_view','Assets=Liabilities+Equity (from ledger)','{journal_entries,journal_entry_lines}','financial')
ON CONFLICT (metric_key) DO NOTHING;
