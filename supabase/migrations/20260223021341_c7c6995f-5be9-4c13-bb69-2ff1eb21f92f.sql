
-- ═══════════════════════════════════════════════════════════
-- WhatsApp: Opt-in Tracking + Platform Mode + Message Log
-- ═══════════════════════════════════════════════════════════

-- 1) Add mode column to tenant_notification_channels (platform vs tenant)
ALTER TABLE public.tenant_notification_channels
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'platform' CHECK (mode IN ('platform', 'tenant'));

-- 2) whatsapp_optins — compliance-critical opt-in tracking
CREATE TABLE IF NOT EXISTS public.whatsapp_optins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NULL,
  phone_e164 text NOT NULL,
  opted_in boolean NOT NULL DEFAULT false,
  opted_in_at timestamptz NULL,
  opted_out_at timestamptz NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('checkout','invoice','settings','manual','api')),
  lang text NOT NULL DEFAULT 'ar' CHECK (lang IN ('ar','en')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, phone_e164)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_optins_tenant ON public.whatsapp_optins(tenant_id, phone_e164);

ALTER TABLE public.whatsapp_optins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_optins_select" ON public.whatsapp_optins
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "wa_optins_modify" ON public.whatsapp_optins
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner','admin')))
  WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner','admin')));

-- 3) whatsapp_message_log — detailed delivery lifecycle tracking
CREATE TABLE IF NOT EXISTS public.whatsapp_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  notification_id uuid NULL,
  outbox_id uuid NULL,
  to_phone text NOT NULL,
  provider_message_id text NULL,
  template_key text NOT NULL,
  template_name text NULL,
  language_code text NOT NULL DEFAULT 'ar',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','read','failed')),
  error_code text NULL,
  error_message text NULL,
  sent_at timestamptz NULL,
  delivered_at timestamptz NULL,
  read_at timestamptz NULL,
  failed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_log_tenant ON public.whatsapp_message_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_msg_log_provider ON public.whatsapp_message_log(provider_message_id) WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_msg_log_select" ON public.whatsapp_message_log
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

-- Only edge functions (service_role) insert/update
CREATE POLICY "wa_msg_log_service" ON public.whatsapp_message_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 4) Platform WhatsApp config table (for Option A)
CREATE TABLE IF NOT EXISTS public.platform_whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'meta_cloud' CHECK (provider IN ('meta_cloud','twilio','360dialog')),
  waba_id text NOT NULL,
  phone_number_id text NOT NULL,
  display_phone_number text NULL,
  business_name text NOT NULL DEFAULT 'Numaxio',
  access_token_encrypted text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view/edit
CREATE POLICY "platform_wa_config_admin" ON public.platform_whatsapp_config
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

-- Service role full access
CREATE POLICY "platform_wa_config_service" ON public.platform_whatsapp_config
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 5) Enable realtime for message log
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_message_log;
