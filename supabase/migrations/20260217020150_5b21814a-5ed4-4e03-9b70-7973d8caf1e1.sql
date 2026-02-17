
-- Payout settings per tenant (bank account + schedule)
CREATE TABLE public.paylink_payout_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL DEFAULT '',
  iban TEXT NOT NULL DEFAULT '',
  account_holder_name TEXT NOT NULL DEFAULT '',
  payout_schedule TEXT NOT NULL DEFAULT 'manual', -- manual, daily, weekly, monthly
  payout_day INTEGER, -- day of week (1-7) or day of month (1-28)
  min_payout_amount NUMERIC NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Payout records
CREATE TABLE public.paylink_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payout_number TEXT NOT NULL,
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  bank_name TEXT,
  iban TEXT,
  account_holder_name TEXT,
  scheduled_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.paylink_payout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paylink_payouts ENABLE ROW LEVEL SECURITY;

-- RLS for payout_settings
CREATE POLICY "Tenant members can view payout settings"
  ON public.paylink_payout_settings FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can manage payout settings"
  ON public.paylink_payout_settings FOR ALL
  TO authenticated
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));

-- RLS for payouts
CREATE POLICY "Tenant members can view payouts"
  ON public.paylink_payouts FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can insert payouts"
  ON public.paylink_payouts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_admin(tenant_id));

-- Platform admins full access
CREATE POLICY "Platform admins manage payout settings"
  ON public.paylink_payout_settings FOR ALL
  TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins manage payouts"
  ON public.paylink_payouts FOR ALL
  TO authenticated
  USING (public.is_platform_admin());

-- Updated_at triggers
CREATE TRIGGER update_paylink_payout_settings_updated_at
  BEFORE UPDATE ON public.paylink_payout_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_paylink_payouts_updated_at
  BEFORE UPDATE ON public.paylink_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for payouts
ALTER PUBLICATION supabase_realtime ADD TABLE public.paylink_payouts;
