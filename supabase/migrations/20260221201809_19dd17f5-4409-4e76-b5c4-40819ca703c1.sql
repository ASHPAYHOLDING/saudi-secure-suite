
-- Customer Risk Scores
CREATE TABLE public.tenant_customer_risk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  risk_score integer NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  avg_payment_delay_days numeric DEFAULT 0,
  overdue_ratio numeric DEFAULT 0,
  dispute_frequency integer DEFAULT 0,
  invoice_size_volatility numeric DEFAULT 0,
  recommended_action text,
  breakdown_json jsonb NOT NULL DEFAULT '{}',
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, customer_id)
);

ALTER TABLE public.tenant_customer_risk ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view risk scores"
  ON public.tenant_customer_risk FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage risk scores"
  ON public.tenant_customer_risk FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- Reminder Policies
CREATE TABLE public.reminder_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  name_en text,
  days_overdue integer NOT NULL,
  tone text NOT NULL DEFAULT 'friendly' CHECK (tone IN ('friendly','formal','legal')),
  template_ar text NOT NULL,
  template_en text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reminder_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view reminder policies"
  ON public.reminder_policies FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage reminder policies"
  ON public.reminder_policies FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- Reminder Logs
CREATE TABLE public.reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  invoice_id uuid REFERENCES public.invoices(id),
  policy_id uuid REFERENCES public.reminder_policies(id),
  tone text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','failed'))
);

ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view reminder logs"
  ON public.reminder_logs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can insert reminder logs"
  ON public.reminder_logs FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX idx_customer_risk_tenant ON public.tenant_customer_risk(tenant_id);
CREATE INDEX idx_customer_risk_level ON public.tenant_customer_risk(tenant_id, risk_level);
CREATE INDEX idx_reminder_policies_tenant ON public.reminder_policies(tenant_id);
CREATE INDEX idx_reminder_logs_tenant ON public.reminder_logs(tenant_id);
CREATE INDEX idx_reminder_logs_customer ON public.reminder_logs(customer_id);
