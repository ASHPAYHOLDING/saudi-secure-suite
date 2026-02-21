
-- Single RPC to fetch all permission keys for a user in a tenant
-- Eliminates the N+1 pattern (2 separate queries → 1 join)
CREATE OR REPLACE FUNCTION public.get_my_permissions(
  p_user_id TEXT,
  p_tenant_id TEXT
)
RETURNS SETOF TEXT AS $$
DECLARE
  _uid UUID := p_user_id::uuid;
  _tid UUID := p_tenant_id::uuid;
BEGIN
  RETURN QUERY
  SELECT DISTINCT rp.permission_key::text
  FROM public.tenant_members tm
  JOIN public.custom_roles cr
    ON cr.tenant_id = _tid
    AND cr.base_role = tm.role
  JOIN public.role_permissions rp
    ON rp.role_id = cr.id
    AND rp.tenant_id = _tid
  WHERE tm.user_id = _uid
    AND tm.tenant_id = _tid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Restrict to authenticated users only (no anon)
REVOKE EXECUTE ON FUNCTION public.get_my_permissions FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_permissions TO authenticated, service_role;
