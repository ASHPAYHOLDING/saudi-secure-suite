
-- 1) Add multi-currency columns to invoice_payments
ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS exchange_rate_used numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_amount numeric NOT NULL DEFAULT 0;

-- Backfill base_amount for existing rows
UPDATE public.invoice_payments SET base_amount = amount WHERE base_amount = 0 AND amount > 0;

-- 2) Create FX gain/loss calculation function
-- When a payment settles at a different rate than the invoice rate, the difference is an FX gain or loss.
CREATE OR REPLACE FUNCTION public.calculate_fx_gain_loss(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_payment_id uuid
)
RETURNS TABLE(fx_amount numeric, fx_type text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv_currency text;
  v_inv_rate numeric;
  v_pay_rate numeric;
  v_pay_amount numeric;
  v_diff numeric;
BEGIN
  -- Get invoice exchange rate
  SELECT COALESCE(i.exchange_rate_at_creation, i.exchange_rate, 1), COALESCE(i.currency_code, i.currency, 'SAR')
  INTO v_inv_rate, v_inv_currency
  FROM invoices i WHERE i.id = p_invoice_id AND i.tenant_id = p_tenant_id;

  IF v_inv_currency = 'SAR' THEN
    -- No FX exposure for base currency
    fx_amount := 0;
    fx_type := 'none';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Get payment exchange rate and amount
  SELECT p.exchange_rate_used, p.amount
  INTO v_pay_rate, v_pay_amount
  FROM invoice_payments p WHERE p.id = p_payment_id AND p.tenant_id = p_tenant_id;

  -- FX difference = payment_amount * (payment_rate - invoice_rate)
  v_diff := ROUND(v_pay_amount * (v_pay_rate - v_inv_rate), 2);

  IF v_diff > 0 THEN
    fx_amount := v_diff;
    fx_type := 'gain';
  ELSIF v_diff < 0 THEN
    fx_amount := ABS(v_diff);
    fx_type := 'loss';
  ELSE
    fx_amount := 0;
    fx_type := 'none';
  END IF;

  RETURN NEXT;
  RETURN;
END;
$$;

-- 3) Trigger to auto-generate FX gain/loss journal entry on payment insert
CREATE OR REPLACE FUNCTION public.trg_fx_gain_loss_journal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fx record;
  v_entry_id uuid;
  v_entry_number text;
  v_seq int;
  v_inv_branch uuid;
  v_fx_gain_account uuid;
  v_fx_loss_account uuid;
  v_ar_account uuid;
BEGIN
  -- Only process foreign currency payments
  IF NEW.currency_code = 'SAR' OR NEW.exchange_rate_used = 1 THEN
    RETURN NEW;
  END IF;

  -- Calculate FX gain/loss
  SELECT * INTO v_fx FROM calculate_fx_gain_loss(NEW.tenant_id, NEW.invoice_id, NEW.id);

  IF v_fx.fx_type = 'none' OR v_fx.fx_amount = 0 THEN
    RETURN NEW;
  END IF;

  -- Get invoice branch
  SELECT branch_id INTO v_inv_branch FROM invoices WHERE id = NEW.invoice_id;

  -- Generate entry number
  SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM '[0-9]+$') AS int)), 0) + 1
  INTO v_seq
  FROM journal_entries WHERE tenant_id = NEW.tenant_id;

  v_entry_number := 'FX-' || LPAD(v_seq::text, 6, '0');

  -- Create journal entry
  INSERT INTO journal_entries (
    tenant_id, branch_id, entry_number, entry_date, source_type, source_id,
    description, status, total_debit, total_credit,
    base_total_debit, base_total_credit,
    currency, exchange_rate, created_by
  ) VALUES (
    NEW.tenant_id, v_inv_branch, v_entry_number, CURRENT_DATE,
    'fx_adjustment', NEW.id,
    CASE v_fx.fx_type
      WHEN 'gain' THEN 'أرباح فروقات عملة - دفعة ' || NEW.reference_number
      ELSE 'خسائر فروقات عملة - دفعة ' || NEW.reference_number
    END,
    'posted', v_fx.fx_amount, v_fx.fx_amount,
    v_fx.fx_amount, v_fx.fx_amount,
    NEW.currency_code, NEW.exchange_rate_used, NEW.created_by
  ) RETURNING id INTO v_entry_id;

  -- Note: journal_entry_lines should be created by a separate process or trigger
  -- that maps to the correct FX gain/loss and AR accounts from the chart of accounts.
  -- This trigger creates the header; line creation depends on tenant's COA configuration.

  RETURN NEW;
END;
$$;

-- Attach trigger (drop first if exists to be idempotent)
DROP TRIGGER IF EXISTS trg_payment_fx_gain_loss ON public.invoice_payments;
CREATE TRIGGER trg_payment_fx_gain_loss
  AFTER INSERT ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fx_gain_loss_journal();

-- 4) Index for efficient rate lookups
CREATE INDEX IF NOT EXISTS idx_currency_rates_lookup
  ON public.currency_rates (tenant_id, from_currency, to_currency, effective_date DESC);
