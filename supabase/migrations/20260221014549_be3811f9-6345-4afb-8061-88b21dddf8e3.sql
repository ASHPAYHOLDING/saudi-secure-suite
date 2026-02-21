
-- Create RPC function for RLS audit (read-only, safe for authenticated users)
CREATE OR REPLACE FUNCTION public.get_rls_audit()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Only platform admins can run this
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.tablename)
  INTO v_result
  FROM (
    SELECT 
      c.relname AS tablename,
      c.relrowsecurity AS rls_enabled,
      COALESCE(pol.cnt, 0) AS policy_count,
      COALESCE(pol.has_select, false) AS has_select,
      COALESCE(pol.has_insert, false) AS has_insert,
      COALESCE(pol.has_update, false) AS has_update,
      COALESCE(pol.has_delete, false) AS has_delete,
      COALESCE(pol.has_auth_gate, false) AS has_auth_gate,
      COALESCE(pol.warnings, '[]'::jsonb) AS warnings
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN LATERAL (
      SELECT 
        count(*)::int AS cnt,
        bool_or(p.cmd = 'r' OR p.polcmd = '*') AS has_select,
        bool_or(p.polcmd = 'a' OR p.polcmd = '*') AS has_insert,
        bool_or(p.polcmd = 'w' OR p.polcmd = '*') AS has_update,
        bool_or(p.polcmd = 'd' OR p.polcmd = '*') AS has_delete,
        bool_or(p.polname LIKE '%require_auth%' OR p.polname LIKE '%auth_gate%' OR p.polname LIKE '%block_anon%') AS has_auth_gate,
        jsonb_agg(
          CASE 
            WHEN c.relrowsecurity AND count(*) OVER () = 0 THEN 'RLS enabled, no policies'
            WHEN p.polcmd IN ('a','w','d','*') 
              AND p.polpermissive = true
              AND (p.polqual::text = 'true' OR p.polwithcheck::text = 'true')
              AND NOT (p.polroles @> ARRAY[(SELECT oid FROM pg_roles WHERE rolname = 'service_role')]::oid[])
            THEN 'USING(true) on write for non-service_role: ' || p.polname
            ELSE NULL
          END
        ) FILTER (WHERE 
          (c.relrowsecurity AND count(*) OVER () = 0)
          OR (p.polcmd IN ('a','w','d','*') 
              AND p.polpermissive = true
              AND (p.polqual::text = 'true' OR p.polwithcheck::text = 'true')
              AND NOT (p.polroles @> ARRAY[(SELECT oid FROM pg_roles WHERE rolname = 'service_role')]::oid[]))
        ) AS warnings
      FROM pg_policy p
      WHERE p.polrelid = c.oid
      GROUP BY p.polrelid
    ) pol ON true
    WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    ORDER BY c.relname
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Grant execute to service_role only
REVOKE ALL ON FUNCTION public.get_rls_audit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_rls_audit() FROM anon;
REVOKE ALL ON FUNCTION public.get_rls_audit() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_rls_audit() TO service_role;
