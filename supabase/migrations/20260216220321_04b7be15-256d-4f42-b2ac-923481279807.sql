
-- Table for saved report filter presets
CREATE TABLE public.report_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  report_key TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own presets" ON public.report_presets
  FOR SELECT USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create own presets" ON public.report_presets
  FOR INSERT WITH CHECK (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update own presets" ON public.report_presets
  FOR UPDATE USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete own presets" ON public.report_presets
  FOR DELETE USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id());
