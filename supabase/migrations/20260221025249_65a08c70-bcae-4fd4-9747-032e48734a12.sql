
-- ═══════════════════════════════════════════════════════════
-- Phase 2.7: Journal Approval Workflow
-- ═══════════════════════════════════════════════════════════

-- 1) Create approval_status enum
DO $$ BEGIN
  CREATE TYPE public.journal_approval_status AS ENUM ('none','pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Add approval fields to journal_entries
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_status public.journal_approval_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS approved_by uuid NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS approval_reason text NULL;

-- 3) Add journal_approval_threshold to enterprise_security_policies
ALTER TABLE public.enterprise_security_policies
  ADD COLUMN IF NOT EXISTS journal_approval_threshold numeric(14,2) NOT NULL DEFAULT 0;

-- 4) Index for approval inbox queries
CREATE INDEX IF NOT EXISTS idx_journal_entries_approval
  ON public.journal_entries (tenant_id, approval_status)
  WHERE requires_approval = true;

-- 5) RPC: approve_journal_entry — approves and optionally auto-posts
CREATE OR REPLACE FUNCTION public.approve_journal_entry(
  p_entry_id uuid,
  p_approver_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry record;
BEGIN
  SELECT * INTO v_entry FROM journal_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Entry not found');
  END IF;

  IF v_entry.approval_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Entry is not pending approval');
  END IF;

  -- Prevent self-approval (creator cannot approve their own entry)
  IF v_entry.created_by = p_approver_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot approve your own entry');
  END IF;

  UPDATE journal_entries SET
    approval_status = 'approved',
    approved_by = p_approver_id,
    approved_at = now(),
    approval_reason = p_reason
  WHERE id = p_entry_id;

  -- Audit log
  INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, entity_label, after_value)
  VALUES (v_entry.tenant_id, p_approver_id, 'journal_entry', p_entry_id::text, 'approved',
          v_entry.entry_number, jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('success', true, 'message', 'Entry approved');
END;
$$;

-- 6) RPC: reject_journal_entry
CREATE OR REPLACE FUNCTION public.reject_journal_entry(
  p_entry_id uuid,
  p_rejector_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry record;
BEGIN
  SELECT * INTO v_entry FROM journal_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Entry not found');
  END IF;

  IF v_entry.approval_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Entry is not pending approval');
  END IF;

  -- Prevent self-rejection
  IF v_entry.created_by = p_rejector_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot reject your own entry');
  END IF;

  UPDATE journal_entries SET
    approval_status = 'rejected',
    approved_by = p_rejector_id,
    approved_at = now(),
    approval_reason = p_reason,
    status = 'draft'
  WHERE id = p_entry_id;

  -- Audit log
  INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, entity_label, after_value)
  VALUES (v_entry.tenant_id, p_rejector_id, 'journal_entry', p_entry_id::text, 'rejected',
          v_entry.entry_number, jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('success', true, 'message', 'Entry rejected');
END;
$$;

-- 7) Trigger: auto-set requires_approval on INSERT based on threshold
CREATE OR REPLACE FUNCTION public.trg_journal_check_approval_threshold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold numeric(14,2);
  v_total numeric;
BEGIN
  -- Only check draft entries
  IF NEW.status != 'draft' THEN RETURN NEW; END IF;

  -- Get threshold (0 means disabled)
  SELECT COALESCE(journal_approval_threshold, 0)
    INTO v_threshold
    FROM enterprise_security_policies
    WHERE tenant_id = NEW.tenant_id;

  IF NOT FOUND OR v_threshold <= 0 THEN
    NEW.requires_approval := false;
    NEW.approval_status := 'none';
    RETURN NEW;
  END IF;

  -- Calculate entry total (use total_debit which equals total_credit for balanced entries)
  v_total := GREATEST(NEW.total_debit, NEW.total_credit, NEW.base_total_debit, NEW.base_total_credit);

  IF v_total >= v_threshold THEN
    NEW.requires_approval := true;
    NEW.approval_status := 'pending';
  ELSE
    NEW.requires_approval := false;
    NEW.approval_status := 'none';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_approval_check ON public.journal_entries;
CREATE TRIGGER trg_journal_approval_check
  BEFORE INSERT OR UPDATE OF total_debit, total_credit, base_total_debit, base_total_credit
  ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_journal_check_approval_threshold();

-- 8) Modify post_journal_entry to refuse unapproved entries
-- We add a check at the top of the existing function
CREATE OR REPLACE FUNCTION public.post_journal_entry(p_entry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry record;
  v_line_count int;
  v_debit_sum numeric;
  v_credit_sum numeric;
  v_period_closed boolean;
BEGIN
  SELECT * INTO v_entry FROM journal_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'القيد غير موجود');
  END IF;

  IF v_entry.status != 'draft' THEN
    RETURN jsonb_build_object('success', false, 'message', 'القيد مرحّل بالفعل أو ملغى');
  END IF;

  -- ▶ Approval gate: refuse unapproved entries
  IF v_entry.requires_approval AND v_entry.approval_status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'message', 'يتطلب هذا القيد موافقة قبل الترحيل / This entry requires approval before posting');
  END IF;

  -- Check for closed accounting period
  SELECT EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE tenant_id = v_entry.tenant_id
      AND (legal_entity_id IS NULL OR legal_entity_id = v_entry.branch_id)
      AND period_year = EXTRACT(YEAR FROM v_entry.entry_date)::int
      AND period_month = EXTRACT(MONTH FROM v_entry.entry_date)::int
      AND status = 'closed'
  ) INTO v_period_closed;

  IF v_period_closed THEN
    RETURN jsonb_build_object('success', false, 'message', 'الفترة المحاسبية مغلقة');
  END IF;

  -- Validate lines
  SELECT COUNT(*), COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
    INTO v_line_count, v_debit_sum, v_credit_sum
    FROM journal_lines WHERE entry_id = p_entry_id;

  IF v_line_count < 2 THEN
    RETURN jsonb_build_object('success', false, 'message', 'يجب أن يحتوي القيد على سطرين على الأقل');
  END IF;

  IF v_debit_sum != v_credit_sum THEN
    RETURN jsonb_build_object('success', false, 'message', 'القيد غير متوازن: مدين=' || v_debit_sum || ' دائن=' || v_credit_sum);
  END IF;

  -- Post
  UPDATE journal_entries SET
    status = 'posted',
    posted_at = now(),
    posted_by = v_entry.created_by,
    total_debit = v_debit_sum,
    total_credit = v_credit_sum
  WHERE id = p_entry_id;

  RETURN jsonb_build_object('success', true, 'message', 'تم ترحيل القيد بنجاح');
END;
$$;

-- 9) Revoke public execution, grant to service_role only
REVOKE ALL ON FUNCTION public.approve_journal_entry(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_journal_entry(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.reject_journal_entry(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_journal_entry(uuid, uuid, text) TO service_role;
