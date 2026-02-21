
CREATE OR REPLACE FUNCTION public.enhanced_audit_trigger()
RETURNS TRIGGER
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
  v_rec jsonb;
BEGIN
  v_user_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  IF TG_OP = 'DELETE' THEN
    v_tenant_id := OLD.tenant_id;
    v_action := 'delete';
    v_before := to_jsonb(OLD);
    v_after := NULL;
    v_changes := NULL;
    v_entity_label := COALESCE(
      v_before->>CASE TG_TABLE_NAME
        WHEN 'invoices' THEN 'invoice_number'
        WHEN 'expenses' THEN 'expense_number'
        WHEN 'journal_entries' THEN 'entry_number'
        WHEN 'subscriptions' THEN 'plan_name_ar'
        WHEN 'budgets' THEN 'name_ar'
        WHEN 'credit_notes' THEN 'credit_note_number'
        ELSE 'id'
      END,
      (OLD.id)::text
    );

    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes, before_value, after_value)
    VALUES (v_tenant_id, COALESCE(auth.uid(), OLD.created_by, v_user_id), v_action, TG_TABLE_NAME, OLD.id, v_entity_label, v_changes, v_before, v_after);
    RETURN OLD;
  END IF;

  v_tenant_id := NEW.tenant_id;
  v_rec := to_jsonb(NEW);

  v_entity_label := COALESCE(
    v_rec->>CASE TG_TABLE_NAME
      WHEN 'invoices' THEN 'invoice_number'
      WHEN 'expenses' THEN 'expense_number'
      WHEN 'journal_entries' THEN 'entry_number'
      WHEN 'subscriptions' THEN 'plan_name_ar'
      WHEN 'budgets' THEN 'name_ar'
      WHEN 'credit_notes' THEN 'credit_note_number'
      WHEN 'wallet_transactions' THEN 'reference_id'
      WHEN 'report_versions' THEN 'report_name_ar'
      ELSE 'id'
    END,
    (NEW.id)::text
  );

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_before := NULL;
    v_after := v_rec;
    v_changes := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'soft_delete';
    ELSE
      v_action := 'update';
    END IF;
    v_before := to_jsonb(OLD);
    v_after := v_rec;

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
