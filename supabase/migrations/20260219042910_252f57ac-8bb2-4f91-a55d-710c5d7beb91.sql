
-- ══════════════════════════════════════════════════════
-- SLA / Status Page / Uptime Monitoring Schema
-- ══════════════════════════════════════════════════════

-- 1) Service definitions (what we monitor)
CREATE TABLE public.platform_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'core', -- core, api, integration
  check_url TEXT, -- optional health-check endpoint
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Health check results (automated probes)
CREATE TABLE public.health_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.platform_services(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'operational', -- operational, degraded, partial_outage, major_outage
  response_time_ms INT,
  status_code INT,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_health_checks_service_time ON public.health_checks(service_id, checked_at DESC);

-- 3) Incidents
CREATE TABLE public.platform_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  severity TEXT NOT NULL DEFAULT 'minor', -- minor, major, critical
  status TEXT NOT NULL DEFAULT 'investigating', -- investigating, identified, monitoring, resolved
  affected_services UUID[] DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Incident updates (timeline)
CREATE TABLE public.incident_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES public.platform_incidents(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  message_ar TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) Daily uptime summary (materialized by cron/edge function)
CREATE TABLE public.uptime_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.platform_services(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_checks INT NOT NULL DEFAULT 0,
  successful_checks INT NOT NULL DEFAULT 0,
  uptime_percent NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  avg_response_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, date)
);

CREATE INDEX idx_uptime_daily_service_date ON public.uptime_daily(service_id, date DESC);

-- 6) Scheduled maintenance windows
CREATE TABLE public.maintenance_windows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  affected_services UUID[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════
-- RLS — Platform services and status are publicly readable
-- ══════════════════════════════════════════════════════

ALTER TABLE public.platform_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uptime_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_windows ENABLE ROW LEVEL SECURITY;

-- Public read for status page
CREATE POLICY "Anyone can read platform services"
  ON public.platform_services FOR SELECT USING (true);

CREATE POLICY "Anyone can read health checks"
  ON public.health_checks FOR SELECT USING (true);

CREATE POLICY "Anyone can read incidents"
  ON public.platform_incidents FOR SELECT USING (true);

CREATE POLICY "Anyone can read incident updates"
  ON public.incident_updates FOR SELECT USING (true);

CREATE POLICY "Anyone can read uptime data"
  ON public.uptime_daily FOR SELECT USING (true);

CREATE POLICY "Anyone can read maintenance windows"
  ON public.maintenance_windows FOR SELECT USING (true);

-- Admin write (platform admins only)
CREATE POLICY "Platform admins manage services"
  ON public.platform_services FOR ALL
  USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));

CREATE POLICY "Platform admins manage health checks"
  ON public.health_checks FOR ALL
  USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));

CREATE POLICY "Platform admins manage incidents"
  ON public.platform_incidents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));

CREATE POLICY "Platform admins manage incident updates"
  ON public.incident_updates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));

CREATE POLICY "Platform admins manage uptime data"
  ON public.uptime_daily FOR ALL
  USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));

CREATE POLICY "Platform admins manage maintenance"
  ON public.maintenance_windows FOR ALL
  USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));

-- ══════════════════════════════════════════════════════
-- Seed default services
-- ══════════════════════════════════════════════════════
INSERT INTO public.platform_services (name, name_ar, category, display_order) VALUES
  ('API Gateway', 'بوابة API', 'core', 1),
  ('Authentication', 'المصادقة', 'core', 2),
  ('Database', 'قاعدة البيانات', 'core', 3),
  ('File Storage', 'تخزين الملفات', 'core', 4),
  ('Invoice Processing', 'معالجة الفواتير', 'api', 5),
  ('Email Delivery', 'إرسال البريد', 'api', 6),
  ('Payment Gateway', 'بوابة الدفع', 'integration', 7),
  ('ZATCA Integration', 'تكامل زاتكا', 'integration', 8);
