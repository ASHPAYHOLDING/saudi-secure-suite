
-- User Dashboard Layouts — stores widget positions per user per tenant
CREATE TABLE public.user_dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_udl_user_tenant ON public.user_dashboard_layouts(user_id, tenant_id);

ALTER TABLE public.user_dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own layout
CREATE POLICY "udl_select_own" ON public.user_dashboard_layouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "udl_insert_own" ON public.user_dashboard_layouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "udl_update_own" ON public.user_dashboard_layouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "udl_delete_own" ON public.user_dashboard_layouts
  FOR DELETE USING (auth.uid() = user_id);

-- Auto-update timestamp
CREATE TRIGGER update_udl_updated_at
  BEFORE UPDATE ON public.user_dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
