
-- Enum for health status
CREATE TYPE public.integration_health_status AS ENUM ('healthy', 'degraded', 'down');

-- Enum for alert severity
CREATE TYPE public.integration_alert_severity AS ENUM ('info', 'warn', 'critical');

-- ═══ integration_health_checks ═══
CREATE TABLE public.integration_health_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  status public.integration_health_status NOT NULL DEFAULT 'healthy',
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latency_ms INT NULL,
  error_code TEXT NULL,
  error_message TEXT NULL,
  consecutive_failures INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider_key)
);

ALTER TABLE public.integration_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view health checks"
  ON public.integration_health_checks FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage health checks"
  ON public.integration_health_checks FOR ALL
  USING (true) WITH CHECK (true);

-- Revoke direct insert/update/delete from anon and authenticated (only service_role writes)
REVOKE INSERT, UPDATE, DELETE ON public.integration_health_checks FROM anon, authenticated;

-- ═══ integration_alerts ═══
CREATE TABLE public.integration_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  severity public.integration_alert_severity NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL,
  resolved_by UUID NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view alerts"
  ON public.integration_alerts FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can resolve alerts"
  ON public.integration_alerts FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage alerts"
  ON public.integration_alerts FOR ALL
  USING (true) WITH CHECK (true);

-- Revoke direct insert/delete from anon and authenticated
REVOKE INSERT, DELETE ON public.integration_alerts FROM anon, authenticated;

-- ═══ Indexes ═══
CREATE INDEX idx_health_checks_tenant ON public.integration_health_checks(tenant_id);
CREATE INDEX idx_health_checks_status ON public.integration_health_checks(status);
CREATE INDEX idx_alerts_tenant ON public.integration_alerts(tenant_id);
CREATE INDEX idx_alerts_severity ON public.integration_alerts(severity);
CREATE INDEX idx_alerts_unresolved ON public.integration_alerts(tenant_id) WHERE resolved_at IS NULL;

-- ═══ Timestamp triggers ═══
CREATE TRIGGER update_health_checks_updated_at
  BEFORE UPDATE ON public.integration_health_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON public.integration_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
