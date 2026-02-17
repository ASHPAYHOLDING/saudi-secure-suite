
CREATE OR REPLACE FUNCTION public.process_wallet_transaction(
  p_wallet_id uuid,
  p_type text,
  p_amount numeric,
  p_source text,
  p_reason text,
  p_reference_type text,
  p_reference_id uuid,
  p_actor_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet RECORD;
  v_new_balance numeric;
  v_new_pending numeric;
  v_tx_id uuid;
BEGIN
  PERFORM set_config('app.wallet_bypass', 'true', true);

  IF p_type NOT IN ('credit', 'debit', 'hold', 'release') THEN
    RAISE EXCEPTION 'نوع العملية غير صالح: %. الأنواع المسموحة: credit, debit, hold, release', p_type;
  END IF;

  IF p_source NOT IN ('admin', 'system', 'gateway', 'payment_gateway') THEN
    RAISE EXCEPTION 'مصدر العملية غير صالح: %. المصادر المسموحة: admin, system, gateway, payment_gateway', p_source;
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'المبلغ يجب أن يكون أكبر من صفر';
  END IF;

  IF p_reference_type IS NULL OR p_reference_type = '' THEN
    RAISE EXCEPTION 'reference_type مطلوب — كل عملية يجب أن تكون مربوطة بمرجع';
  END IF;

  IF p_reference_id IS NULL THEN
    RAISE EXCEPTION 'reference_id مطلوب — كل عملية يجب أن تكون مربوطة بمرجع';
  END IF;

  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'actor_id مطلوب — كل عملية يجب أن تكون مربوطة بمنفذ';
  END IF;

  SELECT id, tenant_id, balance_available, balance_pending, status, currency
  INTO v_wallet
  FROM public.tenant_wallets
  WHERE id = p_wallet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المحفظة غير موجودة: %', p_wallet_id;
  END IF;

  IF v_wallet.status = 'frozen' THEN
    RAISE EXCEPTION 'المحفظة مجمّدة — لا يمكن إجراء عمليات';
  END IF;

  v_new_balance := v_wallet.balance_available;
  v_new_pending := v_wallet.balance_pending;

  IF p_type = 'credit' THEN
    v_new_balance := v_wallet.balance_available + p_amount;
  ELSIF p_type = 'debit' THEN
    IF v_wallet.balance_available < p_amount THEN
      RAISE EXCEPTION 'الرصيد غير كافٍ. المتاح: %, المطلوب: %', v_wallet.balance_available, p_amount;
    END IF;
    v_new_balance := v_wallet.balance_available - p_amount;
  ELSIF p_type = 'hold' THEN
    IF v_wallet.balance_available < p_amount THEN
      RAISE EXCEPTION 'الرصيد غير كافٍ للحجز. المتاح: %, المطلوب: %', v_wallet.balance_available, p_amount;
    END IF;
    v_new_balance := v_wallet.balance_available - p_amount;
    v_new_pending := v_wallet.balance_pending + p_amount;
  ELSIF p_type = 'release' THEN
    IF v_wallet.balance_pending < p_amount THEN
      RAISE EXCEPTION 'الرصيد المحجوز غير كافٍ. المحجوز: %, المطلوب: %', v_wallet.balance_pending, p_amount;
    END IF;
    v_new_pending := v_wallet.balance_pending - p_amount;
    v_new_balance := v_wallet.balance_available + p_amount;
  END IF;

  INSERT INTO public.wallet_transactions (
    wallet_id, type, amount, balance_before, balance_after,
    source, reason, reference_type, reference_id, created_by
  ) VALUES (
    p_wallet_id, p_type, p_amount, v_wallet.balance_available, v_new_balance,
    p_source, p_reason, p_reference_type, p_reference_id, p_actor_id
  ) RETURNING id INTO v_tx_id;

  UPDATE public.tenant_wallets
  SET balance_available = v_new_balance,
      balance_pending = v_new_pending,
      updated_at = now()
  WHERE id = p_wallet_id;

  PERFORM set_config('app.wallet_bypass', 'false', true);

  RETURN v_tx_id;
END;
$function$;

-- Also update the source check constraint to match
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_source_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_source_check 
  CHECK (source = ANY (ARRAY['admin'::text, 'system'::text, 'gateway'::text, 'payment_gateway'::text]));
