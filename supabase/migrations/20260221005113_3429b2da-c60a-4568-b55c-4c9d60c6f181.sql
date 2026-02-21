
-- tenant_sso_settings
CREATE TABLE public.tenant_sso_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('saml', 'oidc')),
  issuer TEXT,
  entry_point TEXT,
  cert TEXT,
  client_id TEXT,
  client_secret_encrypted TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.tenant_sso_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_sso_settings_select" ON public.tenant_sso_settings
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "tenant_sso_settings_insert" ON public.tenant_sso_settings
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "tenant_sso_settings_update" ON public.tenant_sso_settings
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "tenant_sso_settings_delete" ON public.tenant_sso_settings
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- Restrictive auth gate
CREATE POLICY "auth_gate_tenant_sso_settings" ON public.tenant_sso_settings
  AS RESTRICTIVE FOR ALL TO anon USING (false);

-- sso_domains
CREATE TABLE public.sso_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(domain)
);

ALTER TABLE public.sso_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sso_domains_select" ON public.sso_domains
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "sso_domains_insert" ON public.sso_domains
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "sso_domains_update" ON public.sso_domains
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "sso_domains_delete" ON public.sso_domains
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "auth_gate_sso_domains" ON public.sso_domains
  AS RESTRICTIVE FOR ALL TO anon USING (false);

-- Public lookup function for sso-init (no auth needed, returns minimal info)
CREATE OR REPLACE FUNCTION public.lookup_sso_by_domain(p_domain TEXT)
RETURNS TABLE(tenant_id UUID, provider_type TEXT, issuer TEXT, entry_point TEXT, client_id TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.tenant_id, s.provider_type, s.issuer, s.entry_point, s.client_id
  FROM tenant_sso_settings s
  JOIN sso_domains d ON d.tenant_id = s.tenant_id
  WHERE d.domain = p_domain
    AND d.is_verified = true
    AND s.enabled = true
  LIMIT 1;
$$;

-- Revoke public access, grant to service_role only
REVOKE EXECUTE ON FUNCTION public.lookup_sso_by_domain FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_sso_by_domain TO service_role;

-- Index for domain lookup
CREATE INDEX idx_sso_domains_domain ON public.sso_domains(domain) WHERE is_verified = true;
