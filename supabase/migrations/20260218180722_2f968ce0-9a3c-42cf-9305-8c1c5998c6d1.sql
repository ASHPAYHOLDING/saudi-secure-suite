
-- =================================================================
-- 1) Full-sync RPC: recalculates all actuals for a tenant's active budgets
-- =================================================================
CREATE OR REPLACE FUNCTION public.sync_budget_actuals_for_tenant(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget record;
  v_line record;
  v_period text;
  v_actual numeric;
  v_month_key text;
  v_year int;
  v_count int := 0;
BEGIN
  -- Loop through active budgets for this tenant
  FOR v_budget IN
    SELECT id, fiscal_year FROM budgets
    WHERE tenant_id = p_tenant_id AND status IN ('active', 'draft')
  LOOP
    -- Loop through each budget line
    FOR v_line IN
      SELECT id, line_type, period_type, months FROM budget_lines
      WHERE budget_id = v_budget.id AND tenant_id = p_tenant_id
    LOOP
      v_year := v_budget.fiscal_year;

      -- For monthly lines, calculate per month
      IF v_line.period_type = 'monthly' THEN
        FOR i IN 1..12 LOOP
          v_month_key := LPAD(i::text, 2, '0');
          v_period := v_year::text || '-' || v_month_key;
          v_actual := 0;

          -- Expense lines: sum approved expenses for this month
          IF v_line.line_type = 'expense' THEN
            SELECT COALESCE(SUM(total_amount), 0) INTO v_actual
            FROM expenses
            WHERE tenant_id = p_tenant_id
              AND status = 'approved'
              AND EXTRACT(YEAR FROM expense_date) = v_year
              AND EXTRACT(MONTH FROM expense_date) = i;

          -- Revenue lines: sum invoice payments for this month
          ELSIF v_line.line_type = 'revenue' THEN
            SELECT COALESCE(SUM(ip.amount), 0) INTO v_actual
            FROM invoice_payments ip
            JOIN invoices inv ON inv.id = ip.invoice_id
            WHERE ip.tenant_id = p_tenant_id
              AND EXTRACT(YEAR FROM ip.payment_date) = v_year
              AND EXTRACT(MONTH FROM ip.payment_date) = i;

          -- CapEx lines: sum from journal entry lines (debit side)
          ELSIF v_line.line_type = 'capex' THEN
            SELECT COALESCE(SUM(jel.debit), 0) INTO v_actual
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE je.tenant_id = p_tenant_id
              AND je.status = 'posted'
              AND EXTRACT(YEAR FROM je.entry_date) = v_year
              AND EXTRACT(MONTH FROM je.entry_date) = i;
          END IF;

          -- Upsert into cache
          INSERT INTO budget_actuals_cache (tenant_id, budget_id, line_id, period, actual_amount, updated_at)
          VALUES (p_tenant_id, v_budget.id, v_line.id, v_period, v_actual, now())
          ON CONFLICT (tenant_id, line_id, period)
          DO UPDATE SET actual_amount = EXCLUDED.actual_amount, updated_at = now();

          v_count := v_count + 1;
        END LOOP;

      -- Yearly lines: sum entire year
      ELSE
        v_period := v_year::text;
        v_actual := 0;

        IF v_line.line_type = 'expense' THEN
          SELECT COALESCE(SUM(total_amount), 0) INTO v_actual
          FROM expenses
          WHERE tenant_id = p_tenant_id AND status = 'approved'
            AND EXTRACT(YEAR FROM expense_date) = v_year;
        ELSIF v_line.line_type = 'revenue' THEN
          SELECT COALESCE(SUM(ip.amount), 0) INTO v_actual
          FROM invoice_payments ip
          JOIN invoices inv ON inv.id = ip.invoice_id
          WHERE ip.tenant_id = p_tenant_id
            AND EXTRACT(YEAR FROM ip.payment_date) = v_year;
        ELSIF v_line.line_type = 'capex' THEN
          SELECT COALESCE(SUM(jel.debit), 0) INTO v_actual
          FROM journal_entry_lines jel
          JOIN journal_entries je ON je.id = jel.journal_entry_id
          WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
            AND EXTRACT(YEAR FROM je.entry_date) = v_year;
        END IF;

        INSERT INTO budget_actuals_cache (tenant_id, budget_id, line_id, period, actual_amount, updated_at)
        VALUES (p_tenant_id, v_budget.id, v_line.id, v_period, v_actual, now())
        ON CONFLICT (tenant_id, line_id, period)
        DO UPDATE SET actual_amount = EXCLUDED.actual_amount, updated_at = now();

        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'records_updated', v_count);
END;
$$;

-- =================================================================
-- 2) Incremental update helper: updates cache for a specific tenant+month+type
-- =================================================================
CREATE OR REPLACE FUNCTION public.budget_incremental_update(
  p_tenant_id uuid,
  p_year int,
  p_month int,
  p_line_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget record;
  v_line record;
  v_period text;
  v_actual numeric;
BEGIN
  v_period := p_year::text || '-' || LPAD(p_month::text, 2, '0');

  FOR v_budget IN
    SELECT id FROM budgets
    WHERE tenant_id = p_tenant_id AND fiscal_year = p_year AND status IN ('active', 'draft')
  LOOP
    FOR v_line IN
      SELECT id FROM budget_lines
      WHERE budget_id = v_budget.id AND tenant_id = p_tenant_id
        AND line_type = p_line_type::budget_line_type
    LOOP
      v_actual := 0;

      IF p_line_type = 'expense' THEN
        SELECT COALESCE(SUM(total_amount), 0) INTO v_actual
        FROM expenses
        WHERE tenant_id = p_tenant_id AND status = 'approved'
          AND EXTRACT(YEAR FROM expense_date) = p_year
          AND EXTRACT(MONTH FROM expense_date) = p_month;

      ELSIF p_line_type = 'revenue' THEN
        SELECT COALESCE(SUM(ip.amount), 0) INTO v_actual
        FROM invoice_payments ip
        WHERE ip.tenant_id = p_tenant_id
          AND EXTRACT(YEAR FROM ip.payment_date) = p_year
          AND EXTRACT(MONTH FROM ip.payment_date) = p_month;

      ELSIF p_line_type = 'capex' THEN
        SELECT COALESCE(SUM(jel.debit), 0) INTO v_actual
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
          AND EXTRACT(YEAR FROM je.entry_date) = p_year
          AND EXTRACT(MONTH FROM je.entry_date) = p_month;
      END IF;

      INSERT INTO budget_actuals_cache (tenant_id, budget_id, line_id, period, actual_amount, updated_at)
      VALUES (p_tenant_id, v_budget.id, v_line.id, v_period, v_actual, now())
      ON CONFLICT (tenant_id, line_id, period)
      DO UPDATE SET actual_amount = EXCLUDED.actual_amount, updated_at = now();
    END LOOP;
  END LOOP;
END;
$$;

-- =================================================================
-- 3) Trigger on expenses: incremental update for expense-type lines
-- =================================================================
CREATE OR REPLACE FUNCTION public.trg_budget_expense_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_year int;
  v_month int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_tenant := OLD.tenant_id;
    v_year := EXTRACT(YEAR FROM OLD.expense_date);
    v_month := EXTRACT(MONTH FROM OLD.expense_date);
  ELSE
    v_tenant := NEW.tenant_id;
    v_year := EXTRACT(YEAR FROM NEW.expense_date);
    v_month := EXTRACT(MONTH FROM NEW.expense_date);
  END IF;

  PERFORM budget_incremental_update(v_tenant, v_year, v_month, 'expense');

  -- If date changed on UPDATE, also refresh the old month
  IF TG_OP = 'UPDATE' AND OLD.expense_date IS DISTINCT FROM NEW.expense_date THEN
    PERFORM budget_incremental_update(OLD.tenant_id,
      EXTRACT(YEAR FROM OLD.expense_date)::int,
      EXTRACT(MONTH FROM OLD.expense_date)::int,
      'expense');
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_sync_expenses ON public.expenses;
CREATE TRIGGER trg_budget_sync_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.trg_budget_expense_sync();

-- =================================================================
-- 4) Trigger on invoice_payments: incremental update for revenue-type lines
-- =================================================================
CREATE OR REPLACE FUNCTION public.trg_budget_payment_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_year int;
  v_month int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_tenant := OLD.tenant_id;
    v_year := EXTRACT(YEAR FROM OLD.payment_date);
    v_month := EXTRACT(MONTH FROM OLD.payment_date);
  ELSE
    v_tenant := NEW.tenant_id;
    v_year := EXTRACT(YEAR FROM NEW.payment_date);
    v_month := EXTRACT(MONTH FROM NEW.payment_date);
  END IF;

  PERFORM budget_incremental_update(v_tenant, v_year, v_month, 'revenue');

  IF TG_OP = 'UPDATE' AND OLD.payment_date IS DISTINCT FROM NEW.payment_date THEN
    PERFORM budget_incremental_update(OLD.tenant_id,
      EXTRACT(YEAR FROM OLD.payment_date)::int,
      EXTRACT(MONTH FROM OLD.payment_date)::int,
      'revenue');
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_sync_payments ON public.invoice_payments;
CREATE TRIGGER trg_budget_sync_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_budget_payment_sync();

-- =================================================================
-- 5) Trigger on journal_entries: incremental update for capex lines
-- =================================================================
CREATE OR REPLACE FUNCTION public.trg_budget_journal_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_year int;
  v_month int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_tenant := OLD.tenant_id;
    v_year := EXTRACT(YEAR FROM OLD.entry_date);
    v_month := EXTRACT(MONTH FROM OLD.entry_date);
  ELSE
    v_tenant := NEW.tenant_id;
    v_year := EXTRACT(YEAR FROM NEW.entry_date);
    v_month := EXTRACT(MONTH FROM NEW.entry_date);
  END IF;

  PERFORM budget_incremental_update(v_tenant, v_year, v_month, 'capex');

  IF TG_OP = 'UPDATE' AND OLD.entry_date IS DISTINCT FROM NEW.entry_date THEN
    PERFORM budget_incremental_update(OLD.tenant_id,
      EXTRACT(YEAR FROM OLD.entry_date)::int,
      EXTRACT(MONTH FROM OLD.entry_date)::int,
      'capex');
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_sync_journal ON public.journal_entries;
CREATE TRIGGER trg_budget_sync_journal
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.trg_budget_journal_sync();

-- =================================================================
-- 6) Budget alert check function (runs after cache update)
-- =================================================================
CREATE OR REPLACE FUNCTION public.check_budget_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line record;
  v_planned numeric;
  v_total_actual numeric;
  v_pct numeric;
  v_rule record;
  v_month_key text;
BEGIN
  -- Get the budget line info
  SELECT bl.*, b.fiscal_year, b.name_ar as budget_name
  INTO v_line
  FROM budget_lines bl
  JOIN budgets b ON b.id = bl.budget_id
  WHERE bl.id = NEW.line_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Calculate total planned for this line
  IF v_line.period_type = 'monthly' AND v_line.months IS NOT NULL THEN
    SELECT COALESCE(SUM(value::numeric), 0) INTO v_planned
    FROM jsonb_each_text(v_line.months);
  ELSE
    v_planned := COALESCE(v_line.planned_amount, 0);
  END IF;

  IF v_planned <= 0 THEN RETURN NEW; END IF;

  -- Calculate total actual for this line
  SELECT COALESCE(SUM(actual_amount), 0) INTO v_total_actual
  FROM budget_actuals_cache
  WHERE line_id = NEW.line_id AND tenant_id = NEW.tenant_id;

  v_pct := (v_total_actual / v_planned) * 100;

  -- Check alert rules
  FOR v_rule IN
    SELECT * FROM budget_alert_rules
    WHERE budget_id = v_line.budget_id
      AND tenant_id = NEW.tenant_id
      AND enabled = true
      AND threshold_percent <= v_pct
  LOOP
    -- Check if we already have an unresolved alert for this threshold
    IF NOT EXISTS (
      SELECT 1 FROM budget_alert_events
      WHERE budget_id = v_line.budget_id
        AND line_id = NEW.line_id
        AND tenant_id = NEW.tenant_id
        AND percent_used = v_rule.threshold_percent
        AND status != 'resolved'
    ) THEN
      INSERT INTO budget_alert_events (
        tenant_id, budget_id, line_id, period, percent_used, status, message_ar
      ) VALUES (
        NEW.tenant_id, v_line.budget_id, NEW.line_id, NEW.period, v_pct, 'triggered',
        'تجاوز بند "' || COALESCE(v_line.description_ar, v_line.line_type::text) || '" نسبة ' || v_rule.threshold_percent || '% — الفعلي: ' || ROUND(v_pct, 1) || '%'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_budget_alerts ON public.budget_actuals_cache;
CREATE TRIGGER trg_check_budget_alerts
  AFTER INSERT OR UPDATE ON public.budget_actuals_cache
  FOR EACH ROW EXECUTE FUNCTION public.check_budget_alerts();
