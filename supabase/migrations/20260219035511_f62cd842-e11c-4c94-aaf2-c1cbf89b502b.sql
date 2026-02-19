
-- Production Metrics table for aggregated monitoring data
CREATE TABLE public.production_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  metric_source text NOT NULL, -- 'edge_function','db','wallet','zatca','email'
  metric_name text NOT NULL,   -- 'latency_p50','latency_p95','error_count','success_count'
  metric_value numeric NOT NULL DEFAULT 0,
  tags jsonb DEFAULT '{}'::jsonb, -- e.g. {"function_name":"secure-rpc"}
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.production_metrics ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read
CREATE POLICY "Platform admins can read metrics"
ON public.production_metrics FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- Service role inserts (edge functions)
CREATE POLICY "Service role can insert metrics"
ON public.production_metrics FOR INSERT
TO service_role
WITH CHECK (true);

-- Indexes for fast dashboard queries
CREATE INDEX idx_production_metrics_source_time
ON public.production_metrics (metric_source, recorded_at DESC);

CREATE INDEX idx_production_metrics_name_time
ON public.production_metrics (metric_name, recorded_at DESC);

-- Alert rules table
CREATE TABLE public.monitoring_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  metric_source text NOT NULL,
  metric_name text NOT NULL,
  condition text NOT NULL DEFAULT 'gt', -- 'gt','lt','gte','lte'
  threshold numeric NOT NULL,
  window_minutes int NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  severity text NOT NULL DEFAULT 'warning', -- 'info','warning','critical'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.monitoring_alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage alert rules"
ON public.monitoring_alert_rules FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- Alert events (fired alerts)
CREATE TABLE public.monitoring_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.monitoring_alert_rules(id),
  metric_source text NOT NULL,
  metric_name text NOT NULL,
  current_value numeric NOT NULL,
  threshold numeric NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  fired_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.monitoring_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read alerts"
ON public.monitoring_alerts FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

CREATE INDEX idx_monitoring_alerts_fired
ON public.monitoring_alerts (fired_at DESC);

CREATE INDEX idx_monitoring_alerts_unresolved
ON public.monitoring_alerts (is_resolved, fired_at DESC)
WHERE is_resolved = false;

-- Insert default alert rules
INSERT INTO public.monitoring_alert_rules (name, metric_source, metric_name, condition, threshold, window_minutes, severity) VALUES
('Error rate > 5%', 'edge_function', 'error_rate', 'gt', 5, 5, 'critical'),
('Latency p95 > 3s', 'edge_function', 'latency_p95', 'gt', 3000, 5, 'critical'),
('DB deadlocks detected', 'db', 'deadlock_count', 'gt', 0, 10, 'warning'),
('Wallet failure rate > 2%', 'wallet', 'error_rate', 'gt', 2, 5, 'critical'),
('ZATCA submission failures', 'zatca', 'error_count', 'gt', 0, 15, 'warning'),
('Email failure rate > 5%', 'email', 'error_rate', 'gt', 5, 10, 'warning');

-- DB function to compute p50/p95 from edge_request_logs
CREATE OR REPLACE FUNCTION public.get_edge_latency_percentiles(_since timestamptz DEFAULT now() - interval '1 hour')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  -- Only platform admins
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'p50', COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms), 0),
    'p95', COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms), 0),
    'p99', COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms), 0),
    'avg', COALESCE(AVG(duration_ms), 0),
    'max', COALESCE(MAX(duration_ms), 0),
    'total_requests', COUNT(*),
    'error_count', COUNT(*) FILTER (WHERE status_code >= 400),
    'error_rate', CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status_code >= 400))::numeric / COUNT(*) * 100, 2) ELSE 0 END
  ) INTO _result
  FROM public.edge_request_logs
  WHERE created_at >= _since AND duration_ms IS NOT NULL;

  RETURN _result;
END;
$$;

-- Per-function latency breakdown
CREATE OR REPLACE FUNCTION public.get_edge_latency_by_function(_since timestamptz DEFAULT now() - interval '1 hour')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _result
  FROM (
    SELECT
      function_name,
      COUNT(*) as total_requests,
      ROUND(AVG(duration_ms)::numeric, 1) as avg_ms,
      ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms)::numeric, 1) as p50_ms,
      ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::numeric, 1) as p95_ms,
      MAX(duration_ms) as max_ms,
      COUNT(*) FILTER (WHERE status_code >= 400) as errors,
      CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status_code >= 400))::numeric / COUNT(*) * 100, 1) ELSE 0 END as error_rate
    FROM public.edge_request_logs
    WHERE created_at >= _since AND duration_ms IS NOT NULL
    GROUP BY function_name
    ORDER BY total_requests DESC
  ) t;

  RETURN _result;
END;
$$;

-- Revoke public access, grant to service_role
REVOKE EXECUTE ON FUNCTION public.get_edge_latency_percentiles FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_edge_latency_percentiles TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_edge_latency_by_function FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_edge_latency_by_function TO authenticated, service_role;
