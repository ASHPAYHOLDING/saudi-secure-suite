
CREATE TABLE public.tenant_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'SAR',
  balance_available NUMERIC NOT NULL DEFAULT 0,
  balance_pending NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, currency)
);

ALTER TABLE public.tenant_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their wallet"
ON public.tenant_wallets FOR SELECT
USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Platform admins can view all wallets"
ON public.tenant_wallets FOR SELECT
USING (public.is_platform_admin());

CREATE POLICY "Platform admins can manage wallets"
ON public.tenant_wallets FOR ALL
USING (public.is_platform_admin());

CREATE POLICY "Tenant owners can update wallet"
ON public.tenant_wallets FOR UPDATE
USING (public.is_tenant_owner(tenant_id));
