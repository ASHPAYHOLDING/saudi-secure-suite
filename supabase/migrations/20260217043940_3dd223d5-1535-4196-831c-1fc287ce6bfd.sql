-- Table for tracking paid gateway payment sessions and transactions
CREATE TABLE public.paid_gateway_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.paid_integrations(id),
  gateway_key TEXT NOT NULL, -- pay_tap, pay_hyperpay, pay_moyasar
  session_id TEXT, -- external session/charge ID
  payment_url TEXT, -- redirect URL for customer
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed, expired
  gateway_response JSONB,
  paid_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.paid_gateway_transactions ENABLE ROW LEVEL SECURITY;

-- Tenant members can view their transactions
CREATE POLICY "Tenant members can view gateway transactions"
ON public.paid_gateway_transactions FOR SELECT
USING (public.is_tenant_member(tenant_id));

-- Tenant admins can insert
CREATE POLICY "Tenant admins can create gateway transactions"
ON public.paid_gateway_transactions FOR INSERT
WITH CHECK (public.is_tenant_admin(tenant_id));

-- System can update (via edge function)
CREATE POLICY "Tenant members can update gateway transactions"
ON public.paid_gateway_transactions FOR UPDATE
USING (public.is_tenant_member(tenant_id));

-- Trigger for updated_at
CREATE TRIGGER update_paid_gateway_transactions_updated_at
BEFORE UPDATE ON public.paid_gateway_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_paid_gateway_tx_invoice ON public.paid_gateway_transactions(invoice_id);
CREATE INDEX idx_paid_gateway_tx_session ON public.paid_gateway_transactions(session_id);
CREATE INDEX idx_paid_gateway_tx_tenant ON public.paid_gateway_transactions(tenant_id);