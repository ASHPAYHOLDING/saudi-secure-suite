
-- RPC: audit_rls_status
-- Returns RLS status for all public tables
-- SECURITY DEFINER so it can read pg_catalog with elevated rights
-- Only callable by platform admins (checked inside)

CREATE OR REPLACE FUNCTION public.audit_rls_status()
RETURNS TABLE(
  table_name text,
  is_rls_enabled boolean,
  has_policies boolean,
  policy_count integer,
  has_always_true_write_policy boolean,
  is_partition boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Restrict to platform admins
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied: platform admin required';
  END IF;

  RETURN QUERY
  SELECT
    c.relname::text AS table_name,
    c.relrowsecurity AS is_rls_enabled,
    COALESCE(pol_agg.cnt, 0) > 0 AS has_policies,
    COALESCE(pol_agg.cnt, 0)::integer AS policy_count,
    COALESCE(pol_agg.has_true_write, false) AS has_always_true_write_policy,
    c.relispartition AS is_partition
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN LATERAL (
    SELECT
      count(*)::integer AS cnt,
      bool_or(
        p.polcmd IN ('w', 'a', 'd') -- write / insert / delete
        AND (
          pg_get_expr(p.polqual, p.polrelid) IN ('true', '(true)')
          OR pg_get_expr(p.polwithcheck, p.polrelid) IN ('true', '(true)')
        )
        AND NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_roles r
          WHERE r.oid = ANY(p.polroles)
          AND r.rolname IN ('service_role', 'supabase_admin')
        )
      ) AS has_true_write
    FROM pg_catalog.pg_policy p
    WHERE p.polrelid = c.oid
  ) pol_agg ON true
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p') -- regular tables and partitioned tables
  ORDER BY c.relrowsecurity ASC, c.relname;
END;
$$;

-- Revoke from public/anon, grant only to authenticated (admin check is inside)
REVOKE ALL ON FUNCTION public.audit_rls_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_rls_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.audit_rls_status() TO authenticated;
