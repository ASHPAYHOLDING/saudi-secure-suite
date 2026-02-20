-- Ensure tenant_payment_providers supports new providers
-- The provider column is text so no enum change needed.
-- Add environment column if missing, add fees columns if missing.

ALTER TABLE public.tenant_payment_providers
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS fees_percentage numeric(10,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fees_fixed numeric(10,4) NOT NULL DEFAULT 0;

-- Ensure UNIQUE constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenant_payment_providers_tenant_id_provider_key'
  ) THEN
    ALTER TABLE public.tenant_payment_providers
      ADD CONSTRAINT tenant_payment_providers_tenant_id_provider_key
      UNIQUE (tenant_id, provider);
  END IF;
END $$;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_tenant_payment_providers_tenant_provider_status
  ON public.tenant_payment_providers (tenant_id, provider, status);