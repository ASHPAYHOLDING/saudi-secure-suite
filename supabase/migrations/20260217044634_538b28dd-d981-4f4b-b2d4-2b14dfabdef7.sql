-- Add trial and plan assignment fields to paid_integrations
ALTER TABLE public.paid_integrations
  ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS included_in_plans text[] NOT NULL DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.paid_integrations.trial_days IS 'Number of free trial days (0 = no trial)';
COMMENT ON COLUMN public.paid_integrations.included_in_plans IS 'Plan slugs that include this integration for free (e.g. {professional, enterprise})';