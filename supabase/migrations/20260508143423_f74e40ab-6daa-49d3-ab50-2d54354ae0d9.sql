
CREATE OR REPLACE FUNCTION public.audit_tenant_isolation()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'table', c.relname,
    'rls_enabled', c.relrowsecurity,
    'policy_count', (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname)
  )), '[]'::jsonb)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns col
      WHERE col.table_schema='public' AND col.table_name=c.relname AND col.column_name='tenant_id'
    )
    AND (
      NOT c.relrowsecurity
      OR NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.audit_tenant_isolation() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.audit_tenant_isolation() TO service_role;
