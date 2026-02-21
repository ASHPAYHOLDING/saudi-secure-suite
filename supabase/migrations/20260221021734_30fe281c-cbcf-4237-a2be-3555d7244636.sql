
-- IP allowlist table
CREATE TABLE public.enterprise_allowed_ips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  label TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ip_address)
);

CREATE INDEX idx_enterprise_allowed_ips_tenant ON public.enterprise_allowed_ips(tenant_id);

ALTER TABLE public.enterprise_allowed_ips ENABLE ROW LEVEL SECURITY;

-- Auth gate
CREATE POLICY "auth_gate_enterprise_allowed_ips"
  ON public.enterprise_allowed_ips AS RESTRICTIVE
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Tenant members can view
CREATE POLICY "Tenant members can view allowed IPs"
  ON public.enterprise_allowed_ips FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- Owners can insert
CREATE POLICY "Owners can add allowed IPs"
  ON public.enterprise_allowed_ips FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'owner'));

-- Owners can delete
CREATE POLICY "Owners can remove allowed IPs"
  ON public.enterprise_allowed_ips FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'owner'));

-- Audit trigger for IP changes
CREATE OR REPLACE FUNCTION public.audit_ip_allowlist_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, entity_type, entity_id, action, after_value, entity_label)
    VALUES (NEW.tenant_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'), 'enterprise_allowed_ips', NEW.id, 'ip_added', jsonb_build_object('ip_address', NEW.ip_address, 'label', NEW.label), 'إضافة عنوان IP مسموح');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, entity_type, entity_id, action, before_value, entity_label)
    VALUES (OLD.tenant_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'), 'enterprise_allowed_ips', OLD.id, 'ip_removed', jsonb_build_object('ip_address', OLD.ip_address, 'label', OLD.label), 'حذف عنوان IP مسموح');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_ip_allowlist
  AFTER INSERT OR DELETE ON public.enterprise_allowed_ips
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_ip_allowlist_change();

-- IP check function for edge function use (service_role only)
CREATE OR REPLACE FUNCTION public.check_ip_allowed(p_tenant_id UUID, p_ip TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  enforce BOOLEAN;
  ip_exists BOOLEAN;
BEGIN
  SELECT enforce_ip_restrictions INTO enforce
  FROM public.enterprise_settings
  WHERE tenant_id = p_tenant_id;

  IF enforce IS NOT TRUE THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.enterprise_allowed_ips
    WHERE tenant_id = p_tenant_id AND ip_address = p_ip
  ) INTO ip_exists;

  RETURN ip_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.check_ip_allowed(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ip_allowed(UUID, TEXT) TO service_role;
