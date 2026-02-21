
-- Role Templates table
CREATE TABLE public.role_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description_ar text,
  description_en text,
  icon text DEFAULT 'Shield',
  is_enterprise_only boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Role Template Permissions
CREATE TABLE public.role_template_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.role_templates(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permission_definitions(key) ON DELETE CASCADE,
  UNIQUE(template_id, permission_key)
);

-- RLS
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_template_permissions ENABLE ROW LEVEL SECURITY;

-- Readable by any authenticated user (templates are global, not tenant-specific)
CREATE POLICY "Authenticated users can read role_templates"
ON public.role_templates FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can read role_template_permissions"
ON public.role_template_permissions FOR SELECT TO authenticated
USING (true);

-- Only platform admins can modify
CREATE POLICY "Platform admins can manage role_templates"
ON public.role_templates FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

CREATE POLICY "Platform admins can manage role_template_permissions"
ON public.role_template_permissions FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- Seed templates
INSERT INTO public.role_templates (key, name_ar, name_en, description_ar, description_en, icon, is_enterprise_only) VALUES
  ('accountant', 'محاسب', 'Accountant', 'إدارة الفواتير والمصروفات والقيود اليومية', 'Manage invoices, expenses, and journal entries', 'Calculator', false),
  ('cfo', 'المدير المالي', 'CFO', 'إشراف مالي شامل مع تقارير وتحليلات متقدمة', 'Full financial oversight with advanced reports and analytics', 'TrendingUp', true),
  ('auditor', 'مراجع حسابات', 'Auditor', 'صلاحيات قراءة فقط للتدقيق والمراجعة المالية', 'Read-only access for auditing and financial review', 'Search', true),
  ('cashier', 'أمين صندوق', 'Cashier', 'إنشاء فواتير وإدارة المدفوعات والمحفظة', 'Create invoices, manage payments and wallet', 'Wallet', false);

-- Seed template permissions
-- Accountant
INSERT INTO public.role_template_permissions (template_id, permission_key)
SELECT rt.id, pk.key FROM public.role_templates rt
CROSS JOIN (VALUES
  ('invoices.view'),('invoices.create'),('invoices.edit'),('invoices.delete'),('invoices.send'),('invoices.mark_paid'),('invoices.export'),('invoices.ocr'),
  ('expenses.view'),('expenses.create'),('expenses.edit'),('expenses.delete'),('expenses.approve'),('expenses.upload_receipt'),('expenses.export'),('expenses.manage_categories'),
  ('customers.view'),
  ('finance.view_overview'),('finance.view_reports')
) AS pk(key) WHERE rt.key = 'accountant';

-- CFO
INSERT INTO public.role_template_permissions (template_id, permission_key)
SELECT rt.id, pk.key FROM public.role_templates rt
CROSS JOIN (VALUES
  ('finance.view_overview'),('finance.view_reports'),('finance.view_analytics'),('finance.export_reports'),
  ('invoices.view'),('invoices.approve'),('invoices.export'),
  ('expenses.view'),('expenses.approve'),('expenses.reject'),('expenses.export'),
  ('customers.view'),('suppliers.view'),
  ('audit.view'),
  ('subscription.view')
) AS pk(key) WHERE rt.key = 'cfo';

-- Auditor (read-only)
INSERT INTO public.role_template_permissions (template_id, permission_key)
SELECT rt.id, pk.key FROM public.role_templates rt
CROSS JOIN (VALUES
  ('finance.view_overview'),('finance.view_reports'),('finance.view_analytics'),('finance.export_reports'),
  ('audit.view'),
  ('invoices.view'),('expenses.view'),('customers.view'),('suppliers.view'),
  ('inventory.view'),('inventory.view_movements'),
  ('contracts.view'),('quotations.view'),('sales_orders.view'),('purchase_orders.view')
) AS pk(key) WHERE rt.key = 'auditor';

-- Cashier
INSERT INTO public.role_template_permissions (template_id, permission_key)
SELECT rt.id, pk.key FROM public.role_templates rt
CROSS JOIN (VALUES
  ('invoices.create'),('invoices.view'),('invoices.send'),('invoices.mark_paid'),
  ('customers.view'),
  ('finance.view_overview')
) AS pk(key) WHERE rt.key = 'cashier';
