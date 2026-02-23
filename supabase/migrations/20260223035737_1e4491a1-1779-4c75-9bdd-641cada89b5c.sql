-- Create UUID overload for check_subscription_integrity
CREATE OR REPLACE FUNCTION public.check_subscription_integrity(_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.check_subscription_integrity(_tenant_id::text);
$$;