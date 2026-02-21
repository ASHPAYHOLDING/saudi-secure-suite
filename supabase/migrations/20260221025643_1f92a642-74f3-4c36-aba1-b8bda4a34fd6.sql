
-- Phase 2.8 — Finance Data Integrity Pack
-- ============================================================

-- 1) Performance Indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_date
  ON public.journal_entries (tenant_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry_id
  ON public.journal_lines (entry_id);

CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id
  ON public.journal_lines (account_id);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_tenant_entity_period
  ON public.accounting_periods (tenant_id, legal_entity_id, period_year, period_month);

-- 2) Posting Constraints (trigger-based)
CREATE OR REPLACE FUNCTION public.validate_journal_entry_before_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line_count int;
  v_total_debit numeric;
  v_total_credit numeric;
BEGIN
  IF NEW.status = 'posted' AND (OLD.status IS DISTINCT FROM 'posted') THEN
    SELECT count(*), COALESCE(sum(debit), 0), COALESCE(sum(credit), 0)
      INTO v_line_count, v_total_debit, v_total_credit
      FROM public.journal_lines
     WHERE entry_id = NEW.id;

    IF v_line_count = 0 THEN
      RAISE EXCEPTION 'Cannot post journal entry % — no lines found.', NEW.entry_number;
    END IF;

    IF abs(v_total_debit - v_total_credit) > 0.01 THEN
      RAISE EXCEPTION 'Cannot post journal entry % — unbalanced (debit=%, credit=%).',
        NEW.entry_number, v_total_debit, v_total_credit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_journal_post ON public.journal_entries;
CREATE TRIGGER trg_validate_journal_post
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_journal_entry_before_post();

-- 3) Finance Repair Scan RPC
CREATE OR REPLACE FUNCTION public.scan_finance_integrity(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues jsonb := '[]'::jsonb;
  r record;
BEGIN
  -- A) Unbalanced draft entries
  FOR r IN
    SELECT je.id, je.entry_number, je.entry_date,
           sum(jl.debit) as total_debit, sum(jl.credit) as total_credit
      FROM journal_entries je
      JOIN journal_lines jl ON jl.entry_id = je.id
     WHERE je.tenant_id = p_tenant_id
       AND je.status = 'draft'
       AND je.entry_date >= (current_date - interval '90 days')
     GROUP BY je.id, je.entry_number, je.entry_date
    HAVING abs(sum(jl.debit) - sum(jl.credit)) > 0.01
  LOOP
    v_issues := v_issues || jsonb_build_object(
      'type', 'unbalanced_draft',
      'severity', 'critical',
      'entry_id', r.id,
      'entry_number', r.entry_number,
      'entry_date', r.entry_date,
      'total_debit', r.total_debit,
      'total_credit', r.total_credit,
      'diff', abs(r.total_debit - r.total_credit),
      'message_ar', 'قيد غير متوازن: مدين=' || r.total_debit || ' دائن=' || r.total_credit,
      'message_en', 'Unbalanced draft: debit=' || r.total_debit || ' credit=' || r.total_credit
    );
  END LOOP;

  -- B) Draft entries with no lines
  FOR r IN
    SELECT je.id, je.entry_number, je.entry_date
      FROM journal_entries je
     WHERE je.tenant_id = p_tenant_id
       AND je.status = 'draft'
       AND je.entry_date >= (current_date - interval '90 days')
       AND NOT EXISTS (SELECT 1 FROM journal_lines jl WHERE jl.entry_id = je.id)
  LOOP
    v_issues := v_issues || jsonb_build_object(
      'type', 'empty_entry',
      'severity', 'warning',
      'entry_id', r.id,
      'entry_number', r.entry_number,
      'entry_date', r.entry_date,
      'message_ar', 'قيد مسودة بدون بنود',
      'message_en', 'Draft entry with no lines'
    );
  END LOOP;

  -- C) Lines referencing non-postable accounts
  FOR r IN
    SELECT je.id, je.entry_number, jl.id as line_id, ca.code as account_code, ca.name as account_name
      FROM journal_entries je
      JOIN journal_lines jl ON jl.entry_id = je.id
      JOIN coa_accounts ca ON ca.id = jl.account_id
     WHERE je.tenant_id = p_tenant_id
       AND je.status = 'draft'
       AND je.entry_date >= (current_date - interval '90 days')
       AND ca.is_postable = false
  LOOP
    v_issues := v_issues || jsonb_build_object(
      'type', 'invalid_account',
      'severity', 'critical',
      'entry_id', r.id,
      'entry_number', r.entry_number,
      'line_id', r.line_id,
      'account_code', r.account_code,
      'account_name', r.account_name,
      'message_ar', 'بند يشير لحساب غير قابل للترحيل: ' || r.account_code,
      'message_en', 'Line references non-postable account: ' || r.account_code
    );
  END LOOP;

  -- D) Entries with mismatched totals vs actual line sums
  FOR r IN
    SELECT je.id, je.entry_number, je.entry_date,
           je.total_debit as header_debit, je.total_credit as header_credit,
           sum(jl.debit) as lines_debit, sum(jl.credit) as lines_credit
      FROM journal_entries je
      JOIN journal_lines jl ON jl.entry_id = je.id
     WHERE je.tenant_id = p_tenant_id
       AND je.entry_date >= (current_date - interval '90 days')
     GROUP BY je.id, je.entry_number, je.entry_date, je.total_debit, je.total_credit
    HAVING abs(je.total_debit - sum(jl.debit)) > 0.01
        OR abs(je.total_credit - sum(jl.credit)) > 0.01
  LOOP
    v_issues := v_issues || jsonb_build_object(
      'type', 'total_mismatch',
      'severity', 'warning',
      'entry_id', r.id,
      'entry_number', r.entry_number,
      'entry_date', r.entry_date,
      'header_debit', r.header_debit,
      'header_credit', r.header_credit,
      'lines_debit', r.lines_debit,
      'lines_credit', r.lines_credit,
      'message_ar', 'إجماليات الرأس لا تتطابق مع البنود',
      'message_en', 'Header totals do not match line sums'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'scanned_at', now(),
    'tenant_id', p_tenant_id,
    'total_issues', jsonb_array_length(v_issues),
    'issues', v_issues
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.scan_finance_integrity(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_finance_integrity(uuid) TO service_role;
