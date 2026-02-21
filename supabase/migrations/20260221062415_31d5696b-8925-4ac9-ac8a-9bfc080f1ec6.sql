
DROP FUNCTION IF EXISTS public.audit_rls_status();

CREATE OR REPLACE FUNCTION public.audit_rls_status()
RETURNS TABLE(table_name text, is_rls_enabled boolean, policy_count bigint, is_partition boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.relname::text AS table_name,
    c.relrowsecurity AS is_rls_enabled,
    (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname = 'public') AS policy_count,
    c.relispartition AS is_partition
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND (SELECT is_platform_admin());
$$;
