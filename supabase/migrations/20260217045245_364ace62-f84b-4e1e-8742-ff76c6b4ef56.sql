
-- Rename existing columns to match new schema
ALTER TABLE public.paid_integrations
  RENAME COLUMN monthly_price TO price_once;

ALTER TABLE public.paid_integrations
  RENAME COLUMN is_available TO is_listed;

ALTER TABLE public.paid_integrations
  RENAME COLUMN requires_api_key TO requires_api_keys;

ALTER TABLE public.paid_integrations
  RENAME COLUMN category TO integration_type;

-- Add is_ready column
ALTER TABLE public.paid_integrations
  ADD COLUMN IF NOT EXISTS is_ready boolean NOT NULL DEFAULT false;

-- Comments
COMMENT ON COLUMN public.paid_integrations.price_once IS 'One-time price for the integration';
COMMENT ON COLUMN public.paid_integrations.is_ready IS 'Whether the integration is technically ready for use';
COMMENT ON COLUMN public.paid_integrations.is_listed IS 'Whether the integration is visible for purchase';
COMMENT ON COLUMN public.paid_integrations.requires_api_keys IS 'Whether the integration requires API keys from the tenant';
COMMENT ON COLUMN public.paid_integrations.integration_type IS 'Type: payment | whatsapp | accounting | sms | other';
