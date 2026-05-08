
CREATE OR REPLACE FUNCTION public.create_next_month_partitions()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tables text[] := ARRAY['audit_logs', 'webhook_events', 'production_metrics'];
  v_table text;
  v_start date;
  v_end date;
  v_partition_name text;
  v_month_offset int;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    FOR v_month_offset IN 0..2 LOOP
      v_start := date_trunc('month', now() + (v_month_offset || ' months')::interval)::date;
      v_end := (v_start + interval '1 month')::date;
      v_partition_name := v_table || '_y' || to_char(v_start, 'YYYY') || 'm' || to_char(v_start, 'MM');

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

      -- Always enforce tenant-isolation hardening (idempotent)
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_partition_name);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', v_partition_name);

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename=v_partition_name AND policyname='service_role_full_access'
      ) THEN
        EXECUTE format(
          'CREATE POLICY service_role_full_access ON public.%I FOR ALL USING (true) WITH CHECK (true)',
          v_partition_name
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;
