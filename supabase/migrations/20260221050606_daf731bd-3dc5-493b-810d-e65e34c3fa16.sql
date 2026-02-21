
-- ============================================================
-- P0 FIX: Enable RLS on ALL 27 partitions
-- Parent policies are automatically inherited once RLS is enabled
-- ============================================================

-- audit_logs partitions (9)
ALTER TABLE public.audit_logs_y2025m08 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_y2025m09 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_y2025m10 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_y2025m11 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_y2025m12 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_y2026m01 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_y2026m02 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_y2026m03 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_y2026m04 ENABLE ROW LEVEL SECURITY;

-- webhook_events partitions (9)
ALTER TABLE public.webhook_events_y2025m08 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events_y2025m09 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events_y2025m10 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events_y2025m11 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events_y2025m12 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events_y2026m01 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events_y2026m02 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events_y2026m03 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events_y2026m04 ENABLE ROW LEVEL SECURITY;

-- production_metrics partitions (9)
ALTER TABLE public.production_metrics_y2025m08 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_metrics_y2025m09 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_metrics_y2025m10 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_metrics_y2025m11 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_metrics_y2025m12 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_metrics_y2026m01 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_metrics_y2026m02 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_metrics_y2026m03 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_metrics_y2026m04 ENABLE ROW LEVEL SECURITY;
