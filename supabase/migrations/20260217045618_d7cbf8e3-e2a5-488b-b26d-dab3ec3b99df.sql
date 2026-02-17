
-- Add purchased_at and activation_source columns
ALTER TABLE public.tenant_paid_integrations
  ADD COLUMN IF NOT EXISTS purchased_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS activation_source text NOT NULL DEFAULT 'purchase';

-- Update status default to match new enum
ALTER TABLE public.tenant_paid_integrations
  ALTER COLUMN status SET DEFAULT 'active';

COMMENT ON COLUMN public.tenant_paid_integrations.status IS 'active | disabled';
COMMENT ON COLUMN public.tenant_paid_integrations.purchased_at IS 'When the integration was purchased';
COMMENT ON COLUMN public.tenant_paid_integrations.activation_source IS 'purchase | admin_override';
