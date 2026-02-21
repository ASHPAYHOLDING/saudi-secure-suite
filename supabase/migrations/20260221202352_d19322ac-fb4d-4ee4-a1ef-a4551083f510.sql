
-- Cashflow Projection table
CREATE TABLE public.tenant_cashflow_projection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  projection_date date NOT NULL,
  projected_inflow numeric NOT NULL DEFAULT 0,
  projected_outflow numeric NOT NULL DEFAULT 0,
  projected_balance numeric NOT NULL DEFAULT 0,
  actual_inflow numeric DEFAULT 0,
  actual_outflow numeric DEFAULT 0,
  actual_balance numeric DEFAULT 0,
  risk_weighted_inflow numeric DEFAULT 0,
  liquidity_alert_level text CHECK (liquidity_alert_level IN ('low','medium','critical')),
  breakdown_json jsonb NOT NULL DEFAULT '{}',
  scenario_adjustments jsonb,
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, projection_date)
);

ALTER TABLE public.tenant_cashflow_projection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view projections"
  ON public.tenant_cashflow_projection FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage projections"
  ON public.tenant_cashflow_projection FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

CREATE INDEX idx_cashflow_proj_tenant_date ON public.tenant_cashflow_projection(tenant_id, projection_date);
