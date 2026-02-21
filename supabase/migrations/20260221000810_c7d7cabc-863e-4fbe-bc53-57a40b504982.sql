
-- ============================================================
-- Cost Centers
-- ============================================================
CREATE TABLE public.cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  code TEXT,
  parent_id UUID REFERENCES public.cost_centers(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_centers_tenant ON public.cost_centers(tenant_id);
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view cost centers"
  ON public.cost_centers FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage cost centers"
  ON public.cost_centers FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- ============================================================
-- Profit Centers
-- ============================================================
CREATE TABLE public.profit_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  code TEXT,
  parent_id UUID REFERENCES public.profit_centers(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profit_centers_tenant ON public.profit_centers(tenant_id);
ALTER TABLE public.profit_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view profit centers"
  ON public.profit_centers FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage profit centers"
  ON public.profit_centers FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- ============================================================
-- Add FK columns to invoices, expenses, journal_entries
-- ============================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id),
  ADD COLUMN IF NOT EXISTS profit_center_id UUID REFERENCES public.profit_centers(id);

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id),
  ADD COLUMN IF NOT EXISTS profit_center_id UUID REFERENCES public.profit_centers(id);

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id),
  ADD COLUMN IF NOT EXISTS profit_center_id UUID REFERENCES public.profit_centers(id);

-- Indexes for reporting
CREATE INDEX idx_invoices_cost_center ON public.invoices(cost_center_id) WHERE cost_center_id IS NOT NULL;
CREATE INDEX idx_invoices_profit_center ON public.invoices(profit_center_id) WHERE profit_center_id IS NOT NULL;
CREATE INDEX idx_expenses_cost_center ON public.expenses(cost_center_id) WHERE cost_center_id IS NOT NULL;
CREATE INDEX idx_expenses_profit_center ON public.expenses(profit_center_id) WHERE profit_center_id IS NOT NULL;
CREATE INDEX idx_journal_entries_cost_center ON public.journal_entries(cost_center_id) WHERE cost_center_id IS NOT NULL;
CREATE INDEX idx_journal_entries_profit_center ON public.journal_entries(profit_center_id) WHERE profit_center_id IS NOT NULL;

-- Timestamp triggers
CREATE TRIGGER update_cost_centers_updated_at
  BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profit_centers_updated_at
  BEFORE UPDATE ON public.profit_centers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
