
-- ══════════════════════════════════════════════════════
-- 1) Notification Events Catalog
-- ══════════════════════════════════════════════════════
CREATE TABLE public.notification_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  scope text NOT NULL DEFAULT 'tenant' CHECK (scope IN ('platform', 'tenant')),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  default_channels text[] NOT NULL DEFAULT '{in_app}',
  default_audience_roles text[] NOT NULL DEFAULT '{}',
  category text NOT NULL DEFAULT 'general',
  name_ar text NOT NULL DEFAULT '',
  name_en text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read notification_events" ON public.notification_events FOR SELECT USING (true);
CREATE POLICY "No direct inserts" ON public.notification_events FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct updates" ON public.notification_events FOR UPDATE USING (false);

-- ══════════════════════════════════════════════════════
-- 2) Email Providers (Platform + Tenant SMTP)
-- ══════════════════════════════════════════════════════
CREATE TABLE public.email_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL DEFAULT 'tenant' CHECK (scope IN ('platform', 'tenant')),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_type text NOT NULL DEFAULT 'smtp',
  from_name_ar text,
  from_name_en text,
  from_email text NOT NULL,
  reply_to text,
  smtp_host text NOT NULL,
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_secure boolean NOT NULL DEFAULT true,
  smtp_username text NOT NULL,
  smtp_password_encrypted text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_test_at timestamptz,
  last_test_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_no_tenant CHECK (
    (scope = 'platform' AND tenant_id IS NULL) OR (scope = 'tenant' AND tenant_id IS NOT NULL)
  ),
  CONSTRAINT one_active_per_tenant UNIQUE (tenant_id)
);

ALTER TABLE public.email_providers ENABLE ROW LEVEL SECURITY;

-- Tenant owners can see their own provider
CREATE POLICY "Tenant owners can view own provider" ON public.email_providers
  FOR SELECT USING (
    scope = 'tenant' AND tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'owner'
    )
  );

-- No direct insert/update/delete from client (service_role only)
CREATE POLICY "No direct insert" ON public.email_providers FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct update" ON public.email_providers FOR UPDATE USING (false);
CREATE POLICY "No direct delete" ON public.email_providers FOR DELETE USING (false);

-- ══════════════════════════════════════════════════════
-- 3) Email Templates (scoped)
-- ══════════════════════════════════════════════════════
CREATE TABLE public.email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL DEFAULT 'platform' CHECK (scope IN ('platform', 'tenant')),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  locale text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text,
  design_version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_template UNIQUE (scope, tenant_id, template_key, locale)
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own templates" ON public.email_templates FOR SELECT
  USING (scope = 'platform' OR (scope = 'tenant' AND tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
  )));
CREATE POLICY "No direct insert" ON public.email_templates FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct update" ON public.email_templates FOR UPDATE USING (false);

-- ══════════════════════════════════════════════════════
-- 4) Email Jobs (Outbox Queue)
-- ══════════════════════════════════════════════════════
CREATE TABLE public.email_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL DEFAULT 'tenant' CHECK (scope IN ('platform', 'tenant')),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.email_providers(id),
  template_id uuid REFERENCES public.email_templates(id),
  event_key text,
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'retry')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  next_retry_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text,
  CONSTRAINT unique_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX idx_email_jobs_status ON public.email_jobs(status, scheduled_at) WHERE status IN ('queued', 'retry');
CREATE INDEX idx_email_jobs_tenant ON public.email_jobs(tenant_id);

ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access" ON public.email_jobs FOR SELECT USING (false);
CREATE POLICY "No client insert" ON public.email_jobs FOR INSERT WITH CHECK (false);
CREATE POLICY "No client update" ON public.email_jobs FOR UPDATE USING (false);

-- ══════════════════════════════════════════════════════
-- 5) Enhance email_logs with provider tracking
-- ══════════════════════════════════════════════════════
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.email_jobs(id);
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS provider_used text;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS latency_ms integer;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS smtp_response_snippet text;

-- ══════════════════════════════════════════════════════
-- 6) Add link + metadata columns to tenant_notifications
-- ══════════════════════════════════════════════════════
ALTER TABLE public.tenant_notifications ADD COLUMN IF NOT EXISTS link text;
ALTER TABLE public.tenant_notifications ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
ALTER TABLE public.tenant_notifications ADD COLUMN IF NOT EXISTS event_key text;

-- ══════════════════════════════════════════════════════
-- 7) Add event_key + metadata to user_notifications
-- ══════════════════════════════════════════════════════
ALTER TABLE public.user_notifications ADD COLUMN IF NOT EXISTS event_key text;
ALTER TABLE public.user_notifications ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- ══════════════════════════════════════════════════════
-- 8) Seed notification events catalog
-- ══════════════════════════════════════════════════════
INSERT INTO public.notification_events (key, scope, severity, default_channels, default_audience_roles, category, name_ar, name_en) VALUES
  ('platform.release_notes', 'platform', 'info', '{in_app}', '{owner}', 'platform', 'ملاحظات الإصدار', 'Release Notes'),
  ('platform.maintenance', 'platform', 'warning', '{in_app,email}', '{owner}', 'platform', 'صيانة مجدولة', 'Scheduled Maintenance'),
  ('platform.security_alert', 'platform', 'critical', '{in_app,email}', '{owner}', 'platform', 'تنبيه أمني', 'Security Alert'),
  ('subscription.payment_failed', 'tenant', 'critical', '{in_app,email}', '{owner,cfo}', 'billing', 'فشل الدفع', 'Payment Failed'),
  ('subscription.plan_changed', 'tenant', 'info', '{in_app,email}', '{owner}', 'billing', 'تغيير الباقة', 'Plan Changed'),
  ('hr.document_expiring', 'tenant', 'warning', '{in_app,email}', '{owner,cfo}', 'hr', 'مستند يقترب من الانتهاء', 'Document Expiring'),
  ('invoices.created', 'tenant', 'info', '{in_app}', '{owner,cfo,accountant}', 'accounting', 'فاتورة جديدة', 'Invoice Created'),
  ('invoices.overdue', 'tenant', 'warning', '{in_app,email}', '{owner,cfo}', 'accounting', 'فاتورة متأخرة', 'Invoice Overdue'),
  ('approvals.requested', 'tenant', 'info', '{in_app,email}', '{}', 'governance', 'طلب اعتماد جديد', 'Approval Requested'),
  ('approvals.approved', 'tenant', 'info', '{in_app}', '{}', 'governance', 'تم الاعتماد', 'Approved'),
  ('wallet.withdrawal_requested', 'tenant', 'warning', '{in_app,email}', '{owner,cfo}', 'billing', 'طلب سحب من المحفظة', 'Withdrawal Requested'),
  ('integrations.webhook_failed', 'tenant', 'critical', '{in_app,email}', '{owner}', 'integrations', 'فشل Webhook', 'Webhook Failed'),
  ('expenses.created', 'tenant', 'info', '{in_app}', '{owner,cfo,accountant}', 'accounting', 'مصروف جديد', 'Expense Created'),
  ('inventory.low_stock', 'tenant', 'warning', '{in_app}', '{owner}', 'inventory', 'مخزون منخفض', 'Low Stock')
ON CONFLICT (key) DO NOTHING;

-- ══════════════════════════════════════════════════════
-- 9) Realtime for email_jobs status tracking
-- ══════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_jobs;
