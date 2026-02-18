
-- Table for pending subscription upgrade requests via bank transfer
CREATE TABLE public.subscription_upgrade_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  requested_by UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  amount NUMERIC NOT NULL DEFAULT 0,
  discount_code TEXT,
  discount_id UUID,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  bank_reference TEXT,
  receipt_url TEXT,
  receipt_filename TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view own requests"
  ON public.subscription_upgrade_requests FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant owners/admins can create requests"
  ON public.subscription_upgrade_requests FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "Platform admins can view all"
  ON public.subscription_upgrade_requests FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can update"
  ON public.subscription_upgrade_requests FOR UPDATE
  USING (public.is_platform_admin());

CREATE TRIGGER update_sub_upgrade_requests_updated_at
  BEFORE UPDATE ON public.subscription_upgrade_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
