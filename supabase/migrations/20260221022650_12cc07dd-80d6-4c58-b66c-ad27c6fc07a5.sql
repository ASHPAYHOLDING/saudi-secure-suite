
-- Function: is_enterprise_tenant
-- Returns TRUE if the given tenant is on an enterprise plan.
-- Called by secure-rpc to gate enterprise-only RPCs.
CREATE OR REPLACE FUNCTION public.is_enterprise_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM subscriptions s
    WHERE s.tenant_id = p_tenant_id
      AND s.status = 'active'
      AND s.plan_id IN (
        SELECT id FROM subscription_plans WHERE slug = 'enterprise'
      )
  );
$$;

-- Revoke from public/anon/authenticated, grant only to service_role
REVOKE EXECUTE ON FUNCTION public.is_enterprise_tenant(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_enterprise_tenant(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_enterprise_tenant(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_enterprise_tenant(uuid) TO service_role;
