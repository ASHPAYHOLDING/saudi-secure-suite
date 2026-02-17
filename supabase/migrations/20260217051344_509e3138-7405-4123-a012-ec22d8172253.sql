-- Add readiness guard columns
ALTER TABLE public.paid_integrations
  ADD COLUMN IF NOT EXISTS has_service boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_api_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_test_connection boolean NOT NULL DEFAULT false;

-- Trigger: is_ready can ONLY be true when all 3 flags are true
CREATE OR REPLACE FUNCTION public.validate_integration_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If trying to set is_ready = true, all 3 must be true
  IF NEW.is_ready = true THEN
    IF NOT (NEW.has_service AND NEW.has_api_client AND NEW.has_test_connection) THEN
      RAISE EXCEPTION 'Cannot set is_ready=true: has_service=%, has_api_client=%, has_test_connection=% — all must be true',
        NEW.has_service, NEW.has_api_client, NEW.has_test_connection;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_integration_readiness ON public.paid_integrations;
CREATE TRIGGER trg_validate_integration_readiness
  BEFORE INSERT OR UPDATE ON public.paid_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_integration_readiness();

-- Backend guard: prevent activating non-ready integrations
CREATE OR REPLACE FUNCTION public.validate_tenant_integration_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_ready boolean;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT is_ready INTO _is_ready
    FROM public.paid_integrations
    WHERE id = NEW.integration_id;

    IF NOT COALESCE(_is_ready, false) THEN
      RAISE EXCEPTION 'Cannot activate integration: is_ready=false for integration_id=%', NEW.integration_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_tenant_integration_activation ON public.tenant_paid_integrations;
CREATE TRIGGER trg_validate_tenant_integration_activation
  BEFORE INSERT OR UPDATE ON public.tenant_paid_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tenant_integration_activation();

-- Set the 3 flags for integrations that actually have backends
UPDATE public.paid_integrations SET has_service = true, has_api_client = true, has_test_connection = true
WHERE key IN ('pay_tap', 'pay_hyperpay', 'pay_moyasar');

UPDATE public.paid_integrations SET has_service = true, has_api_client = false, has_test_connection = false
WHERE key = 'accounting_advanced';

COMMENT ON COLUMN public.paid_integrations.has_service IS 'Integration has a real backend service implementation';
COMMENT ON COLUMN public.paid_integrations.has_api_client IS 'Integration has a real API client (edge function or SDK)';
COMMENT ON COLUMN public.paid_integrations.has_test_connection IS 'Integration has a working connection test endpoint';