
CREATE TABLE public.tenant_financial_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  score integer NOT NULL DEFAULT 0,
  breakdown_json jsonb NOT NULL DEFAULT '{}',
  executive_summary text,
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_tenant_financial_health_tenant ON public.tenant_financial_health (tenant_id);

ALTER TABLE public.tenant_financial_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view financial health"
  ON public.tenant_financial_health
  FOR SELECT
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid()
  ));

CREATE POLICY "Tenant admins can upsert financial health"
  ON public.tenant_financial_health
  FOR ALL
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  ))
  WITH CHECK (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  ));
