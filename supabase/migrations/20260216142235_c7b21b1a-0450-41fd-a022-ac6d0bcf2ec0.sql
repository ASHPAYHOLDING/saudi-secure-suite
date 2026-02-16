
-- Feature flags table
CREATE TABLE public.feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  description text DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  is_enabled_globally boolean NOT NULL DEFAULT false,
  enabled_plans uuid[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tenant-level overrides
CREATE TABLE public.tenant_feature_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.feature_flags(key) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  overridden_by uuid NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, feature_key)
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Feature flags policies
CREATE POLICY "Anyone authenticated can view feature flags"
  ON public.feature_flags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins can insert feature flags"
  ON public.feature_flags FOR INSERT WITH CHECK (is_platform_admin());

CREATE POLICY "Platform admins can update feature flags"
  ON public.feature_flags FOR UPDATE USING (is_platform_admin());

CREATE POLICY "Platform admins can delete feature flags"
  ON public.feature_flags FOR DELETE USING (is_platform_admin());

-- Tenant feature overrides policies
CREATE POLICY "Platform admins can view all overrides"
  ON public.tenant_feature_overrides FOR SELECT USING (is_platform_admin());

CREATE POLICY "Tenant members can view own overrides"
  ON public.tenant_feature_overrides FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Platform admins can insert overrides"
  ON public.tenant_feature_overrides FOR INSERT WITH CHECK (is_platform_admin());

CREATE POLICY "Platform admins can update overrides"
  ON public.tenant_feature_overrides FOR UPDATE USING (is_platform_admin());

CREATE POLICY "Platform admins can delete overrides"
  ON public.tenant_feature_overrides FOR DELETE USING (is_platform_admin());

-- Trigger for updated_at
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_feature_overrides_updated_at
  BEFORE UPDATE ON public.tenant_feature_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Also add RLS policies for subscription_plans management by platform admins
CREATE POLICY "Platform admins can view all plans"
  ON public.subscription_plans FOR SELECT USING (is_platform_admin());

CREATE POLICY "Platform admins can insert plans"
  ON public.subscription_plans FOR INSERT WITH CHECK (is_platform_admin());

CREATE POLICY "Platform admins can update plans"
  ON public.subscription_plans FOR UPDATE USING (is_platform_admin());

CREATE POLICY "Platform admins can delete plans"
  ON public.subscription_plans FOR DELETE USING (is_platform_admin());

-- Seed default feature flags
INSERT INTO public.feature_flags (key, name_ar, name_en, category, is_enabled_globally) VALUES
  ('accounting', 'المحاسبة', 'Accounting', 'modules', true),
  ('hr', 'الموارد البشرية', 'HR', 'modules', false),
  ('payroll', 'الرواتب', 'Payroll', 'modules', false),
  ('contracts', 'العقود', 'Contracts', 'modules', true),
  ('invoicing', 'الفوترة', 'Invoicing', 'modules', true),
  ('api_access', 'الوصول عبر API', 'API Access', 'integrations', false),
  ('advanced_reports', 'التقارير المتقدمة', 'Advanced Reports', 'analytics', false),
  ('digital_stamp', 'الختم الرقمي', 'Digital Stamp', 'features', true),
  ('zatca_phase2', 'فاتورة المرحلة الثانية', 'ZATCA Phase 2', 'compliance', false),
  ('multi_currency', 'العملات المتعددة', 'Multi Currency', 'features', false),
  ('audit_logs', 'سجل المراجعة', 'Audit Logs', 'features', true),
  ('custom_branding', 'الهوية المخصصة', 'Custom Branding', 'features', false);
