
-- Fix tenant isolation gap: enable RLS on auto-created monthly partitions
ALTER TABLE public.audit_logs_y2026m05 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_y2026m06 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events_y2026m05 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events_y2026m06 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_metrics_y2026m05 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_metrics_y2026m06 ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_full_access ON public.audit_logs_y2026m05 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY service_role_full_access ON public.audit_logs_y2026m06 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY service_role_full_access ON public.webhook_events_y2026m05 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY service_role_full_access ON public.webhook_events_y2026m06 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY service_role_full_access ON public.production_metrics_y2026m05 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY service_role_full_access ON public.production_metrics_y2026m06 FOR ALL USING (true) WITH CHECK (true);

-- Revoke direct table privileges from authenticated/anon to enforce service-role-only access
REVOKE ALL ON public.audit_logs_y2026m05, public.audit_logs_y2026m06,
                public.webhook_events_y2026m05, public.webhook_events_y2026m06,
                public.production_metrics_y2026m05, public.production_metrics_y2026m06
  FROM anon, authenticated;
