
-- ══════════════════════════════════════════════════════
-- Analytics Daily Aggregates — Mini-ETL target tables
-- ══════════════════════════════════════════════════════

-- 1) Daily Revenue (from posted journal entries — credit side of revenue accounts)
CREATE TABLE public.analytics_daily_revenue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  invoice_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, report_date, legal_entity_id, branch_id)
);

-- 2) Daily Expenses
CREATE TABLE public.analytics_daily_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  expense_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, report_date, legal_entity_id, branch_id)
);

-- 3) Daily Cashflow (net payments received minus payments made)
CREATE TABLE public.analytics_daily_cashflow (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  inflow numeric NOT NULL DEFAULT 0,
  outflow numeric NOT NULL DEFAULT 0,
  net_flow numeric NOT NULL DEFAULT 0,
  payment_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, report_date, legal_entity_id, branch_id)
);

-- ── RLS ──
ALTER TABLE public.analytics_daily_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily_cashflow ENABLE ROW LEVEL SECURITY;

-- Read access for tenant members
CREATE POLICY "Tenant members can read revenue analytics"
  ON public.analytics_daily_revenue FOR SELECT
  USING (tenant_id IN (
    SELECT t.id FROM public.tenants t
    INNER JOIN public.profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "Tenant members can read expense analytics"
  ON public.analytics_daily_expenses FOR SELECT
  USING (tenant_id IN (
    SELECT t.id FROM public.tenants t
    INNER JOIN public.profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "Tenant members can read cashflow analytics"
  ON public.analytics_daily_cashflow FOR SELECT
  USING (tenant_id IN (
    SELECT t.id FROM public.tenants t
    INNER JOIN public.profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid()
  ));

-- Write restricted to service_role (ETL worker)
CREATE POLICY "Service role can manage revenue analytics"
  ON public.analytics_daily_revenue FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage expense analytics"
  ON public.analytics_daily_expenses FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage cashflow analytics"
  ON public.analytics_daily_cashflow FOR ALL
  USING (true) WITH CHECK (true);

-- ── Performance indexes ──
CREATE INDEX idx_analytics_revenue_tenant_date ON public.analytics_daily_revenue(tenant_id, report_date DESC);
CREATE INDEX idx_analytics_expenses_tenant_date ON public.analytics_daily_expenses(tenant_id, report_date DESC);
CREATE INDEX idx_analytics_cashflow_tenant_date ON public.analytics_daily_cashflow(tenant_id, report_date DESC);

-- ── Updated-at trigger ──
CREATE TRIGGER update_analytics_daily_revenue_updated_at
  BEFORE UPDATE ON public.analytics_daily_revenue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_analytics_daily_expenses_updated_at
  BEFORE UPDATE ON public.analytics_daily_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_analytics_daily_cashflow_updated_at
  BEFORE UPDATE ON public.analytics_daily_cashflow
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
