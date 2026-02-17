
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.tenant_wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'hold', 'release')),
  source TEXT NOT NULL CHECK (source IN ('admin', 'payment_gateway', 'system')),
  reason TEXT NOT NULL CHECK (reason IN ('subscription', 'integration', 'refund', 'manual')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reference_type TEXT CHECK (reference_type IN ('invoice', 'subscription', 'integration')),
  reference_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their wallet transactions"
ON public.wallet_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_wallets tw
    WHERE tw.id = wallet_transactions.wallet_id
      AND public.is_tenant_member(tw.tenant_id)
  )
);

CREATE POLICY "Platform admins full access"
ON public.wallet_transactions FOR ALL
USING (public.is_platform_admin());
