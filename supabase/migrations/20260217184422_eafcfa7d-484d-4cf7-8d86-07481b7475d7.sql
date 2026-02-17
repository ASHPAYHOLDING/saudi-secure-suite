
-- ═══════════════════════════════════════════════════════════════
-- 1. ZATCA Certificates table (secure CSID storage)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE public.zatca_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  certificate_type text NOT NULL CHECK (certificate_type IN ('compliance', 'production')),
  csid text NOT NULL,
  private_key text,
  certificate text,
  request_id text,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  issued_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, certificate_type, environment)
);

ALTER TABLE public.zatca_certificates ENABLE ROW LEVEL SECURITY;

-- Only tenant owner can manage certificates
CREATE POLICY "Owner manages zatca certificates"
ON public.zatca_certificates
FOR ALL TO authenticated
USING (public.is_tenant_owner(tenant_id))
WITH CHECK (public.is_tenant_owner(tenant_id));

-- Trigger for updated_at
CREATE TRIGGER trg_updated_at_zatca_certificates
BEFORE UPDATE ON public.zatca_certificates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trail for certificate changes
CREATE OR REPLACE FUNCTION public.audit_zatca_certificate_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (NEW.tenant_id, NEW.created_by, 'create', 'zatca_certificate', NEW.id, NEW.certificate_type || '_' || NEW.environment);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      NEW.tenant_id, COALESCE(auth.uid(), NEW.created_by), 'update', 'zatca_certificate', NEW.id,
      NEW.certificate_type || '_' || NEW.environment,
      jsonb_build_object('old_active', OLD.is_active, 'new_active', NEW.is_active)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (OLD.tenant_id, COALESCE(auth.uid(), OLD.created_by), 'delete', 'zatca_certificate', OLD.id, OLD.certificate_type);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_zatca_certificates
AFTER INSERT OR UPDATE OR DELETE ON public.zatca_certificates
FOR EACH ROW EXECUTE FUNCTION public.audit_zatca_certificate_changes();

-- ═══════════════════════════════════════════════════════════════
-- 2. ZATCA Submission Log (separate immutable log)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE public.zatca_submission_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  submission_type text NOT NULL CHECK (submission_type IN ('reporting', 'clearance')),
  invoice_hash text NOT NULL,
  invoice_uuid text NOT NULL,
  request_payload jsonb,
  response_payload jsonb,
  http_status integer,
  zatca_status text,
  warnings jsonb DEFAULT '[]'::jsonb,
  errors jsonb DEFAULT '[]'::jsonb,
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zatca_submission_log ENABLE ROW LEVEL SECURITY;

-- Finance roles can view submission logs
CREATE POLICY "Finance reads zatca submissions"
ON public.zatca_submission_log
FOR SELECT TO authenticated
USING (public.is_authorized_finance(tenant_id));

-- Platform admins can view all
CREATE POLICY "Platform admins read all zatca submissions"
ON public.zatca_submission_log
FOR SELECT TO authenticated
USING (public.is_platform_admin());

-- Only system (edge functions via service role) inserts — but allow authenticated for the edge function context
CREATE POLICY "Authenticated insert zatca submissions"
ON public.zatca_submission_log
FOR INSERT TO authenticated
WITH CHECK (public.is_authorized_finance(tenant_id));

-- Make immutable
CREATE TRIGGER prevent_zatca_log_update
BEFORE UPDATE ON public.zatca_submission_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_email_log_mutation();

CREATE TRIGGER prevent_zatca_log_delete
BEFORE DELETE ON public.zatca_submission_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_email_log_mutation();

-- ═══════════════════════════════════════════════════════════════
-- 3. Migrate existing CSID data from tenants to new table
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.zatca_certificates (tenant_id, certificate_type, csid, environment, created_by)
SELECT t.id, 'compliance', t.zatca_compliance_csid,
  COALESCE(t.zatca_environment, 'sandbox'),
  t.created_by
FROM public.tenants t
WHERE t.zatca_compliance_csid IS NOT NULL AND t.zatca_compliance_csid <> '';

INSERT INTO public.zatca_certificates (tenant_id, certificate_type, csid, environment, created_by)
SELECT t.id, 'production', t.zatca_production_csid,
  COALESCE(t.zatca_environment, 'production'),
  t.created_by
FROM public.tenants t
WHERE t.zatca_production_csid IS NOT NULL AND t.zatca_production_csid <> ''
ON CONFLICT (tenant_id, certificate_type, environment) DO NOTHING;
