
-- =====================================================
-- RLS HARDENING v4: Complete single-transaction migration
-- =====================================================

-- 1. Create has_permission helper
CREATE OR REPLACE FUNCTION public.has_permission(_tenant_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id = _tenant_id
      AND tm.role = 'owner'
  )
  OR EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    JOIN public.custom_roles cr ON cr.tenant_id = _tenant_id AND cr.base_role = tm.role
    JOIN public.role_permissions rp ON rp.role_id = cr.id AND rp.tenant_id = _tenant_id
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id = _tenant_id
      AND rp.permission_key = _permission_key
  )
$$;

-- =====================================================
-- INVOICES
-- =====================================================
DROP POLICY IF EXISTS "Members can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Platform admins can view all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can delete invoices" ON public.invoices;

CREATE POLICY "Role-based view invoices"
ON public.invoices FOR SELECT TO authenticated
USING (
  is_platform_admin()
  OR (
    tenant_id = get_user_tenant_id()
    AND (
      public.has_permission(tenant_id, 'invoices.view')
      OR created_by = auth.uid()
    )
  )
);

CREATE POLICY "Owner can delete invoices"
ON public.invoices FOR DELETE TO authenticated
USING (
  is_platform_admin()
  OR (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.tenant_members tm2
      WHERE tm2.user_id = auth.uid() AND tm2.tenant_id = invoices.tenant_id AND tm2.role = 'owner'
    )
  )
);

-- =====================================================
-- JOURNAL_ENTRIES
-- =====================================================
DROP POLICY IF EXISTS "Members can view journal entries" ON public.journal_entries;

CREATE POLICY "Role-based view journal entries"
ON public.journal_entries FOR SELECT TO authenticated
USING (
  is_platform_admin()
  OR (
    tenant_id = get_user_tenant_id()
    AND public.has_permission(tenant_id, 'journal_entries.view')
  )
);

-- =====================================================
-- CUSTOMERS
-- =====================================================
DROP POLICY IF EXISTS "Members can view customers" ON public.customers;
DROP POLICY IF EXISTS "Members can update customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;

CREATE POLICY "Role-based view customers"
ON public.customers FOR SELECT TO authenticated
USING (
  is_platform_admin()
  OR (
    tenant_id = get_user_tenant_id()
    AND public.has_permission(tenant_id, 'customers.view')
  )
);

CREATE POLICY "Role-based update customers"
ON public.customers FOR UPDATE TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND (
    is_authorized_finance(tenant_id)
    OR public.has_permission(tenant_id, 'customers.edit')
  )
);

CREATE POLICY "Owner can delete customers"
ON public.customers FOR DELETE TO authenticated
USING (
  is_platform_admin()
  OR (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.tenant_members tm2
      WHERE tm2.user_id = auth.uid() AND tm2.tenant_id = customers.tenant_id AND tm2.role = 'owner'
    )
  )
);

-- =====================================================
-- SUPPLIERS
-- =====================================================
DROP POLICY IF EXISTS "Members can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Platform admins can view all suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can delete suppliers" ON public.suppliers;

CREATE POLICY "Role-based view suppliers"
ON public.suppliers FOR SELECT TO authenticated
USING (
  is_platform_admin()
  OR (
    tenant_id = get_user_tenant_id()
    AND public.has_permission(tenant_id, 'suppliers.view')
  )
);

CREATE POLICY "Owner can delete suppliers"
ON public.suppliers FOR DELETE TO authenticated
USING (
  is_platform_admin()
  OR (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.tenant_members tm2
      WHERE tm2.user_id = auth.uid() AND tm2.tenant_id = suppliers.tenant_id AND tm2.role = 'owner'
    )
  )
);

-- =====================================================
-- EXPENSES
-- =====================================================
DROP POLICY IF EXISTS "Members can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Platform admins can view all expenses" ON public.expenses;

CREATE POLICY "Role-based view expenses"
ON public.expenses FOR SELECT
USING (
  is_platform_admin()
  OR (
    auth.uid() IS NOT NULL
    AND tenant_id = get_user_tenant_id()
    AND (
      public.has_permission(tenant_id, 'expenses.view')
      OR created_by = auth.uid()
    )
  )
);

-- =====================================================
-- WALLET_TRANSACTIONS
-- =====================================================
DROP POLICY IF EXISTS "Tenant members can view their wallet transactions" ON public.wallet_transactions;

CREATE POLICY "Role-based view wallet transactions"
ON public.wallet_transactions FOR SELECT
USING (
  is_platform_admin()
  OR (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.tenant_wallets tw
      WHERE tw.id = wallet_transactions.wallet_id
        AND public.has_permission(tw.tenant_id, 'wallet.view')
    )
  )
);

-- =====================================================
-- Seed permission_definitions (correct columns: key, category, name_ar, name_en, description)
-- =====================================================
INSERT INTO public.permission_definitions (key, category, name_ar, name_en, description)
VALUES
  ('invoices.view', 'finance', 'عرض الفواتير', 'View Invoices', 'View invoices in the system'),
  ('journal_entries.view', 'finance', 'عرض القيود المحاسبية', 'View Journal Entries', 'View journal entries'),
  ('customers.view', 'sales', 'عرض العملاء', 'View Customers', 'View customer records'),
  ('customers.edit', 'sales', 'تعديل العملاء', 'Edit Customers', 'Edit customer records'),
  ('suppliers.view', 'finance', 'عرض الموردين', 'View Suppliers', 'View supplier records'),
  ('expenses.view', 'finance', 'عرض المصروفات', 'View Expenses', 'View expense records'),
  ('wallet.view', 'finance', 'عرض المحفظة', 'View Wallet', 'View wallet transactions')
ON CONFLICT (key) DO NOTHING;
