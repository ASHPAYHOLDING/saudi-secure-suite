
-- 1) Add before_value / after_value columns to audit_logs
ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS before_value jsonb,
  ADD COLUMN IF NOT EXISTS after_value jsonb;

-- 2) Add soft-delete columns to financial tables
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- 3) Prevent hard deletes on financial tables (soft delete only)
CREATE OR REPLACE FUNCTION public.prevent_financial_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow if row already has deleted_at set (system cleanup)
  IF OLD.deleted_at IS NOT NULL THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Hard delete is not allowed on financial records. Use soft delete (set deleted_at) instead.';
END;
$$;

CREATE OR REPLACE TRIGGER prevent_hard_delete_invoices BEFORE DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_hard_delete();
CREATE OR REPLACE TRIGGER prevent_hard_delete_expenses BEFORE DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_hard_delete();
CREATE OR REPLACE TRIGGER prevent_hard_delete_journal_entries BEFORE DELETE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_hard_delete();
CREATE OR REPLACE TRIGGER prevent_hard_delete_subscriptions BEFORE DELETE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_hard_delete();
CREATE OR REPLACE TRIGGER prevent_hard_delete_wallet_tx BEFORE DELETE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_hard_delete();
CREATE OR REPLACE TRIGGER prevent_hard_delete_budgets BEFORE DELETE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_hard_delete();
CREATE OR REPLACE TRIGGER prevent_hard_delete_credit_notes BEFORE DELETE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_hard_delete();

-- 4) Enhanced audit trigger function with before/after snapshots
CREATE OR REPLACE FUNCTION public.enhanced_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_action text;
  v_entity_label text;
  v_before jsonb;
  v_after jsonb;
  v_changes jsonb;
BEGIN
  v_user_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  IF TG_OP = 'DELETE' THEN
    v_tenant_id := OLD.tenant_id;
    v_action := 'delete';
    v_entity_label := COALESCE(
      CASE TG_TABLE_NAME
        WHEN 'invoices' THEN OLD.invoice_number
        WHEN 'expenses' THEN OLD.expense_number
        WHEN 'journal_entries' THEN OLD.entry_number
        WHEN 'subscriptions' THEN OLD.plan_name_ar
        WHEN 'budgets' THEN OLD.name_ar
        WHEN 'credit_notes' THEN OLD.credit_note_number
        ELSE OLD.id::text
      END, OLD.id::text);
    v_before := to_jsonb(OLD);
    v_after := NULL;
    v_changes := NULL;

    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes, before_value, after_value)
    VALUES (v_tenant_id, COALESCE(auth.uid(), OLD.created_by, v_user_id), v_action, TG_TABLE_NAME, OLD.id, v_entity_label, v_changes, v_before, v_after);
    RETURN OLD;
  END IF;

  v_tenant_id := NEW.tenant_id;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_before := NULL;
    v_after := to_jsonb(NEW);
    v_entity_label := COALESCE(
      CASE TG_TABLE_NAME
        WHEN 'invoices' THEN NEW.invoice_number
        WHEN 'expenses' THEN NEW.expense_number
        WHEN 'journal_entries' THEN NEW.entry_number
        WHEN 'subscriptions' THEN NEW.plan_name_ar
        WHEN 'budgets' THEN NEW.name_ar
        WHEN 'credit_notes' THEN NEW.credit_note_number
        WHEN 'wallet_transactions' THEN NEW.reference_id
        WHEN 'report_versions' THEN NEW.report_name_ar
        ELSE NEW.id::text
      END, NEW.id::text);
    v_changes := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if this is a soft delete
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'soft_delete';
    ELSE
      v_action := 'update';
    END IF;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_entity_label := COALESCE(
      CASE TG_TABLE_NAME
        WHEN 'invoices' THEN NEW.invoice_number
        WHEN 'expenses' THEN NEW.expense_number
        WHEN 'journal_entries' THEN NEW.entry_number
        WHEN 'subscriptions' THEN NEW.plan_name_ar
        WHEN 'budgets' THEN NEW.name_ar
        WHEN 'credit_notes' THEN NEW.credit_note_number
        WHEN 'wallet_transactions' THEN NEW.reference_id
        WHEN 'report_versions' THEN NEW.report_name_ar
        ELSE NEW.id::text
      END, NEW.id::text);

    -- Build changes diff (only changed columns)
    SELECT jsonb_object_agg(key, jsonb_build_object('old', v_before->key, 'new', v_after->key))
    INTO v_changes
    FROM jsonb_each(v_after)
    WHERE v_before->key IS DISTINCT FROM v_after->key
      AND key NOT IN ('updated_at', 'created_at');
  END IF;

  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes, before_value, after_value)
  VALUES (v_tenant_id, COALESCE(auth.uid(), NEW.created_by, v_user_id), v_action, TG_TABLE_NAME, NEW.id, v_entity_label, v_changes, v_before, v_after);

  RETURN NEW;
END;
$$;

-- 5) Replace existing audit triggers with enhanced ones
-- Drop old triggers first, then create new ones
DROP TRIGGER IF EXISTS trg_audit_invoices ON public.invoices;
CREATE TRIGGER trg_enhanced_audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.enhanced_audit_trigger();

DROP TRIGGER IF EXISTS audit_expense_changes ON public.expenses;
CREATE TRIGGER trg_enhanced_audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.enhanced_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_budgets ON public.budgets;
CREATE TRIGGER trg_enhanced_audit_budgets AFTER INSERT OR UPDATE OR DELETE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.enhanced_audit_trigger();

-- Add audit trigger for subscriptions (new)
DROP TRIGGER IF EXISTS trg_enhanced_audit_subscriptions ON public.subscriptions;
CREATE TRIGGER trg_enhanced_audit_subscriptions AFTER INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.enhanced_audit_trigger();

-- Add audit trigger for wallet_transactions (enhance existing)
DROP TRIGGER IF EXISTS trg_audit_wallet_tx_insert ON public.wallet_transactions;
CREATE TRIGGER trg_enhanced_audit_wallet_tx AFTER INSERT OR UPDATE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.enhanced_audit_trigger();

-- Add audit trigger for journal_entries (new)
DROP TRIGGER IF EXISTS trg_enhanced_audit_journal ON public.journal_entries;
CREATE TRIGGER trg_enhanced_audit_journal AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.enhanced_audit_trigger();

-- Add audit trigger for credit_notes (new)
DROP TRIGGER IF EXISTS trg_enhanced_audit_credit_notes ON public.credit_notes;
CREATE TRIGGER trg_enhanced_audit_credit_notes AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.enhanced_audit_trigger();

-- Add audit trigger for report_versions
DROP TRIGGER IF EXISTS trg_enhanced_audit_reports ON public.report_versions;
CREATE TRIGGER trg_enhanced_audit_reports AFTER INSERT ON public.report_versions FOR EACH ROW EXECUTE FUNCTION public.enhanced_audit_trigger();
