
-- AI usage tracking table for monthly query limits
CREATE TABLE IF NOT EXISTS public.ai_usage_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  query_type TEXT NOT NULL DEFAULT 'general',
  query_text TEXT,
  tokens_used INT DEFAULT 0,
  period_month INT NOT NULL,
  period_year INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast monthly count lookups
CREATE INDEX idx_ai_usage_tenant_period ON public.ai_usage_tracking(tenant_id, period_year, period_month);

-- Enable RLS
ALTER TABLE public.ai_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tenant's AI usage
CREATE POLICY "Users can view own tenant AI usage"
  ON public.ai_usage_tracking FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Users can insert their own AI usage records
CREATE POLICY "Users can insert own AI usage"
  ON public.ai_usage_tracking FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ) AND user_id = auth.uid());

-- Helper function to check AI quota
CREATE OR REPLACE FUNCTION public.check_ai_quota(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE
  _ai_level INT;
  _monthly_limit INT;
  _current_count INT;
  _current_month INT := EXTRACT(MONTH FROM now())::int;
  _current_year INT := EXTRACT(YEAR FROM now())::int;
BEGIN
  -- Get AI level from entitlements cache
  SELECT COALESCE((entitlements -> 'ai_accounting' ->> 'limit')::int, 0)
  INTO _ai_level
  FROM public.tenant_entitlements_cache
  WHERE tenant_id = p_tenant_id;

  -- Determine monthly limit based on AI level
  _monthly_limit := CASE
    WHEN _ai_level = 0 THEN 0
    WHEN _ai_level = 1 THEN 50
    WHEN _ai_level >= 2 THEN 999999 -- effectively unlimited
    ELSE 0
  END;

  -- Count current month usage
  SELECT COUNT(*)
  INTO _current_count
  FROM public.ai_usage_tracking
  WHERE tenant_id = p_tenant_id
    AND period_year = _current_year
    AND period_month = _current_month;

  RETURN json_build_object(
    'ai_level', _ai_level,
    'monthly_limit', _monthly_limit,
    'current_count', _current_count,
    'remaining', GREATEST(0, _monthly_limit - _current_count),
    'allowed', _current_count < _monthly_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
