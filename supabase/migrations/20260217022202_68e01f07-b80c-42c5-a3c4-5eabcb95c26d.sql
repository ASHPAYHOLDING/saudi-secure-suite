
-- Auto-calculate fees BEFORE insert on paylink_transactions
-- This ensures fees are always correctly computed from the config
CREATE OR REPLACE FUNCTION public.auto_calculate_paylink_fee_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result RECORD;
BEGIN
  -- Only calculate for deposits (not withdrawals)
  IF NEW.transaction_type = 'deposit' THEN
    SELECT * INTO _result
    FROM public.calculate_paylink_fee(NEW.tenant_id, NEW.gross_amount);

    IF FOUND THEN
      NEW.fee_amount := _result.fee_amount;
      NEW.net_amount := _result.net_amount;
      NEW.fee_type := _result.fee_type;
      NEW.fee_rate := _result.fee_percentage;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_calculate_fee_before_insert
  BEFORE INSERT ON public.paylink_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_calculate_paylink_fee_on_insert();
