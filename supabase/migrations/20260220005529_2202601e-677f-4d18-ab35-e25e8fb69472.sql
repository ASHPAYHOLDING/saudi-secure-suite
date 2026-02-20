
-- Create tenant_payment_providers table for BYO-Gateway model
CREATE TABLE public.tenant_payment_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  credentials_encrypted text NOT NULL DEFAULT '',
  webhook_secret_encrypted text NULL,
  last_tested_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_payment_providers_provider_check CHECK (provider IN ('tap','moyasar','hyperpay')),
  CONSTRAINT tenant_payment_providers_status_check CHECK (status IN ('disconnected','connected','tested','active','disabled')),
  UNIQUE (tenant_id, provider)
);

-- Enable RLS
ALTER TABLE public.tenant_payment_providers ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can only read their own tenant's providers
CREATE POLICY "tenant_payment_providers_select" ON public.tenant_payment_providers
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

-- RLS: authenticated users can insert for their tenant only
CREATE POLICY "tenant_payment_providers_insert" ON public.tenant_payment_providers
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

-- RLS: authenticated users can update their tenant's providers
CREATE POLICY "tenant_payment_providers_update" ON public.tenant_payment_providers
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

-- RLS: admin/owner can delete
CREATE POLICY "tenant_payment_providers_delete" ON public.tenant_payment_providers
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_tenant_payment_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tenant_payment_providers_updated_at
  BEFORE UPDATE ON public.tenant_payment_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tenant_payment_providers_updated_at();

-- Create payment_intents table for tracking payment sessions
CREATE TABLE public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL,
  provider_session_id text NOT NULL,
  invoice_id uuid NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_intents_status_check CHECK (status IN ('pending','paid','failed','cancelled'))
);

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_intents_select" ON public.payment_intents
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.update_payment_intents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_payment_intents_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payment_intents_updated_at();
