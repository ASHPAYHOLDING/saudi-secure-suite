
-- Enterprise settings table
CREATE TABLE public.enterprise_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  enforce_ip_restrictions boolean NOT NULL DEFAULT false,
  password_rotation_days integer NOT NULL DEFAULT 90,
  session_timeout_minutes integer NOT NULL DEFAULT 60,
  allow_multiple_sessions boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.enterprise_settings ENABLE ROW LEVEL SECURITY;

-- Restrictive auth gate (matches existing pattern)
CREATE POLICY "auth_gate_enterprise_settings"
  ON public.enterprise_settings
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Tenant isolation: members can read
CREATE POLICY "tenant_members_read_enterprise_settings"
  ON public.enterprise_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = enterprise_settings.tenant_id
        AND tm.user_id = auth.uid()
    )
  );

-- Tenant owner can update
CREATE POLICY "tenant_owner_update_enterprise_settings"
  ON public.enterprise_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = enterprise_settings.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = enterprise_settings.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );

-- Tenant owner can insert
CREATE POLICY "tenant_owner_insert_enterprise_settings"
  ON public.enterprise_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = enterprise_settings.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );

-- Service role full access
CREATE POLICY "service_role_full_enterprise_settings"
  ON public.enterprise_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at trigger
CREATE TRIGGER update_enterprise_settings_updated_at
  BEFORE UPDATE ON public.enterprise_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
