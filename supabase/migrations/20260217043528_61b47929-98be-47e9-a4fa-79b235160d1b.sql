
-- Paid Integrations Catalog (managed by super admin)
CREATE TABLE public.paid_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE, -- e.g. 'pos_foodics', 'ecom_shopify'
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  description_ar TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('pos', 'ecommerce', 'hr_payroll', 'payment_gateway', 'other')),
  icon_name TEXT DEFAULT 'Plug', -- lucide icon name
  monthly_price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  is_available BOOLEAN NOT NULL DEFAULT true,
  requires_api_key BOOLEAN NOT NULL DEFAULT false,
  api_key_label TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.paid_integrations ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view available integrations
CREATE POLICY "Authenticated users can view integrations"
ON public.paid_integrations FOR SELECT TO authenticated
USING (true);

-- Only platform admins can manage
CREATE POLICY "Platform admins can manage integrations"
ON public.paid_integrations FOR ALL
USING (public.is_platform_admin());

-- Tenant Integration Subscriptions
CREATE TABLE public.tenant_paid_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.paid_integrations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  activated_by UUID NOT NULL,
  api_key_encrypted TEXT, -- tenant's API key for the integration
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, integration_id)
);

ALTER TABLE public.tenant_paid_integrations ENABLE ROW LEVEL SECURITY;

-- Tenant members can view their integrations
CREATE POLICY "Tenant members can view their integrations"
ON public.tenant_paid_integrations FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id));

-- Tenant admins can manage their integrations
CREATE POLICY "Tenant admins can manage integrations"
ON public.tenant_paid_integrations FOR INSERT TO authenticated
WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can update integrations"
ON public.tenant_paid_integrations FOR UPDATE TO authenticated
USING (public.is_tenant_admin(tenant_id));

-- Platform admins can view all
CREATE POLICY "Platform admins can view all tenant integrations"
ON public.tenant_paid_integrations FOR SELECT
USING (public.is_platform_admin());

-- Triggers
CREATE TRIGGER update_paid_integrations_updated_at
BEFORE UPDATE ON public.paid_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_paid_integrations_updated_at
BEFORE UPDATE ON public.tenant_paid_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial integrations
INSERT INTO public.paid_integrations (key, name_ar, name_en, description_ar, description_en, category, icon_name, monthly_price, sort_order) VALUES
('pos_foodics', 'فودكس', 'Foodics', 'مزامنة المبيعات والمخزون مع نظام فودكس لنقاط البيع', 'Sync sales and inventory with Foodics POS system', 'pos', 'Monitor', 149, 1),
('pos_square', 'سكوير', 'Square', 'ربط مع نظام سكوير لنقاط البيع والمدفوعات', 'Connect with Square POS and payments', 'pos', 'Tablet', 129, 2),
('ecom_shopify', 'شوبيفاي', 'Shopify', 'مزامنة المنتجات والطلبات مع متجر شوبيفاي', 'Sync products and orders with Shopify store', 'ecommerce', 'ShoppingBag', 199, 3),
('ecom_woocommerce', 'ووكومرس', 'WooCommerce', 'ربط مع متاجر ووكومرس ووردبريس', 'Connect with WooCommerce WordPress stores', 'ecommerce', 'ShoppingCart', 149, 4),
('hr_mudad', 'مدد', 'Mudad', 'ربط مع منصة مدد لإدارة الرواتب والتوافق', 'Connect with Mudad payroll and compliance platform', 'hr_payroll', 'Users', 199, 5),
('hr_jisr', 'جسر', 'Jisr', 'ربط مع نظام جسر لإدارة الموارد البشرية', 'Connect with Jisr HR management system', 'hr_payroll', 'Building2', 179, 6),
('hr_muqeem', 'مقيم', 'Muqeem', 'ربط مع منصة مقيم لإدارة تأشيرات العمالة', 'Connect with Muqeem visa management platform', 'hr_payroll', 'FileCheck', 99, 7),
('pay_tap', 'تاب', 'Tap Payments', 'بوابة دفع إلكتروني متكاملة مع مدى وفيزا', 'Full payment gateway with Mada and Visa support', 'payment_gateway', 'CreditCard', 99, 8),
('pay_hyperpay', 'هايبرباي', 'HyperPay', 'بوابة دفع إلكتروني متعددة القنوات', 'Multi-channel payment gateway', 'payment_gateway', 'Wallet', 119, 9),
('pay_moyasar', 'ميسر', 'Moyasar', 'حلول دفع إلكتروني سعودية', 'Saudi electronic payment solutions', 'payment_gateway', 'Banknote', 89, 10);
