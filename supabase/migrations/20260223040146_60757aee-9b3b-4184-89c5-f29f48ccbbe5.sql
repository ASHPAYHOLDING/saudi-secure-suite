-- Drop the text overload that causes ambiguity
DROP FUNCTION IF EXISTS public.check_subscription_integrity(text);

-- Recreate as UUID-only function with full logic
CREATE OR REPLACE FUNCTION public.check_subscription_integrity(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sub record;
  _result jsonb := '{}';
  _fixes text[] := '{}';
BEGIN
  SELECT s.*, sp.slug as plan_slug, sp.id as sp_id
  INTO _sub
  FROM subscriptions s
  JOIN subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = _tenant_id
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