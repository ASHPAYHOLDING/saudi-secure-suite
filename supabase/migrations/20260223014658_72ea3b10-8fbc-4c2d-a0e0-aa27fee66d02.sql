
-- ═══════════════════════════════════════════════════
-- Notification Mapping Layer — Fix schema + New tables
-- ═══════════════════════════════════════════════════

-- 1) ENUMS (create only if not exist)
DO $$ BEGIN CREATE TYPE public.notification_channel AS ENUM ('in_app','email','whatsapp'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notification_email_mode AS ENUM ('platform','tenant_smtp'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notification_audience AS ENUM ('owner_only','admins','finance','hr','custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notification_status AS ENUM ('queued','sent','failed','skipped'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) ALTER notification_events — add missing columns
ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS allowed_channels TEXT[] NOT NULL DEFAULT '{in_app,email}',
  ADD COLUMN IF NOT EXISTS default_email_mode TEXT NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Make key unique if not already (it's currently id UUID PK)
-- Add unique constraint on key
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_events_key_unique') THEN
    ALTER TABLE public.notification_events ADD CONSTRAINT notification_events_key_unique UNIQUE (key);
  END IF;
END $$;

-- 3) Create notification_event_templates
CREATE TABLE IF NOT EXISTS public.notification_event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  lang TEXT NOT NULL CHECK (lang IN ('ar','en')),
  subject TEXT,
  body TEXT NOT NULL,
  is_platform_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_template_active
  ON public.notification_event_templates (event_key, channel, lang, is_platform_default)
  WHERE is_active = true;

-- 4) Create tenant_notification_preferences
CREATE TABLE IF NOT EXISTS public.tenant_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  channels TEXT[],
  email_mode TEXT,
  audience TEXT NOT NULL DEFAULT 'admins',
  custom_recipients JSONB,
  quiet_hours JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, event_key)
);

-- 5) Create notification_event_outbox
CREATE TABLE IF NOT EXISTS public.notification_event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  email_mode TEXT,
  recipient JSONB NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_outbox_tenant_status
  ON public.notification_event_outbox (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_outbox_event
  ON public.notification_event_outbox (event_key, created_at DESC);

-- 6) RLS

-- notification_events
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Authenticated can read events"
    ON public.notification_events FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- notification_event_templates
ALTER TABLE public.notification_event_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins manage templates"
  ON public.notification_event_templates FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Authenticated can read platform default templates"
  ON public.notification_event_templates FOR SELECT TO authenticated
  USING (is_platform_default = true);

-- tenant_notification_preferences
ALTER TABLE public.tenant_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members manage notification prefs"
  ON public.tenant_notification_preferences FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));

-- notification_event_outbox
ALTER TABLE public.notification_event_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can read own outbox"
  ON public.notification_event_outbox FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- 7) SEED — update existing events with new columns + insert missing

UPDATE public.notification_events SET
  description_ar = 'إشعار عند إنشاء فاتورة جديدة', description_en = 'Notification when a new invoice is created',
  allowed_channels = '{in_app,email}', default_email_mode = 'platform'
WHERE key = 'invoice_created';

UPDATE public.notification_events SET
  description_ar = 'تذكير قبل موعد استحقاق الفاتورة', description_en = 'Reminder before invoice due date',
  allowed_channels = '{in_app,email,whatsapp}', default_email_mode = 'platform'
WHERE key = 'invoice_due_soon';

UPDATE public.notification_events SET
  description_ar = 'إشعار بتأخر سداد الفاتورة', description_en = 'Notification for overdue invoice',
  allowed_channels = '{in_app,email,whatsapp}', default_email_mode = 'platform'
WHERE key = 'invoice_overdue';

UPDATE public.notification_events SET
  description_ar = 'إشعار عند سداد الفاتورة بالكامل', description_en = 'Notification when invoice is fully paid',
  allowed_channels = '{in_app,email,whatsapp}', default_email_mode = 'platform'
WHERE key = 'invoice_paid';

UPDATE public.notification_events SET
  description_ar = 'تم تقديم طلب يحتاج موافقتك', description_en = 'A new request needs your approval',
  allowed_channels = '{in_app,email}', default_email_mode = 'platform'
WHERE key = 'approval_requested';

UPDATE public.notification_events SET
  description_ar = 'تمت الموافقة على الطلب', description_en = 'Request has been approved',
  allowed_channels = '{in_app,email}', default_email_mode = 'platform'
WHERE key = 'approval_approved';

UPDATE public.notification_events SET
  description_ar = 'تم رفض الطلب', description_en = 'Request has been rejected',
  allowed_channels = '{in_app,email}', default_email_mode = 'platform'
WHERE key = 'approval_rejected';

UPDATE public.notification_events SET
  description_ar = 'رمز التحقق لتسجيل الدخول', description_en = 'Login verification code',
  allowed_channels = '{email}', default_email_mode = 'platform'
WHERE key = 'otp_login';

UPDATE public.notification_events SET
  description_ar = 'رابط إعادة تعيين كلمة المرور', description_en = 'Password reset link',
  allowed_channels = '{email}', default_email_mode = 'platform'
WHERE key = 'password_reset';

-- Insert missing events
INSERT INTO public.notification_events (key, name_ar, name_en, category, severity, description_ar, description_en, allowed_channels, default_channels, default_email_mode, is_active)
VALUES
  ('leave_request_submitted', 'طلب إجازة جديد', 'Leave Request Submitted', 'hr', 'info', 'تم تقديم طلب إجازة جديد', 'A new leave request has been submitted', '{in_app,email}', '{in_app}', 'platform', true),
  ('leave_request_approved', 'تمت الموافقة على الإجازة', 'Leave Request Approved', 'hr', 'info', 'تمت الموافقة على طلب الإجازة', 'Leave request has been approved', '{in_app,email}', '{in_app}', 'platform', true),
  ('employee_contract_uploaded', 'تم رفع عقد موظف', 'Employee Contract Uploaded', 'hr', 'info', 'تم رفع عقد عمل جديد', 'A new employment contract has been uploaded', '{in_app}', '{in_app}', 'platform', true)
ON CONFLICT (key) DO NOTHING;

-- 8) SEED — platform default templates
INSERT INTO public.notification_event_templates (event_key, channel, lang, subject, body, is_platform_default) VALUES
  ('invoice_due_soon', 'in_app', 'ar', NULL, 'الفاتورة رقم {{invoice_number}} بمبلغ {{amount}} {{currency}} تستحق بتاريخ {{due_date}}.', true),
  ('invoice_due_soon', 'in_app', 'en', NULL, 'Invoice #{{invoice_number}} for {{amount}} {{currency}} is due on {{due_date}}.', true),
  ('invoice_due_soon', 'email', 'ar', 'تذكير: فاتورة قاربت على الاستحقاق', 'مرحباً {{recipient_name}}،\n\nنود تذكيركم بأن الفاتورة رقم {{invoice_number}} بمبلغ {{amount}} {{currency}} تستحق بتاريخ {{due_date}}.\n\nيرجى التكرم بالسداد في الموعد المحدد.\n\nمع التحية،\n{{company_name}}', true),
  ('invoice_due_soon', 'email', 'en', 'Reminder: Invoice Due Soon', 'Dear {{recipient_name}},\n\nThis is a reminder that Invoice #{{invoice_number}} for {{amount}} {{currency}} is due on {{due_date}}.\n\nPlease ensure timely payment.\n\nBest regards,\n{{company_name}}', true),
  ('invoice_paid', 'in_app', 'ar', NULL, 'تم سداد الفاتورة رقم {{invoice_number}} بمبلغ {{amount}} {{currency}}.', true),
  ('invoice_paid', 'in_app', 'en', NULL, 'Invoice #{{invoice_number}} for {{amount}} {{currency}} has been paid.', true),
  ('invoice_paid', 'email', 'ar', 'تأكيد السداد', 'مرحباً {{recipient_name}}،\n\nنؤكد استلام سداد الفاتورة رقم {{invoice_number}} بمبلغ {{amount}} {{currency}}.\n\nشكراً لكم.\n\n{{company_name}}', true),
  ('invoice_paid', 'email', 'en', 'Payment Confirmation', 'Dear {{recipient_name}},\n\nWe confirm receipt of payment for Invoice #{{invoice_number}} amounting to {{amount}} {{currency}}.\n\nThank you.\n\n{{company_name}}', true),
  ('otp_login', 'email', 'ar', 'رمز التحقق', 'رمز التحقق الخاص بك هو: {{otp_code}}\n\nصالح لمدة {{expiry_minutes}} دقائق.\n\nإذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة.', true),
  ('otp_login', 'email', 'en', 'Verification Code', 'Your verification code is: {{otp_code}}\n\nValid for {{expiry_minutes}} minutes.\n\nIf you did not request this code, please ignore this message.', true),
  ('approval_requested', 'in_app', 'ar', NULL, 'لديك طلب موافقة جديد: {{document_type}} رقم {{document_number}} بمبلغ {{amount}} {{currency}}.', true),
  ('approval_requested', 'in_app', 'en', NULL, 'New approval request: {{document_type}} #{{document_number}} for {{amount}} {{currency}}.', true)
ON CONFLICT DO NOTHING;

-- 9) RPC: resolve_notification_plan

CREATE OR REPLACE FUNCTION public.resolve_notification_plan(
  p_tenant_id UUID,
  p_event_key TEXT,
  p_lang TEXT DEFAULT 'ar'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_pref RECORD;
  v_enabled BOOLEAN;
  v_channels TEXT[];
  v_email_mode TEXT;
  v_audience TEXT;
  v_custom_recipients JSONB;
  v_result_channels JSONB := '[]'::JSONB;
  v_ch TEXT;
  v_template_id UUID;
  v_template_lang TEXT;
  v_has_any_channel BOOLEAN := false;
BEGIN
  SELECT * INTO v_event FROM notification_events WHERE key = p_event_key;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('event', NULL, 'enabled', false, 'reason', 'event_not_found', 'channels', '[]'::jsonb, 'audience', NULL);
  END IF;
  IF NOT v_event.is_active THEN
    RETURN jsonb_build_object('event', jsonb_build_object('key', v_event.key, 'category', v_event.category, 'severity', v_event.severity), 'enabled', false, 'reason', 'event_inactive', 'channels', '[]'::jsonb, 'audience', NULL);
  END IF;

  SELECT * INTO v_pref FROM tenant_notification_preferences WHERE tenant_id = p_tenant_id AND event_key = p_event_key;

  v_enabled := COALESCE(v_pref.enabled, true);
  IF NOT v_enabled THEN
    RETURN jsonb_build_object('event', jsonb_build_object('key', v_event.key, 'category', v_event.category, 'severity', v_event.severity), 'enabled', false, 'reason', 'disabled_by_tenant', 'channels', '[]'::jsonb, 'audience', jsonb_build_object('type', COALESCE(v_pref.audience, 'admins'), 'custom_recipients', v_pref.custom_recipients));
  END IF;

  v_channels := COALESCE(v_pref.channels, v_event.default_channels);
  SELECT ARRAY(SELECT unnest(v_channels) INTERSECT SELECT unnest(v_event.allowed_channels)) INTO v_channels;

  IF array_length(v_channels, 1) IS NULL OR array_length(v_channels, 1) = 0 THEN
    RETURN jsonb_build_object('event', jsonb_build_object('key', v_event.key, 'category', v_event.category, 'severity', v_event.severity), 'enabled', false, 'reason', 'no_valid_channels', 'channels', '[]'::jsonb, 'audience', jsonb_build_object('type', COALESCE(v_pref.audience, 'admins'), 'custom_recipients', v_pref.custom_recipients));
  END IF;

  v_email_mode := COALESCE(v_pref.email_mode, v_event.default_email_mode);
  v_audience := COALESCE(v_pref.audience, 'admins');
  v_custom_recipients := v_pref.custom_recipients;

  FOREACH v_ch IN ARRAY v_channels LOOP
    v_template_id := NULL;
    v_template_lang := p_lang;

    SELECT id INTO v_template_id FROM notification_event_templates
    WHERE event_key = p_event_key AND channel = v_ch AND lang = p_lang AND is_active = true AND is_platform_default = true LIMIT 1;

    IF v_template_id IS NULL AND p_lang <> 'en' THEN
      SELECT id INTO v_template_id FROM notification_event_templates
      WHERE event_key = p_event_key AND channel = v_ch AND lang = 'en' AND is_active = true AND is_platform_default = true LIMIT 1;
      IF v_template_id IS NOT NULL THEN v_template_lang := 'en'; END IF;
    END IF;

    IF v_template_id IS NOT NULL THEN
      v_result_channels := v_result_channels || jsonb_build_object(
        'channel', v_ch, 'email_mode', CASE WHEN v_ch = 'email' THEN v_email_mode ELSE NULL END,
        'template_id', v_template_id::text, 'lang', v_template_lang);
      v_has_any_channel := true;
    END IF;
  END LOOP;

  IF NOT v_has_any_channel THEN
    RETURN jsonb_build_object('event', jsonb_build_object('key', v_event.key, 'category', v_event.category, 'severity', v_event.severity), 'enabled', false, 'reason', 'no_templates_available', 'channels', '[]'::jsonb, 'audience', jsonb_build_object('type', v_audience, 'custom_recipients', v_custom_recipients));
  END IF;

  RETURN jsonb_build_object(
    'event', jsonb_build_object('key', v_event.key, 'category', v_event.category, 'severity', v_event.severity),
    'enabled', true, 'reason', NULL, 'channels', v_result_channels,
    'audience', jsonb_build_object('type', v_audience, 'custom_recipients', v_custom_recipients));
END;
$$;

-- 10) RPC: list_notification_events_for_tenant
CREATE OR REPLACE FUNCTION public.list_notification_events_for_tenant(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::JSONB;
  v_event RECORD;
  v_pref RECORD;
BEGIN
  FOR v_event IN SELECT * FROM notification_events WHERE is_active = true ORDER BY category, key LOOP
    SELECT * INTO v_pref FROM tenant_notification_preferences WHERE tenant_id = p_tenant_id AND event_key = v_event.key;
    v_result := v_result || jsonb_build_object(
      'key', v_event.key, 'name_ar', v_event.name_ar, 'name_en', v_event.name_en,
      'category', v_event.category, 'severity', v_event.severity,
      'description_ar', v_event.description_ar, 'description_en', v_event.description_en,
      'allowed_channels', to_jsonb(v_event.allowed_channels),
      'default_channels', to_jsonb(v_event.default_channels),
      'default_email_mode', v_event.default_email_mode,
      'enabled', COALESCE(v_pref.enabled, true),
      'channels', COALESCE(to_jsonb(v_pref.channels), to_jsonb(v_event.default_channels)),
      'email_mode', COALESCE(v_pref.email_mode, v_event.default_email_mode),
      'audience', COALESCE(v_pref.audience, 'admins'),
      'custom_recipients', v_pref.custom_recipients,
      'has_override', (v_pref.id IS NOT NULL)
    );
  END LOOP;
  RETURN v_result;
END;
$$;
