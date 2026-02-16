
-- ============================================================
-- Multi-Branch Management Schema
-- ============================================================

-- 1. Branches table
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text,
  code text, -- short code like "RYD", "JED"
  address_city text,
  address_street text,
  address_zip text,
  phone text,
  email text,
  manager_id uuid, -- references a user
  is_active boolean NOT NULL DEFAULT true,
  is_main boolean NOT NULL DEFAULT false, -- main/HQ branch
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: only one main branch per tenant
CREATE UNIQUE INDEX idx_branches_main_per_tenant ON public.branches (tenant_id) WHERE is_main = true;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- 2. Branch Members (which users belong to which branches)
CREATE TABLE public.branch_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid,
  UNIQUE (branch_id, user_id)
);

ALTER TABLE public.branch_members ENABLE ROW LEVEL SECURITY;

-- 3. Security definer functions for branch access
CREATE OR REPLACE FUNCTION public.get_user_branch_ids(_tenant_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(branch_id), '{}')
  FROM public.branch_members
  WHERE user_id = auth.uid()
    AND tenant_id = _tenant_id
$$;

CREATE OR REPLACE FUNCTION public.is_branch_member(_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.branch_members
    WHERE user_id = auth.uid()
      AND branch_id = _branch_id
  )
$$;

-- 4. Add branch_id (nullable for backward compat) to all entity tables
ALTER TABLE public.invoices ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.customers ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.suppliers ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.contracts ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.quotations ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.sales_orders ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- 5. Indexes for performance
CREATE INDEX idx_invoices_branch ON public.invoices(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_expenses_branch ON public.expenses(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_customers_branch ON public.customers(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_products_branch ON public.products(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_quotations_branch ON public.quotations(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_sales_orders_branch ON public.sales_orders(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_purchase_orders_branch ON public.purchase_orders(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_contracts_branch ON public.contracts(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_suppliers_branch ON public.suppliers(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_branch_members_user ON public.branch_members(user_id, tenant_id);

-- 6. RLS policies for branches
CREATE POLICY "Members can view tenant branches"
  ON public.branches FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create branches"
  ON public.branches FOR INSERT
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can update branches"
  ON public.branches FOR UPDATE
  USING (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can delete branches"
  ON public.branches FOR DELETE
  USING (is_tenant_admin(tenant_id) AND is_main = false);

-- 7. RLS policies for branch_members
CREATE POLICY "Members can view branch members"
  ON public.branch_members FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage branch members"
  ON public.branch_members FOR INSERT
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can update branch members"
  ON public.branch_members FOR UPDATE
  USING (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can delete branch members"
  ON public.branch_members FOR DELETE
  USING (is_tenant_admin(tenant_id));

-- 8. Auto-create main branch for existing tenants
-- (trigger for new tenants)
CREATE OR REPLACE FUNCTION public.auto_create_main_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.branches (tenant_id, name, name_en, is_main, is_active)
  VALUES (NEW.id, 'الفرع الرئيسي', 'Main Branch', true, true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_main_branch
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_main_branch();

-- 9. Updated_at trigger for branches
CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Enable realtime for branches
ALTER PUBLICATION supabase_realtime ADD TABLE public.branches;
