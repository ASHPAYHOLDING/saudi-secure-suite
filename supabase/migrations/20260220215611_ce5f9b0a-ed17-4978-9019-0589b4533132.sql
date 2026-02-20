-- Create tenant_marketing_integrations table
CREATE TABLE IF NOT EXISTS public.tenant_marketing_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secrets_encrypted text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

-- Create marketing_events_logs table
CREATE TABLE IF NOT EXISTS public.marketing_events_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'tiktok',
  event_name text NOT NULL,
  status_code integer,
  response_body text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_marketing_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_events_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant_marketing_integrations
CREATE POLICY "tenant_marketing_integrations_select"
  ON public.tenant_marketing_integrations FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "tenant_marketing_integrations_insert"
  ON public.tenant_marketing_integrations FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "tenant_marketing_integrations_update"
  ON public.tenant_marketing_integrations FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "tenant_marketing_integrations_delete"
  ON public.tenant_marketing_integrations FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
  ));

-- Service role bypass
CREATE POLICY "tenant_marketing_integrations_service_role"
  ON public.tenant_marketing_integrations FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for marketing_events_logs
CREATE POLICY "marketing_events_logs_select"
  ON public.marketing_events_logs FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "marketing_events_logs_insert"
  ON public.marketing_events_logs FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "marketing_events_logs_service_role"
  ON public.marketing_events_logs FOR ALL
  USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_marketing_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tenant_marketing_integrations_updated_at
  BEFORE UPDATE ON public.tenant_marketing_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_marketing_integrations_updated_at();
