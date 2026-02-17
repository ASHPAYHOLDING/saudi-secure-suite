
-- Table for bank transfer topup requests with receipt upload
CREATE TABLE public.wallet_topup_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  wallet_id UUID NOT NULL REFERENCES public.tenant_wallets(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  bank_reference TEXT,
  receipt_url TEXT,
  receipt_filename TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_topup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their topup requests"
  ON public.wallet_topup_requests FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can create topup requests"
  ON public.wallet_topup_requests FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

-- Storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('wallet-receipts', 'wallet-receipts', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "Tenant members can upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wallet-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant members can view their receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wallet-receipts' AND auth.uid() IS NOT NULL);
