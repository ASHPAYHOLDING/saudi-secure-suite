
-- Drop the old function and recreate with text parameter
DROP FUNCTION IF EXISTS public.check_subscription_integrity(uuid);

CREATE OR REPLACE FUNCTION public.check_subscription_integrity(_tenant_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tid uuid := _tenant_id::uuid;
  _sub record;
  _plan record;
  _result jsonb := '{}';
  _fixes text[] := '{}';
BEGIN
  -- Get active subscription
  SELECT s.*, sp.slug as plan_slug, sp.id as sp_id
  INTO _sub
  FROM subscriptions s
  JOIN subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = _tid
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF _sub IS NULL THEN
    RETURN jsonb_build_object('status', 'no_subscription', 'fixes', _fixes);
  END IF;

  _result := jsonb_build_object(
    'subscription_id', _sub.id,
    'plan_slug', _sub.plan_slug,
    'status', _sub.status,
    'current_period_end', _sub.current_period_end,
    'fixes', _fixes
  );

  RETURN _result;
END;
$$;

-- Ensure only service_role can execute
REVOKE ALL ON FUNCTION public.check_subscription_integrity(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_subscription_integrity(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.check_subscription_integrity(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_subscription_integrity(text) TO service_role;
