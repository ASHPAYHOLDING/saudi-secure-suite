
CREATE TABLE public.tenant_compliance_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  score integer NOT NULL DEFAULT 0,
  breakdown_json jsonb NOT NULL DEFAULT '{}',
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_tenant_compliance_scores_tenant ON public.tenant_compliance_scores (tenant_id);

ALTER TABLE public.tenant_compliance_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view compliance score"
  ON public.tenant_compliance_scores
  FOR SELECT
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid()
  ));

CREATE POLICY "Tenant admins can upsert compliance score"
  ON public.tenant_compliance_scores
  FOR ALL
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  ))
  WITH CHECK (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  ));
