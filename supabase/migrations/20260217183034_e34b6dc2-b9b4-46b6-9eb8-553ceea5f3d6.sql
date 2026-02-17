
-- ❶ Make email_logs immutable (no UPDATE/DELETE allowed)
CREATE OR REPLACE FUNCTION public.prevent_email_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'سجلات البريد غير قابلة للتعديل أو الحذف (Email logs are immutable)';
END;
$$;

DROP TRIGGER IF EXISTS prevent_email_log_update ON public.email_logs;
CREATE TRIGGER prevent_email_log_update
BEFORE UPDATE ON public.email_logs
FOR EACH ROW
WHEN (OLD.status IS NOT DISTINCT FROM NEW.status AND OLD.sent_at IS NOT DISTINCT FROM NEW.sent_at AND OLD.failure_reason IS NOT DISTINCT FROM NEW.failure_reason AND OLD.retry_count IS NOT DISTINCT FROM NEW.retry_count AND OLD.last_retry_at IS NOT DISTINCT FROM NEW.last_retry_at AND OLD.provider_id IS NOT DISTINCT FROM NEW.provider_id AND OLD.provider_response IS NOT DISTINCT FROM NEW.provider_response)
EXECUTE FUNCTION public.prevent_email_log_mutation();

DROP TRIGGER IF EXISTS prevent_email_log_delete ON public.email_logs;
CREATE TRIGGER prevent_email_log_delete
BEFORE DELETE ON public.email_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_email_log_mutation();

-- ❸ Audit every resend by creating a NEW log row (never reuse old ones)
-- Add resend tracking columns
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS resend_of uuid REFERENCES public.email_logs(id);
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS resend_reason text;

-- ❹ Template change auditing (already has auto_version_email_template trigger)
-- Add audit log entry for every template change
CREATE OR REPLACE FUNCTION public.audit_email_template_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.body_html IS DISTINCT FROM NEW.body_html 
       OR OLD.subject_template IS DISTINCT FROM NEW.subject_template
       OR OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      INSERT INTO public.audit_logs (
        tenant_id, user_id, action, entity_type, entity_id, entity_label, changes
      ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        COALESCE(auth.uid(), COALESCE(NEW.updated_by, OLD.created_by, '00000000-0000-0000-0000-000000000000'::uuid)),
        'update',
        'email_template',
        NEW.id,
        NEW.name_ar,
        jsonb_build_object(
          'old_subject', OLD.subject_template,
          'new_subject', NEW.subject_template,
          'old_active', OLD.is_active,
          'new_active', NEW.is_active,
          'version', NEW.current_version
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_email_template_change ON public.email_template_definitions;
CREATE TRIGGER audit_email_template_change
AFTER UPDATE ON public.email_template_definitions
FOR EACH ROW
EXECUTE FUNCTION public.audit_email_template_changes();

-- ❺ Audit log for email resends
CREATE OR REPLACE FUNCTION public.audit_email_resend()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.resend_of IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      tenant_id, user_id, action, entity_type, entity_id, entity_label, changes
    ) VALUES (
      COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid),
      'resend',
      'email',
      NEW.id,
      NEW.subject,
      jsonb_build_object(
        'original_email_id', NEW.resend_of,
        'resend_reason', COALESCE(NEW.resend_reason, ''),
        'recipient', NEW.recipient_email,
        'email_type', NEW.email_type
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_email_resend_trigger ON public.email_logs;
CREATE TRIGGER audit_email_resend_trigger
AFTER INSERT ON public.email_logs
FOR EACH ROW
WHEN (NEW.resend_of IS NOT NULL)
EXECUTE FUNCTION public.audit_email_resend();

-- ❻ RLS: Tenant admins can only SELECT their own email logs (read-only)
-- Drop existing policies first
DROP POLICY IF EXISTS "Platform admins full access to email_logs" ON public.email_logs;
DROP POLICY IF EXISTS "Tenant admins read own email logs" ON public.email_logs;
DROP POLICY IF EXISTS "System insert email logs" ON public.email_logs;

-- Platform admins: full SELECT (no update/delete due to triggers)
CREATE POLICY "Platform admins read email_logs"
ON public.email_logs
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

-- Platform admins can insert (for resends)
CREATE POLICY "Platform admins insert email_logs"
ON public.email_logs
FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

-- Tenant admins: read-only on their own tenant's logs
CREATE POLICY "Tenant admins read own email logs"
ON public.email_logs
FOR SELECT
TO authenticated
USING (
  tenant_id IS NOT NULL 
  AND public.is_tenant_admin(tenant_id)
);

-- Tenant email templates: tenant admins can only read
DROP POLICY IF EXISTS "Tenant admins read templates" ON public.tenant_email_templates;
CREATE POLICY "Tenant admins read own templates"
ON public.tenant_email_templates
FOR SELECT
TO authenticated
USING (public.is_tenant_admin(tenant_id));

-- Only platform admins can modify platform templates
DROP POLICY IF EXISTS "Platform admins manage templates" ON public.email_template_definitions;
CREATE POLICY "Platform admins manage email templates"
ON public.email_template_definitions
FOR ALL
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- Everyone can read active templates (needed by trigger functions)
CREATE POLICY "Read active email templates"
ON public.email_template_definitions
FOR SELECT
TO authenticated
USING (is_active = true);
