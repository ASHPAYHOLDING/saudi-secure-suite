-- Remove expires_at and cancelled_at columns (not needed for one-time payment model)
ALTER TABLE public.tenant_paid_integrations DROP COLUMN IF EXISTS expires_at;
ALTER TABLE public.tenant_paid_integrations DROP COLUMN IF EXISTS cancelled_at;

-- Add comment documenting the one-time payment model
COMMENT ON TABLE public.tenant_paid_integrations IS 'One-time payment model only. No recurring billing. status: active | disabled. activation_source: purchase | admin_override.';