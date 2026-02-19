
-- Reconciliation engine: Invoices without journal entries
CREATE OR REPLACE FUNCTION public.reconcile_invoices_without_journals(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_total_checked int := 0;
  v_total_matched int := 0;
  v_total_issues int := 0;
  v_critical int := 0;
  v_warning int := 0;
  rec record;
BEGIN
  -- Create run record
  INSERT INTO reconciliation_runs (tenant_id, run_type, status, started_at, total_checked, total_matched, total_issues, critical_count, warning_count, info_count)
  VALUES (p_tenant_id, 'invoices_without_journals', 'running', now(), 0, 0, 0, 0, 0, 0)
  RETURNING id INTO v_run_id;

  -- Check approved/sent invoices that have no corresponding journal entry
  FOR rec IN
    SELECT i.id, i.invoice_number, i.grand_total, i.invoice_date
    FROM invoices i
    WHERE i.tenant_id = p_tenant_id
      AND i.status IN ('approved', 'sent', 'partially_paid', 'paid', 'overdue')
      AND i.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je.tenant_id = p_tenant_id
          AND je.reference_id = i.id
          AND je.reference_type = 'invoice'
      )
  LOOP
    v_total_checked := v_total_checked + 1;
    v_total_issues := v_total_issues + 1;
    v_critical := v_critical + 1;

    INSERT INTO reconciliation_issues (run_id, tenant_id, severity, issue_type, entity_type, entity_id, entity_label, expected_value, actual_value, difference, description, description_en)
    VALUES (v_run_id, p_tenant_id, 'critical', 'missing_journal', 'invoice', rec.id, rec.invoice_number, rec.grand_total, 0, rec.grand_total,
      'فاتورة معتمدة بدون قيد محاسبي: ' || rec.invoice_number,
      'Approved invoice without journal entry: ' || rec.invoice_number);
  END LOOP;

  -- Also count invoices that DO have journals (matched)
  SELECT count(*) INTO v_total_matched
  FROM invoices i
  WHERE i.tenant_id = p_tenant_id
    AND i.status IN ('approved', 'sent', 'partially_paid', 'paid', 'overdue')
    AND i.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.tenant_id = p_tenant_id
        AND je.reference_id = i.id
        AND je.reference_type = 'invoice'
    );

  v_total_checked := v_total_checked + v_total_matched;

  -- Update run
  UPDATE reconciliation_runs
  SET status = 'completed', completed_at = now(),
      total_checked = v_total_checked, total_matched = v_total_matched,
      total_issues = v_total_issues, critical_count = v_critical, warning_count = v_warning, info_count = 0
  WHERE id = v_run_id;
END;
$$;

-- Reconciliation engine: Unbalanced journal entries
CREATE OR REPLACE FUNCTION public.reconcile_unbalanced_journals(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_total_checked int := 0;
  v_total_matched int := 0;
  v_total_issues int := 0;
  v_critical int := 0;
  rec record;
BEGIN
  INSERT INTO reconciliation_runs (tenant_id, run_type, status, started_at, total_checked, total_matched, total_issues, critical_count, warning_count, info_count)
  VALUES (p_tenant_id, 'unbalanced_journals', 'running', now(), 0, 0, 0, 0, 0, 0)
  RETURNING id INTO v_run_id;

  -- Find journal entries where sum(debit) != sum(credit)
  FOR rec IN
    SELECT je.id, je.entry_number, je.entry_date,
           COALESCE(SUM(jl.debit), 0) as total_debit,
           COALESCE(SUM(jl.credit), 0) as total_credit,
           ABS(COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)) as diff
    FROM journal_entries je
    LEFT JOIN journal_lines jl ON jl.entry_id = je.id AND jl.tenant_id = p_tenant_id
    WHERE je.tenant_id = p_tenant_id
    GROUP BY je.id, je.entry_number, je.entry_date
    HAVING ABS(COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)) > 0.01
  LOOP
    v_total_checked := v_total_checked + 1;
    v_total_issues := v_total_issues + 1;
    v_critical := v_critical + 1;

    INSERT INTO reconciliation_issues (run_id, tenant_id, severity, issue_type, entity_type, entity_id, entity_label, expected_value, actual_value, difference, description, description_en)
    VALUES (v_run_id, p_tenant_id, 'critical', 'unbalanced_entry', 'journal_entry', rec.id, rec.entry_number, rec.total_debit, rec.total_credit, rec.diff,
      'قيد غير متوازن: ' || rec.entry_number || ' — الفرق: ' || rec.diff,
      'Unbalanced journal entry: ' || rec.entry_number || ' — Difference: ' || rec.diff);
  END LOOP;

  -- Count balanced entries
  SELECT count(*) INTO v_total_matched
  FROM journal_entries je
  LEFT JOIN journal_lines jl ON jl.entry_id = je.id AND jl.tenant_id = p_tenant_id
  WHERE je.tenant_id = p_tenant_id
  GROUP BY je.id
  HAVING ABS(COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)) <= 0.01;

  v_total_checked := v_total_checked + COALESCE(v_total_matched, 0);

  UPDATE reconciliation_runs
  SET status = 'completed', completed_at = now(),
      total_checked = v_total_checked, total_matched = COALESCE(v_total_matched, 0),
      total_issues = v_total_issues, critical_count = v_critical, warning_count = 0, info_count = 0
  WHERE id = v_run_id;
END;
$$;
