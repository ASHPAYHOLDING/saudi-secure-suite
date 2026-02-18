
-- =============================================
-- HOLDING COMPANY (GROUP) SYSTEM
-- =============================================

-- 1. Add parent_tenant_id to tenants for group hierarchy
ALTER TABLE public.tenants ADD COLUMN parent_tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX idx_tenants_parent ON public.tenants(parent_tenant_id) WHERE parent_tenant_id IS NOT NULL;

-- 2. Group Admins table - users with group-level access
CREATE TABLE public.group_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'group_admin' CHECK (role IN ('group_owner','group_admin','group_viewer')),
  can_manage_subsidiaries BOOLEAN DEFAULT true,
  can_view_consolidated BOOLEAN DEFAULT true,
  can_access_subsidiaries BOOLEAN DEFAULT true,
  can_manage_users BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_tenant_id, user_id)
);

ALTER TABLE public.group_admins ENABLE ROW LEVEL SECURITY;

-- Security definer function to check group admin status
CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id UUID, _parent_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_admins
    WHERE user_id = _user_id AND parent_tenant_id = _parent_tenant_id
  );
$$;

-- RLS: group admins can see their own records
CREATE POLICY "Group admins can view own records" ON public.group_admins
  FOR SELECT USING (public.is_group_admin(auth.uid(), parent_tenant_id));

CREATE POLICY "Group owners can manage" ON public.group_admins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.group_admins ga
      WHERE ga.user_id = auth.uid()
        AND ga.parent_tenant_id = group_admins.parent_tenant_id
        AND ga.role = 'group_owner'
    )
  );

-- 3. Intercompany Links - mark customers/suppliers as intercompany
CREATE TABLE public.intercompany_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  linked_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  customer_id UUID REFERENCES public.customers(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  link_type TEXT NOT NULL DEFAULT 'auto' CHECK (link_type IN ('auto','manual')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(tenant_id, linked_tenant_id)
);

ALTER TABLE public.intercompany_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group admins can manage intercompany links" ON public.intercompany_links
  FOR ALL USING (public.is_group_admin(auth.uid(), parent_tenant_id));

CREATE INDEX idx_intercompany_parent ON public.intercompany_links(parent_tenant_id);
CREATE INDEX idx_intercompany_tenant ON public.intercompany_links(tenant_id);

-- 4. Consolidated report function - P&L
CREATE OR REPLACE FUNCTION public.get_consolidated_pl(
  _parent_tenant_id UUID,
  _date_from DATE DEFAULT NULL,
  _date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  category TEXT,
  account_name TEXT,
  tenant_id UUID,
  tenant_name TEXT,
  total_debit NUMERIC,
  total_credit NUMERIC,
  net_amount NUMERIC,
  is_intercompany BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_group_admin(auth.uid(), _parent_tenant_id) THEN
    RAISE EXCEPTION 'Access denied: not a group admin';
  END IF;

  RETURN QUERY
  WITH subsidiary_ids AS (
    SELECT t.id, t.name FROM public.tenants t
    WHERE t.parent_tenant_id = _parent_tenant_id OR t.id = _parent_tenant_id
  ),
  intercompany_entries AS (
    SELECT je.id AS entry_id
    FROM public.journal_entries je
    JOIN public.intercompany_links ic ON (
      je.tenant_id = ic.tenant_id OR je.tenant_id = ic.linked_tenant_id
    )
    WHERE ic.parent_tenant_id = _parent_tenant_id AND ic.is_active = true
      AND je.source_type IN ('invoice','expense')
  ),
  pl_data AS (
    SELECT
      CASE
        WHEN jel.account_name ILIKE '%إيراد%' OR jel.account_name ILIKE '%revenue%' OR jel.account_name ILIKE '%مبيعات%' OR jel.account_name ILIKE '%sales%' THEN 'revenue'
        WHEN jel.account_name ILIKE '%تكلفة البضاعة%' OR jel.account_name ILIKE '%COGS%' OR jel.account_name ILIKE '%cost of goods%' THEN 'cogs'
        WHEN jel.account_name ILIKE '%مصروف%' OR jel.account_name ILIKE '%expense%' OR jel.account_name ILIKE '%رواتب%' OR jel.account_name ILIKE '%salary%' OR jel.account_name ILIKE '%إيجار%' OR jel.account_name ILIKE '%rent%' THEN 'expense'
        ELSE 'other'
      END AS cat,
      jel.account_name,
      je.tenant_id,
      s.name AS t_name,
      COALESCE(jel.debit, 0) AS d,
      COALESCE(jel.credit, 0) AS c,
      EXISTS(SELECT 1 FROM intercompany_entries ice WHERE ice.entry_id = je.id) AS is_ic
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    JOIN subsidiary_ids s ON s.id = je.tenant_id
    WHERE je.status = 'posted'
      AND je.deleted_at IS NULL
      AND (_date_from IS NULL OR je.entry_date >= _date_from)
      AND (_date_to IS NULL OR je.entry_date <= _date_to)
  )
  SELECT
    pl_data.cat,
    pl_data.account_name,
    pl_data.tenant_id,
    pl_data.t_name,
    SUM(pl_data.d),
    SUM(pl_data.c),
    SUM(pl_data.c - pl_data.d),
    pl_data.is_ic
  FROM pl_data
  GROUP BY pl_data.cat, pl_data.account_name, pl_data.tenant_id, pl_data.t_name, pl_data.is_ic
  ORDER BY pl_data.cat, pl_data.account_name;
END;
$$;

-- 5. Consolidated report function - Balance Sheet
CREATE OR REPLACE FUNCTION public.get_consolidated_balance_sheet(
  _parent_tenant_id UUID,
  _as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  category TEXT,
  account_name TEXT,
  tenant_id UUID,
  tenant_name TEXT,
  total_debit NUMERIC,
  total_credit NUMERIC,
  balance NUMERIC,
  is_intercompany BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_group_admin(auth.uid(), _parent_tenant_id) THEN
    RAISE EXCEPTION 'Access denied: not a group admin';
  END IF;

  RETURN QUERY
  WITH subsidiary_ids AS (
    SELECT t.id, t.name FROM public.tenants t
    WHERE t.parent_tenant_id = _parent_tenant_id OR t.id = _parent_tenant_id
  ),
  intercompany_accounts AS (
    SELECT DISTINCT jel.account_name AS acct
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    JOIN public.intercompany_links ic ON (
      je.tenant_id = ic.tenant_id OR je.tenant_id = ic.linked_tenant_id
    )
    WHERE ic.parent_tenant_id = _parent_tenant_id AND ic.is_active = true
      AND je.source_type IN ('invoice','expense')
      AND (jel.account_name ILIKE '%ذمم%' OR jel.account_name ILIKE '%receivable%' OR jel.account_name ILIKE '%payable%' OR jel.account_name ILIKE '%دائن%')
  ),
  bs_data AS (
    SELECT
      CASE
        WHEN jel.account_name ILIKE '%أصول%' OR jel.account_name ILIKE '%asset%' OR jel.account_name ILIKE '%نقد%' OR jel.account_name ILIKE '%cash%' OR jel.account_name ILIKE '%بنك%' OR jel.account_name ILIKE '%bank%' OR jel.account_name ILIKE '%مدين%' OR jel.account_name ILIKE '%receivable%' OR jel.account_name ILIKE '%مخزون%' OR jel.account_name ILIKE '%inventory%' THEN 'assets'
        WHEN jel.account_name ILIKE '%التزام%' OR jel.account_name ILIKE '%liabilit%' OR jel.account_name ILIKE '%دائن%' OR jel.account_name ILIKE '%payable%' OR jel.account_name ILIKE '%قرض%' OR jel.account_name ILIKE '%loan%' THEN 'liabilities'
        WHEN jel.account_name ILIKE '%حقوق%' OR jel.account_name ILIKE '%equity%' OR jel.account_name ILIKE '%رأس مال%' OR jel.account_name ILIKE '%capital%' OR jel.account_name ILIKE '%أرباح%' OR jel.account_name ILIKE '%retained%' THEN 'equity'
        ELSE 'other'
      END AS cat,
      jel.account_name,
      je.tenant_id,
      s.name AS t_name,
      COALESCE(jel.debit, 0) AS d,
      COALESCE(jel.credit, 0) AS c,
      EXISTS(SELECT 1 FROM intercompany_accounts ica WHERE ica.acct = jel.account_name) AS is_ic
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    JOIN subsidiary_ids s ON s.id = je.tenant_id
    WHERE je.status = 'posted'
      AND je.deleted_at IS NULL
      AND je.entry_date <= _as_of_date
  )
  SELECT
    bs_data.cat,
    bs_data.account_name,
    bs_data.tenant_id,
    bs_data.t_name,
    SUM(bs_data.d),
    SUM(bs_data.c),
    SUM(bs_data.d - bs_data.c),
    bs_data.is_ic
  FROM bs_data
  GROUP BY bs_data.cat, bs_data.account_name, bs_data.tenant_id, bs_data.t_name, bs_data.is_ic
  ORDER BY bs_data.cat, bs_data.account_name;
END;
$$;

-- 6. Helper: Get subsidiaries for a holding company
CREATE OR REPLACE FUNCTION public.get_group_subsidiaries(_parent_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  name_en TEXT,
  status TEXT,
  cr_number VARCHAR,
  vat_number VARCHAR,
  industry TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_group_admin(auth.uid(), _parent_tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT t.id, t.name, t.name_en, t.status, t.cr_number, t.vat_number, t.industry, t.created_at
  FROM public.tenants t
  WHERE t.parent_tenant_id = _parent_tenant_id
  ORDER BY t.name;
END;
$$;

-- 7. Helper: Group summary stats
CREATE OR REPLACE FUNCTION public.get_group_summary(_parent_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.is_group_admin(auth.uid(), _parent_tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'subsidiary_count', (SELECT COUNT(*) FROM public.tenants WHERE parent_tenant_id = _parent_tenant_id),
    'total_employees', (SELECT COUNT(*) FROM public.tenant_members tm JOIN public.tenants t ON t.id = tm.tenant_id WHERE t.parent_tenant_id = _parent_tenant_id),
    'total_revenue', (
      SELECT COALESCE(SUM(i.grand_total), 0) FROM public.invoices i
      JOIN public.tenants t ON t.id = i.tenant_id
      WHERE (t.parent_tenant_id = _parent_tenant_id OR t.id = _parent_tenant_id)
        AND i.status IN ('sent','paid','partial')
        AND i.deleted_at IS NULL
        AND i.invoice_date >= date_trunc('year', CURRENT_DATE)
    ),
    'total_expenses', (
      SELECT COALESCE(SUM(e.total_amount), 0) FROM public.expenses e
      JOIN public.tenants t ON t.id = e.tenant_id
      WHERE (t.parent_tenant_id = _parent_tenant_id OR t.id = _parent_tenant_id)
        AND e.status IN ('approved','paid')
        AND e.deleted_at IS NULL
        AND e.expense_date >= date_trunc('year', CURRENT_DATE)
    )
  ) INTO result;

  RETURN result;
END;
$$;
