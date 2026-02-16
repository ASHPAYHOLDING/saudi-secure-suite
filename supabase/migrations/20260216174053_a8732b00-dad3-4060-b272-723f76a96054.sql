
-- Fix audit_invoice_changes to handle null auth.uid() (e.g. admin/system deletes)
CREATE OR REPLACE FUNCTION public.audit_invoice_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (NEW.tenant_id, NEW.created_by, 'create', 'invoice', NEW.id, NEW.invoice_number);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      NEW.tenant_id,
      COALESCE(auth.uid(), NEW.created_by),
      CASE WHEN OLD.status <> NEW.status AND NEW.status = 'cancelled' THEN 'cancel'
           WHEN OLD.status <> NEW.status AND NEW.status = 'paid' THEN 'mark_paid'
           ELSE 'update' END,
      'invoice', NEW.id, NEW.invoice_number,
      jsonb_build_object(
        'old_status', OLD.status, 'new_status', NEW.status,
        'old_total', OLD.grand_total, 'new_total', NEW.grand_total
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (OLD.tenant_id, COALESCE(auth.uid(), OLD.created_by), 'delete', 'invoice', OLD.id, OLD.invoice_number);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix audit_contract_changes similarly
CREATE OR REPLACE FUNCTION public.audit_contract_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (NEW.tenant_id, NEW.created_by, 'create', 'contract', NEW.id, NEW.contract_number);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      NEW.tenant_id,
      COALESCE(auth.uid(), NEW.created_by),
      CASE WHEN NEW.status = 'signed' AND OLD.status <> 'signed' THEN 'sign'
           ELSE 'update' END,
      'contract', NEW.id, NEW.contract_number,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (OLD.tenant_id, COALESCE(auth.uid(), OLD.created_by), 'delete', 'contract', OLD.id, OLD.contract_number);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix audit_stamp_changes similarly
CREATE OR REPLACE FUNCTION public.audit_stamp_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (OLD.stamp_enabled IS DISTINCT FROM NEW.stamp_enabled)
     OR (OLD.stamp_image_url IS DISTINCT FROM NEW.stamp_image_url)
     OR (OLD.stamp_company_name IS DISTINCT FROM NEW.stamp_company_name)
     OR (OLD.stamp_cr_number IS DISTINCT FROM NEW.stamp_cr_number)
     OR (OLD.stamp_vat_number IS DISTINCT FROM NEW.stamp_vat_number)
  THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      NEW.id,
      COALESCE(auth.uid(), NEW.created_by),
      'update',
      'stamp',
      NEW.id,
      NEW.name,
      jsonb_build_object(
        'stamp_enabled', jsonb_build_object('old', OLD.stamp_enabled, 'new', NEW.stamp_enabled),
        'stamp_company_name', jsonb_build_object('old', OLD.stamp_company_name, 'new', NEW.stamp_company_name)
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;
