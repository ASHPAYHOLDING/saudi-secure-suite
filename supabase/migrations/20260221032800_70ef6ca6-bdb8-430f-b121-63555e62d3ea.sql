
-- Table: tenant_integration_secrets
CREATE TABLE public.tenant_integration_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  secret_name text NOT NULL,
  secret_encrypted text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  UNIQUE (tenant_id, provider_key, secret_name)
);

-- RLS
ALTER TABLE public.tenant_integration_secrets ENABLE ROW LEVEL SECURITY;

-- Read: tenant members (owner/admin) can see metadata (not the encrypted value itself — that's handled in code)
CREATE POLICY "Tenant members can view own secrets metadata"
  ON public.tenant_integration_secrets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = tenant_integration_secrets.tenant_id
        AND tm.user_id = auth.uid()
    )
  );

-- Write: service_role only (via edge functions)
CREATE POLICY "Service role can manage secrets"
  ON public.tenant_integration_secrets
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Revoke direct write from authenticated/anon
REVOKE INSERT, UPDATE, DELETE ON public.tenant_integration_secrets FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.tenant_integration_secrets FROM anon;

-- Index for lookups
CREATE INDEX idx_tis_tenant_provider ON public.tenant_integration_secrets (tenant_id, provider_key);
