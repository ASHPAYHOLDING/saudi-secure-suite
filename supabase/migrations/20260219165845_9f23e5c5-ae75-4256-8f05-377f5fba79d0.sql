
-- Add national address fields to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS building_number TEXT,
  ADD COLUMN IF NOT EXISTS address_district TEXT,
  ADD COLUMN IF NOT EXISTS additional_number TEXT;

-- Create zatca_settings table
CREATE TABLE public.zatca_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  zatca_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (zatca_status IN ('connected', 'pending', 'expired', 'error', 'disconnected')),
  last_credential_refresh TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  credential_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.zatca_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view zatca settings"
ON public.zatca_settings FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can insert zatca settings"
ON public.zatca_settings FOR INSERT
WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')));

CREATE POLICY "Admins can update zatca settings"
ON public.zatca_settings FOR UPDATE
USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')));

CREATE TRIGGER update_zatca_settings_updated_at
BEFORE UPDATE ON public.zatca_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.zatca_settings;
