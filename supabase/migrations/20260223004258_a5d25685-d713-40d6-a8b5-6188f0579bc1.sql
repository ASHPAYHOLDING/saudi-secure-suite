
-- ══════════════════════════════════════════════════════════════
-- HR Document Alerts System Migration
-- ══════════════════════════════════════════════════════════════

-- 1) Alert type enum
CREATE TYPE public.hr_alert_type AS ENUM ('expiring_30', 'expiring_14', 'expiring_7', 'expired');

-- 2) Add is_required + national_id_or_iqama to employee_documents
ALTER TABLE public.employee_documents
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false;

-- Add national_id_or_iqama to enum (keep old values for backward compat)
ALTER TYPE public.employee_document_type ADD VALUE IF NOT EXISTS 'national_id_or_iqama';

-- 3) hr_document_alerts — dedup table
CREATE TABLE public.hr_document_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.employee_documents(id) ON DELETE CASCADE,
  alert_type public.hr_alert_type NOT NULL,
  sent_in_app boolean NOT NULL DEFAULT false,
  sent_email boolean NOT NULL DEFAULT false,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, alert_type)
);

CREATE INDEX idx_hr_doc_alerts_tenant ON public.hr_document_alerts(tenant_id);
CREATE INDEX idx_hr_doc_alerts_doc ON public.hr_document_alerts(document_id);

ALTER TABLE public.hr_document_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view alerts"
  ON public.hr_document_alerts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = hr_document_alerts.tenant_id
      AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Service role insert"
  ON public.hr_document_alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role update"
  ON public.hr_document_alerts FOR UPDATE
  USING (true);

-- 4) User-level notifications table
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_notif_user ON public.user_notifications(user_id, is_read);
CREATE INDEX idx_user_notif_tenant ON public.user_notifications(tenant_id);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON public.user_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.user_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role insert notifications"
  ON public.user_notifications FOR INSERT
  WITH CHECK (true);

-- Enable realtime for user_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;

-- 5) Register hr_doc_alerts feature key in plan_entitlements
INSERT INTO public.plan_entitlements (plan_id, feature_key, is_enabled, limit_value)
SELECT p.id, 'hr_doc_alerts', true, NULL
FROM public.subscription_plans p
WHERE p.slug IN ('business', 'enterprise')
ON CONFLICT DO NOTHING;
