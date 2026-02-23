
-- ═══════════════════════════════════════════════════════════
-- WhatsApp Notification Channel — Multi-tenant Schema
-- ═══════════════════════════════════════════════════════════

-- 1) tenant_notification_channels
CREATE TABLE public.tenant_notification_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app', 'email', 'whatsapp')),
  enabled boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel)
);

ALTER TABLE public.tenant_notification_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_notif_channels_select" ON public.tenant_notification_channels
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "tenant_notif_channels_modify" ON public.tenant_notification_channels
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner')))
  WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner')));

-- 2) tenant_whatsapp_accounts
CREATE TABLE public.tenant_whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'meta',
  waba_id text NOT NULL,
  phone_number_id text NOT NULL,
  display_phone_number text,
  business_name text,
  access_token_encrypted text NOT NULL,
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'error', 'pending', 'disconnected')),
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_whatsapp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_accounts_select" ON public.tenant_whatsapp_accounts
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "wa_accounts_modify" ON public.tenant_whatsapp_accounts
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner')))
  WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner')));

-- 3) whatsapp_templates (notification templates for WhatsApp)
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'tenant' CHECK (scope IN ('platform', 'tenant')),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  language text NOT NULL DEFAULT 'ar' CHECK (language IN ('ar', 'en')),
  whatsapp_template_name text NOT NULL,
  whatsapp_namespace text,
  components_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  variable_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, template_key, language)
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_templates_select" ON public.whatsapp_templates
  FOR SELECT TO authenticated
  USING (
    scope = 'platform' OR
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY "wa_templates_modify" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner'))
  )
  WITH CHECK (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner'))
  );

-- 4) notification_outbox (unified outbox for all channels)
CREATE TABLE public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app', 'email', 'whatsapp')),
  template_key text NOT NULL,
  recipient text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'retrying', 'blocked')),
  provider_message_id text,
  error text,
  block_reason text,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX idx_notification_outbox_status ON public.notification_outbox(status, next_retry_at) WHERE status IN ('queued', 'retrying');
CREATE INDEX idx_notification_outbox_tenant ON public.notification_outbox(tenant_id, created_at DESC);

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outbox_select" ON public.notification_outbox
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "outbox_insert" ON public.notification_outbox
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

-- 5) notification_rate_limits
CREATE TABLE public.notification_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  daily_limit int NOT NULL DEFAULT 1000,
  monthly_limit int NOT NULL DEFAULT 10000,
  daily_count int NOT NULL DEFAULT 0,
  monthly_count int NOT NULL DEFAULT 0,
  last_reset_daily date NOT NULL DEFAULT CURRENT_DATE,
  last_reset_monthly date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel)
);

ALTER TABLE public.notification_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limits_select" ON public.notification_rate_limits
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "rate_limits_modify" ON public.notification_rate_limits
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner')))
  WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner')));

-- Enable realtime for outbox (for live log updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_outbox;
