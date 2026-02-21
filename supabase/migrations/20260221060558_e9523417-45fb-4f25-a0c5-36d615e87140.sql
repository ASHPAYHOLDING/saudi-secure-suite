
-- ═══════════════════════════════════════════════════════════════════
-- FIX 1: Restrict 8 dangerous "Service role" policies from TO PUBLIC → TO service_role
-- These policies say "Service role" in name but are actually TO PUBLIC (polroles={0})
-- ═══════════════════════════════════════════════════════════════════

-- background_jobs
DROP POLICY IF EXISTS "Service role full access" ON public.background_jobs;
CREATE POLICY "Service role full access"
  ON public.background_jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- background_reindex_jobs
DROP POLICY IF EXISTS "Service role full access on reindex" ON public.background_reindex_jobs;
CREATE POLICY "Service role full access on reindex"
  ON public.background_reindex_jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- event_subscribers
DROP POLICY IF EXISTS "Service role access on subscribers" ON public.event_subscribers;
CREATE POLICY "Service role access on subscribers"
  ON public.event_subscribers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- integration_alerts
DROP POLICY IF EXISTS "Service role can manage alerts" ON public.integration_alerts;
CREATE POLICY "Service role can manage alerts"
  ON public.integration_alerts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- integration_health_checks
DROP POLICY IF EXISTS "Service role can manage health checks" ON public.integration_health_checks;
CREATE POLICY "Service role can manage health checks"
  ON public.integration_health_checks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- login_attempts
DROP POLICY IF EXISTS "Service role full access on login_attempts" ON public.login_attempts;
CREATE POLICY "Service role full access on login_attempts"
  ON public.login_attempts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- migration_versions
DROP POLICY IF EXISTS "Service role full access" ON public.migration_versions;
CREATE POLICY "Service role full access"
  ON public.migration_versions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- tenant_integration_secrets
DROP POLICY IF EXISTS "Service role can manage secrets" ON public.tenant_integration_secrets;
CREATE POLICY "Service role can manage secrets"
  ON public.tenant_integration_secrets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- FIX 2: Add service_role policies to all 27 partitions
-- Partitions have RLS enabled but zero policies = total block.
-- We add service_role ALL access to match parent table patterns.
-- ═══════════════════════════════════════════════════════════════════

-- audit_logs partitions (service_role needs write access for audit triggers)
DO $$
DECLARE
  p text;
BEGIN
  FOR p IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_inherits i ON i.inhrelid = c.oid
    JOIN pg_class parent ON parent.oid = i.inhparent
    WHERE n.nspname = 'public'
      AND parent.relname IN ('audit_logs', 'webhook_events', 'production_metrics')
      AND c.relispartition = true
      AND NOT EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = c.oid)
  LOOP
    EXECUTE format(
      'CREATE POLICY "service_role_full_access" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      p
    );
  END LOOP;
END
$$;
