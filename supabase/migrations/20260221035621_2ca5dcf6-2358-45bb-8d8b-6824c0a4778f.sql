
-- ============================================================
-- TABLE PARTITIONING: audit_logs, webhook_events, production_metrics
-- Strategy: range partition by month on created_at
-- ============================================================

-- ── 1. AUDIT_LOGS ──────────────────────────────────────────

-- 1a. Rename old table
ALTER TABLE public.audit_logs RENAME TO audit_logs_old;

-- 1b. Drop old indexes (will recreate on partitioned table)
DROP INDEX IF EXISTS idx_audit_logs_tenant;
DROP INDEX IF EXISTS idx_audit_logs_entity;
DROP INDEX IF EXISTS idx_audit_logs_created;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_user;
DROP INDEX IF EXISTS idx_audit_logs_correlation;
DROP INDEX IF EXISTS idx_audit_logs_tenant_created;

-- 1c. Drop old RLS policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs_old;
DROP POLICY IF EXISTS "Deny all deletes on audit_logs" ON public.audit_logs_old;
DROP POLICY IF EXISTS "Deny all updates on audit_logs" ON public.audit_logs_old;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs_old;
DROP POLICY IF EXISTS "require_auth" ON public.audit_logs_old;

-- 1d. Create partitioned table
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  changes jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  before_value jsonb,
  after_value jsonb,
  correlation_id text,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 1e. Create initial partitions (past 6 months + current + next 2)
CREATE TABLE public.audit_logs_y2025m08 PARTITION OF public.audit_logs FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE public.audit_logs_y2025m09 PARTITION OF public.audit_logs FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE public.audit_logs_y2025m10 PARTITION OF public.audit_logs FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE public.audit_logs_y2025m11 PARTITION OF public.audit_logs FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE public.audit_logs_y2025m12 PARTITION OF public.audit_logs FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE public.audit_logs_y2026m01 PARTITION OF public.audit_logs FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE public.audit_logs_y2026m02 PARTITION OF public.audit_logs FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE public.audit_logs_y2026m03 PARTITION OF public.audit_logs FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE public.audit_logs_y2026m04 PARTITION OF public.audit_logs FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- 1f. Copy data
INSERT INTO public.audit_logs SELECT * FROM public.audit_logs_old;

-- 1g. Drop old table
DROP TABLE public.audit_logs_old;

-- 1h. Recreate indexes
CREATE INDEX idx_audit_logs_tenant ON public.audit_logs (tenant_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX idx_audit_logs_user ON public.audit_logs (user_id);
CREATE INDEX idx_audit_logs_correlation ON public.audit_logs (correlation_id);
CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs (tenant_id, created_at DESC);

-- 1i. Enable RLS and recreate policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (is_tenant_admin(tenant_id));

CREATE POLICY "Deny all deletes on audit_logs" ON public.audit_logs
  FOR DELETE USING (false);

CREATE POLICY "Deny all updates on audit_logs" ON public.audit_logs
  FOR UPDATE USING (false);

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "require_auth" ON public.audit_logs
  AS RESTRICTIVE FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);


-- ── 2. WEBHOOK_EVENTS ──────────────────────────────────────

ALTER TABLE public.webhook_events RENAME TO webhook_events_old;

DROP INDEX IF EXISTS idx_webhook_events_provider_event;
DROP INDEX IF EXISTS idx_webhook_events_tenant;
DROP INDEX IF EXISTS idx_webhook_events_created;
DROP INDEX IF EXISTS idx_webhook_events_tenant_timeline;
DROP INDEX IF EXISTS idx_webhook_events_status;
DROP INDEX IF EXISTS idx_webhook_events_provider;
DROP INDEX IF EXISTS idx_webhook_events_tenant_status;

DROP POLICY IF EXISTS "Platform admins can read webhook_events" ON public.webhook_events_old;
DROP POLICY IF EXISTS "Service role can insert webhook_events" ON public.webhook_events_old;
DROP POLICY IF EXISTS "Tenant members can read own webhook_events" ON public.webhook_events_old;
DROP POLICY IF EXISTS "webhook_events_auth_gate" ON public.webhook_events_old;

CREATE TABLE public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  tenant_id uuid,
  payload jsonb,
  provider_response jsonb,
  status text NOT NULL DEFAULT 'processing'::text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  provider_event_id text DEFAULT ''::text,
  signature_valid boolean,
  payload_hash text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_error text,
  raw_headers jsonb,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE public.webhook_events_y2025m08 PARTITION OF public.webhook_events FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE public.webhook_events_y2025m09 PARTITION OF public.webhook_events FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE public.webhook_events_y2025m10 PARTITION OF public.webhook_events FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE public.webhook_events_y2025m11 PARTITION OF public.webhook_events FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE public.webhook_events_y2025m12 PARTITION OF public.webhook_events FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE public.webhook_events_y2026m01 PARTITION OF public.webhook_events FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE public.webhook_events_y2026m02 PARTITION OF public.webhook_events FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE public.webhook_events_y2026m03 PARTITION OF public.webhook_events FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE public.webhook_events_y2026m04 PARTITION OF public.webhook_events FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

INSERT INTO public.webhook_events SELECT * FROM public.webhook_events_old;
DROP TABLE public.webhook_events_old;

-- Recreate unique constraint (needs partition key)
CREATE UNIQUE INDEX webhook_events_provider_event_unique ON public.webhook_events (provider, event_id, created_at);
CREATE UNIQUE INDEX webhook_events_provider_event_id_unique ON public.webhook_events (provider, provider_event_id, created_at);
CREATE INDEX idx_webhook_events_provider_event ON public.webhook_events (provider, event_id);
CREATE INDEX idx_webhook_events_tenant ON public.webhook_events (tenant_id);
CREATE INDEX idx_webhook_events_created ON public.webhook_events (created_at DESC);
CREATE INDEX idx_webhook_events_tenant_timeline ON public.webhook_events (tenant_id, received_at DESC);
CREATE INDEX idx_webhook_events_status ON public.webhook_events (status, received_at DESC);
CREATE INDEX idx_webhook_events_provider ON public.webhook_events (provider, received_at DESC);
CREATE INDEX idx_webhook_events_tenant_status ON public.webhook_events (tenant_id, status);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read webhook_events" ON public.webhook_events
  FOR SELECT TO authenticated USING (is_platform_admin());

CREATE POLICY "Service role can insert webhook_events" ON public.webhook_events
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Tenant members can read own webhook_events" ON public.webhook_events
  FOR SELECT TO authenticated USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "webhook_events_auth_gate" ON public.webhook_events
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);


-- ── 3. PRODUCTION_METRICS ──────────────────────────────────

ALTER TABLE public.production_metrics RENAME TO production_metrics_old;

DROP INDEX IF EXISTS idx_production_metrics_source_time;
DROP INDEX IF EXISTS idx_production_metrics_name_time;

DROP POLICY IF EXISTS "Platform admins can read metrics" ON public.production_metrics_old;
DROP POLICY IF EXISTS "Service role can insert metrics" ON public.production_metrics_old;

CREATE TABLE public.production_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  metric_source text NOT NULL,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL DEFAULT 0,
  tags jsonb DEFAULT '{}'::jsonb,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE public.production_metrics_y2025m08 PARTITION OF public.production_metrics FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE public.production_metrics_y2025m09 PARTITION OF public.production_metrics FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE public.production_metrics_y2025m10 PARTITION OF public.production_metrics FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE public.production_metrics_y2025m11 PARTITION OF public.production_metrics FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE public.production_metrics_y2025m12 PARTITION OF public.production_metrics FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE public.production_metrics_y2026m01 PARTITION OF public.production_metrics FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE public.production_metrics_y2026m02 PARTITION OF public.production_metrics FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE public.production_metrics_y2026m03 PARTITION OF public.production_metrics FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE public.production_metrics_y2026m04 PARTITION OF public.production_metrics FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

INSERT INTO public.production_metrics SELECT * FROM public.production_metrics_old;
DROP TABLE public.production_metrics_old;

CREATE INDEX idx_production_metrics_source_time ON public.production_metrics (metric_source, recorded_at DESC);
CREATE INDEX idx_production_metrics_name_time ON public.production_metrics (metric_name, recorded_at DESC);

ALTER TABLE public.production_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read metrics" ON public.production_metrics
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM platform_admins WHERE platform_admins.user_id = auth.uid()));

CREATE POLICY "Service role can insert metrics" ON public.production_metrics
  FOR INSERT TO service_role WITH CHECK (true);


-- ── 4. PARTITION MAINTENANCE FUNCTIONS ─────────────────────

-- 4a. Auto-create next month partitions
CREATE OR REPLACE FUNCTION public.create_next_month_partitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables text[] := ARRAY['audit_logs', 'webhook_events', 'production_metrics'];
  v_table text;
  v_start date;
  v_end date;
  v_partition_name text;
  v_month_offset int;
BEGIN
  -- Create partitions for next 2 months
  FOREACH v_table IN ARRAY v_tables LOOP
    FOR v_month_offset IN 0..2 LOOP
      v_start := date_trunc('month', now() + (v_month_offset || ' months')::interval)::date;
      v_end := (v_start + interval '1 month')::date;
      v_partition_name := v_table || '_y' || to_char(v_start, 'YYYY') || 'm' || to_char(v_start, 'MM');

      -- Check if partition already exists
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = v_partition_name
      ) THEN
        EXECUTE format(
          'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
          v_partition_name, v_table, v_start, v_end
        );
        RAISE NOTICE 'Created partition: %', v_partition_name;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- 4b. Drop old partitions (configurable retention in months)
CREATE OR REPLACE FUNCTION public.drop_old_partitions(p_retention_months int DEFAULT 12)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables text[] := ARRAY['audit_logs', 'webhook_events', 'production_metrics'];
  v_table text;
  v_cutoff date;
  v_rec record;
BEGIN
  v_cutoff := date_trunc('month', now() - (p_retention_months || ' months')::interval)::date;

  FOREACH v_table IN ARRAY v_tables LOOP
    FOR v_rec IN
      SELECT c.relname AS partition_name
      FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON n.oid = p.relnamespace
      WHERE n.nspname = 'public' AND p.relname = v_table
      ORDER BY c.relname
    LOOP
      -- Extract date from partition name: tablename_yYYYYmMM
      DECLARE
        v_year int;
        v_month int;
        v_part_date date;
      BEGIN
        v_year := substring(v_rec.partition_name from '_y(\d{4})m')::int;
        v_month := substring(v_rec.partition_name from 'm(\d{2})$')::int;
        v_part_date := make_date(v_year, v_month, 1);

        IF v_part_date < v_cutoff THEN
          EXECUTE format('DROP TABLE public.%I', v_rec.partition_name);
          RAISE NOTICE 'Dropped partition: %', v_rec.partition_name;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Skip partitions with non-standard names
        NULL;
      END;
    END LOOP;
  END LOOP;
END;
$$;

-- 4c. Combined maintenance function
CREATE OR REPLACE FUNCTION public.maintain_partitions(p_retention_months int DEFAULT 12)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_next_month_partitions();
  PERFORM drop_old_partitions(p_retention_months);
  RETURN jsonb_build_object('status', 'ok', 'timestamp', now());
END;
$$;

-- Restrict to service_role
REVOKE ALL ON FUNCTION public.create_next_month_partitions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_next_month_partitions() TO service_role;
REVOKE ALL ON FUNCTION public.drop_old_partitions(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.drop_old_partitions(int) TO service_role;
REVOKE ALL ON FUNCTION public.maintain_partitions(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maintain_partitions(int) TO service_role;


-- ── 5. STORAGE REPORT RPC FUNCTION ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_storage_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Only platform admins can call this
  IF NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'tables', (
      SELECT jsonb_agg(jsonb_build_object(
        'table_name', t.table_name,
        'total_size', pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name)::regclass)),
        'total_bytes', pg_total_relation_size(quote_ident(t.table_name)::regclass),
        'table_size', pg_size_pretty(pg_relation_size(quote_ident(t.table_name)::regclass)),
        'index_size', pg_size_pretty(pg_indexes_size(quote_ident(t.table_name)::regclass)),
        'is_partitioned', EXISTS (
          SELECT 1 FROM pg_partitioned_table pt
          JOIN pg_class c ON c.oid = pt.partrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = t.table_name
        )
      ) ORDER BY pg_total_relation_size(quote_ident(t.table_name)::regclass) DESC)
      FROM (
        SELECT tablename AS table_name
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT LIKE '%_y20%' -- exclude partitions from top-level list
      ) t
    ),
    'partitions', (
      SELECT jsonb_agg(jsonb_build_object(
        'parent_table', p.relname,
        'partition_name', c.relname,
        'size', pg_size_pretty(pg_total_relation_size(c.oid)),
        'size_bytes', pg_total_relation_size(c.oid)
      ) ORDER BY p.relname, c.relname)
      FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON n.oid = p.relnamespace
      WHERE n.nspname = 'public'
    ),
    'partition_summary', (
      SELECT jsonb_agg(jsonb_build_object(
        'table_name', p.relname,
        'partition_count', count(*),
        'total_size', pg_size_pretty(sum(pg_total_relation_size(c.oid))),
        'total_bytes', sum(pg_total_relation_size(c.oid))
      ))
      FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON n.oid = p.relnamespace
      WHERE n.nspname = 'public'
      GROUP BY p.relname
    ),
    'generated_at', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_storage_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storage_report() TO authenticated;
