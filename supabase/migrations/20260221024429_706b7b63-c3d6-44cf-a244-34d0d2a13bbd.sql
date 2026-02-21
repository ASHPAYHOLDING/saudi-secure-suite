
-- Phase 2.4: Accounting Period Close

-- 1. Enum for period status
DO $$ BEGIN
  CREATE TYPE public.accounting_period_status AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Table
CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  legal_entity_id uuid REFERENCES public.legal_entities(id),
  period_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status public.accounting_period_status NOT NULL DEFAULT 'open',
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, legal_entity_id, period_year, period_month)
);

ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.accounting_periods
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- 3. Close period RPC
CREATE OR REPLACE FUNCTION public.close_accounting_period(
  p_tenant_id uuid,
  p_legal_entity_id uuid DEFAULT NULL,
  p_year int DEFAULT NULL,
  p_month int DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_id uuid;
BEGIN
  -- Upsert the period row
  INSERT INTO accounting_periods (tenant_id, legal_entity_id, period_year, period_month, status, closed_at, closed_by)
  VALUES (p_tenant_id, p_legal_entity_id, p_year, p_month, 'closed', now(), p_user_id)
  ON CONFLICT (tenant_id, legal_entity_id, period_year, period_month)
  DO UPDATE SET status = 'closed', closed_at = now(), closed_by = p_user_id, updated_at = now()
  RETURNING id INTO v_period_id;

  -- Audit log
  INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, changes)
  VALUES (p_tenant_id, COALESCE(p_user_id, '00000000-0000-0000-0000-000000000000'), 'accounting_period', v_period_id::text, 'period_closed',
    jsonb_build_object('year', p_year, 'month', p_month, 'legal_entity_id', p_legal_entity_id));

  RETURN jsonb_build_object('success', true, 'period_id', v_period_id);
END;
$$;

-- 4. Reopen period RPC
CREATE OR REPLACE FUNCTION public.reopen_accounting_period(
  p_tenant_id uuid,
  p_legal_entity_id uuid DEFAULT NULL,
  p_year int DEFAULT NULL,
  p_month int DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_id uuid;
BEGIN
  UPDATE accounting_periods
  SET status = 'open', closed_at = NULL, closed_by = NULL, updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND legal_entity_id IS NOT DISTINCT FROM p_legal_entity_id
    AND period_year = p_year
    AND period_month = p_month
    AND status = 'closed'
  RETURNING id INTO v_period_id;

  IF v_period_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Period not found or already open');
  END IF;

  -- Audit log
  INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, changes)
  VALUES (p_tenant_id, COALESCE(p_user_id, '00000000-0000-0000-0000-000000000000'), 'accounting_period', v_period_id::text, 'period_reopened',
    jsonb_build_object('year', p_year, 'month', p_month, 'legal_entity_id', p_legal_entity_id));

  RETURN jsonb_build_object('success', true, 'period_id', v_period_id);
END;
$$;

-- 5. Revoke public access, grant to service_role only
REVOKE EXECUTE ON FUNCTION public.close_accounting_period FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_accounting_period TO service_role;

REVOKE EXECUTE ON FUNCTION public.reopen_accounting_period FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_accounting_period TO service_role;

-- 6. Update post_journal_entry to check period lock
CREATE OR REPLACE FUNCTION public.post_journal_entry(p_entry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry record;
  v_balance numeric;
  v_non_postable int;
  v_period_closed boolean;
BEGIN
  -- 1. Lock the entry row
  SELECT * INTO v_entry FROM journal_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Entry not found');
  END IF;
  IF v_entry.status <> 'draft' THEN
    RETURN jsonb_build_object('error', 'Only draft entries can be posted');
  END IF;

  -- 2. Check accounting period lock
  SELECT EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE tenant_id = v_entry.tenant_id
      AND legal_entity_id IS NOT DISTINCT FROM v_entry.legal_entity_id
      AND period_year = EXTRACT(YEAR FROM v_entry.entry_date)::int
      AND period_month = EXTRACT(MONTH FROM v_entry.entry_date)::int
      AND status = 'closed'
  ) INTO v_period_closed;

  IF v_period_closed THEN
    RETURN jsonb_build_object('error', 'الفترة المحاسبية مغلقة — لا يمكن ترحيل القيد في هذا الشهر');
  END IF;

  -- 3. Validate balance
  SELECT COALESCE(SUM(debit),0) - COALESCE(SUM(credit),0)
  INTO v_balance
  FROM journal_lines WHERE entry_id = p_entry_id;

  IF v_balance <> 0 THEN
    RETURN jsonb_build_object('error', 'Entry is not balanced (debit ≠ credit)');
  END IF;

  -- 4. Check all accounts are postable
  SELECT COUNT(*) INTO v_non_postable
  FROM journal_lines jl
  JOIN coa_accounts ca ON ca.id = jl.account_id
  WHERE jl.entry_id = p_entry_id AND ca.is_postable = false;

  IF v_non_postable > 0 THEN
    RETURN jsonb_build_object('error', 'Some accounts are not postable');
  END IF;

  -- 5. Post
  UPDATE journal_entries
  SET status = 'posted', posted_at = now(), updated_at = now()
  WHERE id = p_entry_id;

  -- 6. Audit
  INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action)
  VALUES (v_entry.tenant_id, v_entry.created_by, 'journal_entry', p_entry_id::text, 'journal_posted');

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.post_journal_entry FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_journal_entry TO service_role;
