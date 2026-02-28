
-- Add trial columns to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_status TEXT NOT NULL DEFAULT 'none';

-- Index for trial expiry lookups
CREATE INDEX IF NOT EXISTS idx_tenants_trial_status ON public.tenants(trial_status) WHERE trial_status != 'none';
CREATE INDEX IF NOT EXISTS idx_tenants_trial_ends_at ON public.tenants(trial_ends_at) WHERE trial_ends_at IS NOT NULL;

-- Function to initialize trial on new tenant creation
CREATE OR REPLACE FUNCTION public.init_tenant_trial()
RETURNS TRIGGER AS $$
BEGIN
  -- Set 14-day trial for new tenants
  IF NEW.trial_ends_at IS NULL AND NEW.trial_status = 'none' THEN
    NEW.trial_ends_at := now() + INTERVAL '14 days';
    NEW.trial_status := 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on tenant insert
DROP TRIGGER IF EXISTS trg_init_tenant_trial ON public.tenants;
CREATE TRIGGER trg_init_tenant_trial
  BEFORE INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.init_tenant_trial();

-- Function to check and expire trials (called by cron)
CREATE OR REPLACE FUNCTION public.expire_stale_trials()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.tenants
  SET trial_status = 'expired'
  WHERE trial_status = 'active'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < now();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke from public roles
REVOKE EXECUTE ON FUNCTION public.init_tenant_trial() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.init_tenant_trial() TO service_role, postgres;

REVOKE EXECUTE ON FUNCTION public.expire_stale_trials() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_trials() TO service_role, postgres;
