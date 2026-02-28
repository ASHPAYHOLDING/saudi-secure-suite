
-- Onboarding state tracking per tenant + user
CREATE TABLE public.onboarding_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 1,
  completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  step_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onboarding state"
  ON public.onboarding_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding state"
  ON public.onboarding_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding state"
  ON public.onboarding_state FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_onboarding_state_updated_at
  BEFORE UPDATE ON public.onboarding_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_onboarding_state_tenant_user ON public.onboarding_state(tenant_id, user_id);
