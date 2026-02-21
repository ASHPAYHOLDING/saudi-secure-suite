
-- ═══════════════════════════════════════════════════════════════════
-- Step 1: Add 5 missing permission definitions
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO public.permission_definitions (key, category, name_ar, name_en, description, sort_order)
VALUES
  ('company.view',      'company',      'عرض إعدادات المنشأة',    'View Company Settings',  'عرض بيانات المنشأة والإعدادات الأساسية', 90),
  ('integrations.view', 'integrations', 'عرض التكاملات',          'View Integrations',      'عرض صفحة التكاملات الرئيسية',           91),
  ('chat.view',         'chat',         'عرض المحادثات',          'View Chat',              'الوصول لمحادثات الفريق الداخلية',        92),
  ('api_keys.view',     'integrations', 'عرض مفاتيح API',        'View API Keys',          'عرض وإدارة مفاتيح الوصول البرمجي',       93),
  ('templates.manage',  'documents',    'إدارة القوالب',          'Manage Templates',       'تصميم وتعديل قوالب المستندات',           94)
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- Step 2: Add permissions to roles for ALL existing tenants
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO public.role_permissions (tenant_id, role_id, permission_key)
SELECT cr.tenant_id, cr.id, perm.key
FROM public.custom_roles cr
CROSS JOIN (
  VALUES
    ('company.view',      ARRAY['owner','admin','manager']),
    ('integrations.view', ARRAY['owner','admin']),
    ('chat.view',         ARRAY['owner','admin','manager','member','accountant','hr']),
    ('api_keys.view',     ARRAY['owner','admin']),
    ('templates.manage',  ARRAY['owner','admin'])
) AS perm(key, roles)
WHERE cr.name = ANY(perm.roles)
  AND cr.is_system = true
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- Step 3: Update seed function for future tenants
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.seed_role_permissions_for_tenant(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role RECORD;
  _perms text[];
  _owner_perms text[] := ARRAY[
    'audit.view','branches.create','branches.edit','branches.manage_members','branches.view',
    'contracts.approve','contracts.create','contracts.delete','contracts.edit','contracts.sign','contracts.view',
    'customers.create','customers.delete','customers.edit','customers.export','customers.import','customers.view',
    'expenses.approve','expenses.create','expenses.delete','expenses.edit','expenses.export','expenses.manage_categories','expenses.reject','expenses.upload_receipt','expenses.view',
    'finance.export_reports','finance.view_analytics','finance.view_overview','finance.view_reports',
    'inventory.adjust_stock','inventory.create_product','inventory.delete_product','inventory.edit_product','inventory.view','inventory.view_movements',
    'invoices.approve','invoices.cancel','invoices.create','invoices.delete','invoices.edit','invoices.export','invoices.mark_paid','invoices.ocr','invoices.send','invoices.view',
    'purchase_orders.approve','purchase_orders.create','purchase_orders.delete','purchase_orders.edit','purchase_orders.receive','purchase_orders.reject','purchase_orders.view',
    'quotations.approve','quotations.convert','quotations.create','quotations.delete','quotations.edit','quotations.send','quotations.view',
    'sales_orders.cancel','sales_orders.confirm','sales_orders.create','sales_orders.delete','sales_orders.edit','sales_orders.fulfill','sales_orders.view',
    'settings.branding','settings.company','settings.compliance','settings.edit','settings.integrations','settings.stamp','settings.templates','settings.view',
    'subscription.manage','subscription.view',
    'suppliers.create','suppliers.delete','suppliers.edit','suppliers.view',
    'team.edit_roles','team.invite','team.remove','team.view',
    'company.view','integrations.view','chat.view','api_keys.view','templates.manage'
  ];
  _admin_perms text[] := _owner_perms;
  _manager_perms text[] := ARRAY[
    'contracts.view','customers.view','customers.create','customers.edit',
    'expenses.view','expenses.create','expenses.edit','expenses.approve',
    'finance.view_overview','finance.view_reports',
    'inventory.view','inventory.create_product','inventory.edit_product',
    'invoices.view','invoices.create','invoices.edit','invoices.approve','invoices.send',
    'purchase_orders.view','purchase_orders.create','purchase_orders.edit','purchase_orders.approve',
    'quotations.view','quotations.create','quotations.edit','quotations.approve','quotations.send',
    'sales_orders.view','sales_orders.create','sales_orders.edit','sales_orders.confirm',
    'suppliers.view','suppliers.create','suppliers.edit',
    'team.view','branches.view',
    'company.view','chat.view'
  ];
  _member_perms text[] := ARRAY[
    'customers.view','expenses.view','expenses.create','expenses.upload_receipt',
    'inventory.view','invoices.view',
    'purchase_orders.view','quotations.view','sales_orders.view',
    'suppliers.view','settings.view',
    'chat.view'
  ];
  _accountant_perms text[] := ARRAY[
    'audit.view','customers.view','expenses.view','expenses.create','expenses.edit','expenses.approve',
    'finance.export_reports','finance.view_analytics','finance.view_overview','finance.view_reports',
    'inventory.view','inventory.view_movements',
    'invoices.view','invoices.create','invoices.edit','invoices.export','invoices.mark_paid',
    'purchase_orders.view','purchase_orders.create','purchase_orders.edit',
    'quotations.view','sales_orders.view',
    'settings.view','suppliers.view',
    'chat.view'
  ];
  _hr_perms text[] := ARRAY[
    'team.view','team.invite','team.remove','team.edit_roles',
    'branches.view','settings.view','expenses.view',
    'chat.view'
  ];
BEGIN
  FOR _role IN SELECT id, name FROM custom_roles WHERE tenant_id = p_tenant_id AND is_system = true
  LOOP
    CASE _role.name
      WHEN 'owner' THEN _perms := _owner_perms;
      WHEN 'admin' THEN _perms := _admin_perms;
      WHEN 'manager' THEN _perms := _manager_perms;
      WHEN 'member' THEN _perms := _member_perms;
      WHEN 'accountant' THEN _perms := _accountant_perms;
      WHEN 'hr' THEN _perms := _hr_perms;
      ELSE _perms := ARRAY[]::text[];
    END CASE;

    INSERT INTO role_permissions (tenant_id, role_id, permission_key)
    SELECT p_tenant_id, _role.id, unnest(_perms)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;
