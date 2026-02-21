
-- Add auto-provisioning columns to tenant_sso_settings
ALTER TABLE public.tenant_sso_settings
  ADD COLUMN default_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL,
  ADD COLUMN auto_provisioning_enabled BOOLEAN NOT NULL DEFAULT true;
