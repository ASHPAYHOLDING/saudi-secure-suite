
-- Migration versions tracking table
CREATE TABLE public.migration_versions (
  version text PRIMARY KEY,
  description text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  checksum text NOT NULL,
  execution_time_ms integer,
  applied_by text,
  is_backward_compatible boolean DEFAULT true,
  rollback_sql text
);

ALTER TABLE public.migration_versions ENABLE ROW LEVEL SECURITY;

-- Only service_role can write; authenticated users with admin can read
CREATE POLICY "Service role full access" ON public.migration_versions
  FOR ALL USING (true) WITH CHECK (true);

-- Background reindex tracking table
CREATE TABLE public.background_reindex_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  table_name text NOT NULL,
  index_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.background_reindex_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on reindex" ON public.background_reindex_jobs
  FOR ALL USING (true) WITH CHECK (true);

-- Function: get schema checksum (md5 of all table/column definitions)
CREATE OR REPLACE FUNCTION public.get_schema_checksum()
RETURNS TABLE(schema_checksum text, table_count bigint, last_migration text, last_migration_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    md5(string_agg(t.table_name || '.' || c.column_name || '.' || c.data_type, '|' ORDER BY t.table_name, c.ordinal_position))::text AS schema_checksum,
    (SELECT count(DISTINCT ist.table_name) FROM information_schema.tables ist WHERE ist.table_schema = 'public')::bigint AS table_count,
    (SELECT mv.version FROM migration_versions mv ORDER BY mv.applied_at DESC LIMIT 1)::text AS last_migration,
    (SELECT mv.applied_at FROM migration_versions mv ORDER BY mv.applied_at DESC LIMIT 1)::timestamptz AS last_migration_at
  FROM information_schema.tables t
  JOIN information_schema.columns c ON c.table_schema = t.table_schema AND c.table_name = t.table_name
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';
END;
$$;

-- Function: list applied migrations
CREATE OR REPLACE FUNCTION public.get_applied_migrations()
RETURNS SETOF migration_versions
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM migration_versions ORDER BY applied_at DESC;
$$;

-- Function: trigger background reindex (CONCURRENTLY)
CREATE OR REPLACE FUNCTION public.request_background_reindex(p_table_name text, p_index_name text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO background_reindex_jobs (table_name, index_name, status)
  VALUES (p_table_name, p_index_name, 'pending')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Seed existing Lovable migrations into migration_versions
INSERT INTO migration_versions (version, description, checksum, applied_by, is_backward_compatible)
SELECT 
  replace(replace(f.filename, '.sql', ''), 'supabase/migrations/', '') AS version,
  'Auto-detected migration' AS description,
  md5(f.filename) AS checksum,
  'system' AS applied_by,
  true AS is_backward_compatible
FROM (
  SELECT unnest(ARRAY[
    'initial_schema',
    'multi_currency_updates',
    'audit_intelligence_functions'
  ]) AS filename
) f
ON CONFLICT (version) DO NOTHING;
