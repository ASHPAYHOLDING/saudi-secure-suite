
-- Contract templates per tenant
CREATE TABLE public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  contract_type text NOT NULL DEFAULT 'service', -- employment, service, payment
  body_html text NOT NULL DEFAULT '',
  placeholders jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Contracts
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  contract_number text NOT NULL,
  contract_type text NOT NULL DEFAULT 'service',
  title text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft', -- draft, active, signed, expired, cancelled
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  total_value numeric NOT NULL DEFAULT 0,
  currency varchar NOT NULL DEFAULT 'SAR',
  notes text,
  signed_at timestamptz,
  signed_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, contract_number)
);

-- Contract version history
CREATE TABLE public.contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  body_html text NOT NULL,
  changed_by uuid NOT NULL,
  change_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contract_id, version_number)
);

-- Enable RLS
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_versions ENABLE ROW LEVEL SECURITY;

-- contract_templates policies
CREATE POLICY "Members can view templates" ON public.contract_templates
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create templates" ON public.contract_templates
  FOR INSERT WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can update templates" ON public.contract_templates
  FOR UPDATE USING (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can delete templates" ON public.contract_templates
  FOR DELETE USING (is_tenant_admin(tenant_id));

-- contracts policies
CREATE POLICY "Members can view contracts" ON public.contracts
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Authorized can create contracts" ON public.contracts
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "Authorized can update contracts" ON public.contracts
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id()
    AND status != 'signed'
  );

CREATE POLICY "Admins can delete contracts" ON public.contracts
  FOR DELETE USING (is_tenant_admin(tenant_id));

-- contract_versions policies
CREATE POLICY "Members can view versions" ON public.contract_versions
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Members can create versions" ON public.contract_versions
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

-- Triggers for updated_at
CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
