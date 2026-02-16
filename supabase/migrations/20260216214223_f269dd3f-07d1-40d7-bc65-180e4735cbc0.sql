
-- ============================================================
-- GRANULAR PERMISSIONS SYSTEM
-- ============================================================

-- 1. Permission definitions catalog (platform-wide, not tenant-scoped)
CREATE TABLE public.permission_definitions (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view permissions"
  ON public.permission_definitions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2. Custom roles per tenant
CREATE TABLE public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT 'bg-muted text-muted-foreground',
  is_system BOOLEAN NOT NULL DEFAULT false,
  base_role app_role DEFAULT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view roles"
  ON public.custom_roles FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create roles"
  ON public.custom_roles FOR INSERT
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can update non-system roles"
  ON public.custom_roles FOR UPDATE
  USING (is_tenant_admin(tenant_id) AND is_system = false);

CREATE POLICY "Admins can delete non-system roles"
  ON public.custom_roles FOR DELETE
  USING (is_tenant_admin(tenant_id) AND is_system = false);

-- 3. Role-permission junction
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permission_definitions(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, role_id, permission_key)
);

CREATE INDEX idx_role_permissions_lookup ON public.role_permissions(role_id, permission_key);
CREATE INDEX idx_role_permissions_tenant ON public.role_permissions(tenant_id);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view role permissions"
  ON public.role_permissions FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage role permissions"
  ON public.role_permissions FOR INSERT
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can delete role permissions"
  ON public.role_permissions FOR DELETE
  USING (is_tenant_admin(tenant_id));

-- 4. Permission templates (reusable permission sets)
CREATE TABLE public.permission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description TEXT DEFAULT '',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  is_global BOOLEAN NOT NULL DEFAULT false,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own or global templates"
  ON public.permission_templates FOR SELECT
  USING (is_global = true OR tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create templates"
  ON public.permission_templates FOR INSERT
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can update own templates"
  ON public.permission_templates FOR UPDATE
  USING (is_tenant_admin(tenant_id) AND is_global = false);

CREATE POLICY "Admins can delete own templates"
  ON public.permission_templates FOR DELETE
  USING (is_tenant_admin(tenant_id) AND is_global = false);

-- 5. Security definer function for permission checks
CREATE OR REPLACE FUNCTION public.user_has_permission(_permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    JOIN public.custom_roles cr ON cr.tenant_id = tm.tenant_id AND cr.base_role = tm.role
    JOIN public.role_permissions rp ON rp.role_id = cr.id AND rp.permission_key = _permission_key
    WHERE tm.user_id = auth.uid()
    LIMIT 1
  )
$$;

-- 6. Seed all 60+ permission definitions
INSERT INTO public.permission_definitions (key, category, name_ar, name_en, sort_order) VALUES
-- Invoices (10)
('invoices.view', 'invoices', 'عرض الفواتير', 'View Invoices', 1),
('invoices.create', 'invoices', 'إنشاء فاتورة', 'Create Invoice', 2),
('invoices.edit', 'invoices', 'تعديل فاتورة', 'Edit Invoice', 3),
('invoices.delete', 'invoices', 'حذف فاتورة', 'Delete Invoice', 4),
('invoices.approve', 'invoices', 'اعتماد فاتورة', 'Approve Invoice', 5),
('invoices.send', 'invoices', 'إرسال فاتورة', 'Send Invoice', 6),
('invoices.mark_paid', 'invoices', 'تسجيل دفع', 'Mark as Paid', 7),
('invoices.cancel', 'invoices', 'إلغاء فاتورة', 'Cancel Invoice', 8),
('invoices.export', 'invoices', 'تصدير الفواتير', 'Export Invoices', 9),
('invoices.ocr', 'invoices', 'مسح فاتورة ذكي', 'OCR Invoice Scan', 10),
-- Expenses (9)
('expenses.view', 'expenses', 'عرض المصروفات', 'View Expenses', 11),
('expenses.create', 'expenses', 'إنشاء مصروف', 'Create Expense', 12),
('expenses.edit', 'expenses', 'تعديل مصروف', 'Edit Expense', 13),
('expenses.delete', 'expenses', 'حذف مصروف', 'Delete Expense', 14),
('expenses.approve', 'expenses', 'اعتماد مصروف', 'Approve Expense', 15),
('expenses.reject', 'expenses', 'رفض مصروف', 'Reject Expense', 16),
('expenses.export', 'expenses', 'تصدير المصروفات', 'Export Expenses', 17),
('expenses.upload_receipt', 'expenses', 'رفع إيصال', 'Upload Receipt', 18),
('expenses.manage_categories', 'expenses', 'إدارة الفئات', 'Manage Categories', 19),
-- Customers (6)
('customers.view', 'customers', 'عرض العملاء', 'View Customers', 20),
('customers.create', 'customers', 'إضافة عميل', 'Create Customer', 21),
('customers.edit', 'customers', 'تعديل عميل', 'Edit Customer', 22),
('customers.delete', 'customers', 'حذف عميل', 'Delete Customer', 23),
('customers.import', 'customers', 'استيراد عملاء', 'Import Customers', 24),
('customers.export', 'customers', 'تصدير عملاء', 'Export Customers', 25),
-- Suppliers (4)
('suppliers.view', 'suppliers', 'عرض الموردين', 'View Suppliers', 26),
('suppliers.create', 'suppliers', 'إضافة مورد', 'Create Supplier', 27),
('suppliers.edit', 'suppliers', 'تعديل مورد', 'Edit Supplier', 28),
('suppliers.delete', 'suppliers', 'حذف مورد', 'Delete Supplier', 29),
-- Contracts (6)
('contracts.view', 'contracts', 'عرض العقود', 'View Contracts', 30),
('contracts.create', 'contracts', 'إنشاء عقد', 'Create Contract', 31),
('contracts.edit', 'contracts', 'تعديل عقد', 'Edit Contract', 32),
('contracts.delete', 'contracts', 'حذف عقد', 'Delete Contract', 33),
('contracts.sign', 'contracts', 'توقيع عقد', 'Sign Contract', 34),
('contracts.approve', 'contracts', 'اعتماد عقد', 'Approve Contract', 35),
-- Quotations (7)
('quotations.view', 'quotations', 'عرض عروض الأسعار', 'View Quotations', 36),
('quotations.create', 'quotations', 'إنشاء عرض سعر', 'Create Quotation', 37),
('quotations.edit', 'quotations', 'تعديل عرض سعر', 'Edit Quotation', 38),
('quotations.delete', 'quotations', 'حذف عرض سعر', 'Delete Quotation', 39),
('quotations.approve', 'quotations', 'اعتماد عرض سعر', 'Approve Quotation', 40),
('quotations.send', 'quotations', 'إرسال عرض سعر', 'Send Quotation', 41),
('quotations.convert', 'quotations', 'تحويل لفاتورة', 'Convert to Invoice', 42),
-- Sales Orders (7)
('sales_orders.view', 'sales_orders', 'عرض أوامر البيع', 'View Sales Orders', 43),
('sales_orders.create', 'sales_orders', 'إنشاء أمر بيع', 'Create Sales Order', 44),
('sales_orders.edit', 'sales_orders', 'تعديل أمر بيع', 'Edit Sales Order', 45),
('sales_orders.delete', 'sales_orders', 'حذف أمر بيع', 'Delete Sales Order', 46),
('sales_orders.confirm', 'sales_orders', 'تأكيد أمر بيع', 'Confirm Sales Order', 47),
('sales_orders.cancel', 'sales_orders', 'إلغاء أمر بيع', 'Cancel Sales Order', 48),
('sales_orders.fulfill', 'sales_orders', 'تنفيذ أمر بيع', 'Fulfill Sales Order', 49),
-- Purchase Orders (7)
('purchase_orders.view', 'purchase_orders', 'عرض أوامر الشراء', 'View Purchase Orders', 50),
('purchase_orders.create', 'purchase_orders', 'إنشاء أمر شراء', 'Create Purchase Order', 51),
('purchase_orders.edit', 'purchase_orders', 'تعديل أمر شراء', 'Edit Purchase Order', 52),
('purchase_orders.delete', 'purchase_orders', 'حذف أمر شراء', 'Delete Purchase Order', 53),
('purchase_orders.approve', 'purchase_orders', 'اعتماد أمر شراء', 'Approve Purchase Order', 54),
('purchase_orders.reject', 'purchase_orders', 'رفض أمر شراء', 'Reject Purchase Order', 55),
('purchase_orders.receive', 'purchase_orders', 'استلام أمر شراء', 'Receive Purchase Order', 56),
-- Inventory (6)
('inventory.view', 'inventory', 'عرض المخزون', 'View Inventory', 57),
('inventory.create_product', 'inventory', 'إضافة منتج', 'Create Product', 58),
('inventory.edit_product', 'inventory', 'تعديل منتج', 'Edit Product', 59),
('inventory.delete_product', 'inventory', 'حذف منتج', 'Delete Product', 60),
('inventory.adjust_stock', 'inventory', 'تعديل المخزون', 'Adjust Stock', 61),
('inventory.view_movements', 'inventory', 'عرض حركات المخزون', 'View Stock Movements', 62),
-- Finance & Reports (4)
('finance.view_overview', 'finance', 'عرض النظرة المالية', 'View Financial Overview', 63),
('finance.view_reports', 'finance', 'عرض التقارير', 'View Reports', 64),
('finance.export_reports', 'finance', 'تصدير التقارير', 'Export Reports', 65),
('finance.view_analytics', 'finance', 'عرض التحليلات', 'View Analytics', 66),
-- Team & Users (4)
('team.view', 'team', 'عرض الفريق', 'View Team', 67),
('team.invite', 'team', 'دعوة عضو', 'Invite Member', 68),
('team.edit_roles', 'team', 'تعديل الأدوار', 'Edit Roles', 69),
('team.remove', 'team', 'إزالة عضو', 'Remove Member', 70),
-- Settings & Config (8)
('settings.view', 'settings', 'عرض الإعدادات', 'View Settings', 71),
('settings.edit', 'settings', 'تعديل الإعدادات', 'Edit Settings', 72),
('settings.company', 'settings', 'إعدادات الشركة', 'Company Settings', 73),
('settings.branding', 'settings', 'إعدادات العلامة', 'Branding Settings', 74),
('settings.compliance', 'settings', 'إعدادات الامتثال', 'Compliance Settings', 75),
('settings.stamp', 'settings', 'إدارة الختم', 'Stamp Management', 76),
('settings.integrations', 'settings', 'إدارة التكاملات', 'Manage Integrations', 77),
('settings.templates', 'settings', 'إدارة القوالب', 'Manage Templates', 78),
-- Branches (4)
('branches.view', 'branches', 'عرض الفروع', 'View Branches', 79),
('branches.create', 'branches', 'إنشاء فرع', 'Create Branch', 80),
('branches.edit', 'branches', 'تعديل فرع', 'Edit Branch', 81),
('branches.manage_members', 'branches', 'إدارة أعضاء الفرع', 'Manage Branch Members', 82),
-- Audit (1)
('audit.view', 'audit', 'عرض سجل التدقيق', 'View Audit Log', 83),
-- Subscription (2)
('subscription.view', 'subscription', 'عرض الاشتراك', 'View Subscription', 84),
('subscription.manage', 'subscription', 'إدارة الاشتراك', 'Manage Subscription', 85);

-- 7. Auto-seed system roles for new tenants
CREATE OR REPLACE FUNCTION public.auto_seed_system_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role_id UUID;
  _owner_perms TEXT[];
  _admin_perms TEXT[];
  _manager_perms TEXT[];
  _hr_perms TEXT[];
  _accountant_perms TEXT[];
  _member_perms TEXT[];
  _perm TEXT;
BEGIN
  -- Gather all permission keys
  SELECT array_agg(key) INTO _owner_perms FROM public.permission_definitions;

  -- Admin = everything except subscription.manage
  SELECT array_agg(key) INTO _admin_perms FROM public.permission_definitions WHERE key <> 'subscription.manage';

  -- Manager
  _manager_perms := ARRAY[
    'invoices.view','invoices.create','invoices.edit','invoices.send','invoices.export',
    'expenses.view','expenses.create','expenses.edit','expenses.approve','expenses.reject','expenses.export','expenses.upload_receipt',
    'customers.view','customers.create','customers.edit','customers.export',
    'suppliers.view','suppliers.create','suppliers.edit',
    'contracts.view','contracts.create','contracts.edit','contracts.approve',
    'quotations.view','quotations.create','quotations.edit','quotations.approve','quotations.send','quotations.convert',
    'sales_orders.view','sales_orders.create','sales_orders.edit','sales_orders.confirm','sales_orders.fulfill',
    'purchase_orders.view','purchase_orders.create','purchase_orders.edit','purchase_orders.approve',
    'inventory.view','inventory.create_product','inventory.edit_product','inventory.adjust_stock','inventory.view_movements',
    'finance.view_overview','finance.view_reports',
    'team.view',
    'settings.view',
    'branches.view',
    'audit.view',
    'subscription.view'
  ];

  -- HR
  _hr_perms := ARRAY[
    'team.view','team.invite','team.edit_roles','team.remove',
    'expenses.view','expenses.create','expenses.edit','expenses.approve','expenses.reject','expenses.upload_receipt',
    'customers.view','suppliers.view',
    'contracts.view',
    'settings.view',
    'branches.view',
    'audit.view',
    'subscription.view'
  ];

  -- Accountant
  _accountant_perms := ARRAY[
    'invoices.view','invoices.create','invoices.edit','invoices.approve','invoices.send','invoices.mark_paid','invoices.cancel','invoices.export','invoices.ocr',
    'expenses.view','expenses.create','expenses.edit','expenses.approve','expenses.reject','expenses.export','expenses.upload_receipt','expenses.manage_categories',
    'customers.view','customers.create','customers.edit','customers.export',
    'suppliers.view','suppliers.create','suppliers.edit',
    'contracts.view','contracts.create','contracts.edit',
    'quotations.view','quotations.create','quotations.edit','quotations.approve','quotations.send','quotations.convert',
    'sales_orders.view','sales_orders.create','sales_orders.edit','sales_orders.confirm',
    'purchase_orders.view','purchase_orders.create','purchase_orders.edit','purchase_orders.approve','purchase_orders.receive',
    'inventory.view','inventory.create_product','inventory.edit_product','inventory.adjust_stock','inventory.view_movements',
    'finance.view_overview','finance.view_reports','finance.export_reports','finance.view_analytics',
    'settings.view',
    'branches.view',
    'subscription.view'
  ];

  -- Member (read-only mostly)
  _member_perms := ARRAY[
    'invoices.view',
    'expenses.view','expenses.create','expenses.upload_receipt',
    'customers.view',
    'suppliers.view',
    'contracts.view',
    'quotations.view',
    'sales_orders.view',
    'purchase_orders.view',
    'inventory.view',
    'finance.view_overview',
    'team.view',
    'settings.view',
    'branches.view',
    'subscription.view'
  ];

  -- Create system roles and their permissions
  -- Owner
  INSERT INTO public.custom_roles (tenant_id, name, name_ar, is_system, base_role, color, created_by)
  VALUES (NEW.id, 'owner', 'مالك', true, 'owner', 'bg-accent/10 text-accent', NEW.created_by)
  RETURNING id INTO _role_id;
  INSERT INTO public.role_permissions (tenant_id, role_id, permission_key)
  SELECT NEW.id, _role_id, unnest(_owner_perms);

  -- Admin
  INSERT INTO public.custom_roles (tenant_id, name, name_ar, is_system, base_role, color, created_by)
  VALUES (NEW.id, 'admin', 'مدير', true, 'admin', 'bg-info/10 text-info', NEW.created_by)
  RETURNING id INTO _role_id;
  INSERT INTO public.role_permissions (tenant_id, role_id, permission_key)
  SELECT NEW.id, _role_id, unnest(_admin_perms);

  -- Manager
  INSERT INTO public.custom_roles (tenant_id, name, name_ar, is_system, base_role, color, created_by)
  VALUES (NEW.id, 'manager', 'مدير قسم', true, 'manager', 'bg-warning/10 text-warning', NEW.created_by)
  RETURNING id INTO _role_id;
  INSERT INTO public.role_permissions (tenant_id, role_id, permission_key)
  SELECT NEW.id, _role_id, unnest(_manager_perms);

  -- HR
  INSERT INTO public.custom_roles (tenant_id, name, name_ar, is_system, base_role, color, created_by)
  VALUES (NEW.id, 'hr', 'موارد بشرية', true, 'hr', 'bg-success/10 text-success', NEW.created_by)
  RETURNING id INTO _role_id;
  INSERT INTO public.role_permissions (tenant_id, role_id, permission_key)
  SELECT NEW.id, _role_id, unnest(_hr_perms);

  -- Accountant
  INSERT INTO public.custom_roles (tenant_id, name, name_ar, is_system, base_role, color, created_by)
  VALUES (NEW.id, 'accountant', 'محاسب', true, 'accountant', 'bg-primary/10 text-primary-foreground', NEW.created_by)
  RETURNING id INTO _role_id;
  INSERT INTO public.role_permissions (tenant_id, role_id, permission_key)
  SELECT NEW.id, _role_id, unnest(_accountant_perms);

  -- Member
  INSERT INTO public.custom_roles (tenant_id, name, name_ar, is_system, base_role, color, created_by)
  VALUES (NEW.id, 'member', 'موظف', true, 'member', 'bg-muted text-muted-foreground', NEW.created_by)
  RETURNING id INTO _role_id;
  INSERT INTO public.role_permissions (tenant_id, role_id, permission_key)
  SELECT NEW.id, _role_id, unnest(_member_perms);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_system_roles
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_seed_system_roles();

-- 8. Update updated_at triggers
CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_permission_templates_updated_at
  BEFORE UPDATE ON public.permission_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
