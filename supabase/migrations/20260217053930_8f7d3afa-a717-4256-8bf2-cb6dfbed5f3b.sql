
CREATE TABLE public.wallet_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_transaction_id UUID NOT NULL REFERENCES public.wallet_transactions(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  pdf_url TEXT,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their receipts"
ON public.wallet_receipts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.wallet_transactions wt
    JOIN public.tenant_wallets tw ON tw.id = wt.wallet_id
    WHERE wt.id = wallet_receipts.wallet_transaction_id
      AND public.is_tenant_member(tw.tenant_id)
  )
);

CREATE POLICY "Platform admins full access"
ON public.wallet_receipts FOR ALL
USING (public.is_platform_admin());
