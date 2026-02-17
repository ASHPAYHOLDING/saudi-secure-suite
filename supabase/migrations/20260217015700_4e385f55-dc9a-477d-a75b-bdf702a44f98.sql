
-- Fee configuration per tenant
CREATE TABLE public.paylink_fee_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL DEFAULT 'percentage' CHECK (fee_type IN ('percentage', 'fixed', 'combined')),
  fee_percentage NUMERIC NOT NULL DEFAULT 2.9,
  fee_fixed_amount NUMERIC NOT NULL DEFAULT 0,
  min_fee NUMERIC NOT NULL DEFAULT 0,
  max_fee NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Payment transactions with fee tracking
CREATE TABLE public.paylink_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transaction_number TEXT NOT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'deposit' CHECK (transaction_type IN ('deposit', 'withdrawal')),
  description TEXT,
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  fee_type TEXT,
  fee_rate NUMERIC,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  invoice_id UUID REFERENCES public.invoices(id),
  gateway_reference TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Separate fee ledger for auditing
CREATE TABLE public.paylink_fee_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.paylink_transactions(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL,
  fee_percentage NUMERIC,
  fee_fixed NUMERIC,
  gross_amount NUMERIC NOT NULL,
  fee_amount NUMERIC NOT NULL,
  net_amount NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.paylink_fee_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paylink_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paylink_fee_logs ENABLE ROW LEVEL SECURITY;

-- RLS: fee_configs
CREATE POLICY "Tenant members can view fee configs"
  ON public.paylink_fee_configs FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can manage fee configs"
  ON public.paylink_fee_configs FOR ALL
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));

-- RLS: transactions
CREATE POLICY "Tenant members can view transactions"
  ON public.paylink_transactions FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can insert transactions"
  ON public.paylink_transactions FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can update transactions"
  ON public.paylink_transactions FOR UPDATE
  USING (public.is_tenant_admin(tenant_id));

-- RLS: fee_logs
CREATE POLICY "Tenant members can view fee logs"
  ON public.paylink_fee_logs FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "System can insert fee logs"
  ON public.paylink_fee_logs FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

-- Platform admins full access
CREATE POLICY "Platform admins manage fee configs"
  ON public.paylink_fee_configs FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Platform admins view transactions"
  ON public.paylink_transactions FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins view fee logs"
  ON public.paylink_fee_logs FOR SELECT
  USING (public.is_platform_admin());

-- Auto-calculate fee function
CREATE OR REPLACE FUNCTION public.calculate_paylink_fee(
  _tenant_id UUID,
  _gross_amount NUMERIC
)
RETURNS TABLE(fee_amount NUMERIC, net_amount NUMERIC, fee_type TEXT, fee_percentage NUMERIC, fee_fixed NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _config RECORD;
  _fee NUMERIC := 0;
BEGIN
  SELECT * INTO _config FROM public.paylink_fee_configs
  WHERE tenant_id = _tenant_id AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    -- Default 2.9%
    _fee := ROUND(_gross_amount * 0.029, 2);
    RETURN QUERY SELECT _fee, _gross_amount - _fee, 'percentage'::TEXT, 2.9::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  IF _config.fee_type = 'percentage' THEN
    _fee := ROUND(_gross_amount * (_config.fee_percentage / 100), 2);
  ELSIF _config.fee_type = 'fixed' THEN
    _fee := _config.fee_fixed_amount;
  ELSIF _config.fee_type = 'combined' THEN
    _fee := ROUND(_gross_amount * (_config.fee_percentage / 100), 2) + _config.fee_fixed_amount;
  END IF;

  -- Apply min/max
  IF _fee < _config.min_fee THEN _fee := _config.min_fee; END IF;
  IF _config.max_fee IS NOT NULL AND _fee > _config.max_fee THEN _fee := _config.max_fee; END IF;

  RETURN QUERY SELECT _fee, _gross_amount - _fee, _config.fee_type, _config.fee_percentage, _config.fee_fixed_amount;
END;
$$;

-- Trigger to auto-log fees on transaction insert
CREATE OR REPLACE FUNCTION public.auto_log_paylink_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.transaction_type = 'deposit' AND NEW.fee_amount > 0 THEN
    INSERT INTO public.paylink_fee_logs (tenant_id, transaction_id, fee_type, fee_percentage, fee_fixed, gross_amount, fee_amount, net_amount, description)
    VALUES (NEW.tenant_id, NEW.id, COALESCE(NEW.fee_type, 'percentage'), NEW.fee_rate, 0, NEW.gross_amount, NEW.fee_amount, NEW.net_amount, 'رسوم عملية ' || NEW.transaction_number);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_log_paylink_fee
  AFTER INSERT ON public.paylink_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_log_paylink_fee();

-- Updated_at triggers
CREATE TRIGGER update_paylink_fee_configs_updated_at
  BEFORE UPDATE ON public.paylink_fee_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_paylink_transactions_updated_at
  BEFORE UPDATE ON public.paylink_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
