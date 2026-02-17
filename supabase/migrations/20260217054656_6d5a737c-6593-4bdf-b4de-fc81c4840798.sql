
-- 1. Create the atomic process_wallet_transaction function
CREATE OR REPLACE FUNCTION public.process_wallet_transaction(
  p_wallet_id uuid,
  p_type text,
  p_amount numeric,
  p_reason text,
  p_reference_type text,
  p_reference_id uuid,
  p_actor_id uuid,
  p_source text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet RECORD;
  v_new_balance numeric;
  v_new_pending numeric;
  v_tx_id uuid;
BEGIN
  -- Validate inputs
  IF p_type NOT IN ('credit', 'debit', 'hold', 'release') THEN
    RAISE EXCEPTION 'نوع العملية غير صالح: %. الأنواع المسموحة: credit, debit, hold, release', p_type;
  END IF;

  IF p_source NOT IN ('admin', 'system', 'gateway') THEN
    RAISE EXCEPTION 'مصدر العملية غير صالح: %. المصادر المسموحة: admin, system, gateway', p_source;
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

  -- Lock the wallet row to prevent race conditions
  SELECT id, tenant_id, balance_available, balance_pending, status, currency
  INTO v_wallet
  FROM public.tenant_wallets
  WHERE id = p_wallet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المحفظة غير موجودة: %', p_wallet_id;
  END IF;

  -- Block all operations on frozen wallets
  IF v_wallet.status = 'frozen' THEN
    RAISE EXCEPTION 'المحفظة مجمّدة — لا يمكن تنفيذ أي عملية. يرجى التواصل مع الإدارة.';
  END IF;

  -- Calculate new balances based on type
  v_new_balance := v_wallet.balance_available;
  v_new_pending := v_wallet.balance_pending;

  CASE p_type
    WHEN 'credit' THEN
      v_new_balance := v_wallet.balance_available + p_amount;

    WHEN 'debit' THEN
      IF v_wallet.balance_available < p_amount THEN
        RAISE EXCEPTION 'الرصيد غير كافٍ. المطلوب: % — المتاح: %', p_amount, v_wallet.balance_available;
      END IF;
      v_new_balance := v_wallet.balance_available - p_amount;

    WHEN 'hold' THEN
      IF v_wallet.balance_available < p_amount THEN
        RAISE EXCEPTION 'الرصيد غير كافٍ للحجز. المطلوب: % — المتاح: %', p_amount, v_wallet.balance_available;
      END IF;
      v_new_balance := v_wallet.balance_available - p_amount;
      v_new_pending := v_wallet.balance_pending + p_amount;

    WHEN 'release' THEN
      IF v_wallet.balance_pending < p_amount THEN
        RAISE EXCEPTION 'الرصيد المحجوز غير كافٍ للتحرير. المطلوب: % — المحجوز: %', p_amount, v_wallet.balance_pending;
      END IF;
      v_new_balance := v_wallet.balance_available + p_amount;
      v_new_pending := v_wallet.balance_pending - p_amount;
  END CASE;

  -- Create the transaction record FIRST (audit trail)
  INSERT INTO public.wallet_transactions (
    wallet_id, type, source, reason, amount,
    reference_type, reference_id, created_by
  ) VALUES (
    p_wallet_id, p_type, p_source, p_reason, p_amount,
    p_reference_type, p_reference_id, p_actor_id
  )
  RETURNING id INTO v_tx_id;

  -- Update wallet balance atomically
  UPDATE public.tenant_wallets
  SET balance_available = v_new_balance,
      balance_pending = v_new_pending
  WHERE id = p_wallet_id;

  -- Log to audit_logs for full traceability
  INSERT INTO public.audit_logs (
    tenant_id, user_id, action, entity_type, entity_id, entity_label, changes
  ) VALUES (
    v_wallet.tenant_id,
    p_actor_id,
    'wallet_' || p_type,
    'wallet_transaction',
    v_tx_id,
    p_type || ' — ' || p_amount || ' ' || v_wallet.currency,
    jsonb_build_object(
      'type', p_type,
      'amount', p_amount,
      'source', p_source,
      'reason', p_reason,
      'reference_type', p_reference_type,
      'reference_id', p_reference_id,
      'old_balance', v_wallet.balance_available,
      'new_balance', v_new_balance,
      'old_pending', v_wallet.balance_pending,
      'new_pending', v_new_pending
    )
  );

  RETURN v_tx_id;
END;
$$;

-- 2. Remove dangerous "Tenant owners can update wallet" policy
DROP POLICY IF EXISTS "Tenant owners can update wallet" ON public.tenant_wallets;

-- 3. Remove dangerous "Platform admins can manage wallets" ALL policy (replace with granular)
DROP POLICY IF EXISTS "Platform admins can manage wallets" ON public.tenant_wallets;

-- 4. Platform admins can UPDATE wallet status only (freeze/unfreeze) — balance changes go through function
CREATE POLICY "Platform admins can update wallet status"
ON public.tenant_wallets
FOR UPDATE
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- 5. Platform admins can INSERT wallets (for manual wallet creation)
CREATE POLICY "Platform admins can insert wallets"
ON public.tenant_wallets
FOR INSERT
WITH CHECK (public.is_platform_admin());

-- 6. Make reference_type and reference_id NOT NULL on wallet_transactions
ALTER TABLE public.wallet_transactions
  ALTER COLUMN reference_type SET NOT NULL,
  ALTER COLUMN reference_id SET NOT NULL;

-- 7. Add tenant_id to wallet_receipts for direct isolation
ALTER TABLE public.wallet_receipts
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Update existing receipts tenant_id from join
UPDATE public.wallet_receipts wr
SET tenant_id = tw.tenant_id
FROM public.wallet_transactions wt
JOIN public.tenant_wallets tw ON tw.id = wt.wallet_id
WHERE wr.wallet_transaction_id = wt.id
  AND wr.tenant_id IS NULL;

-- Now make it NOT NULL
ALTER TABLE public.wallet_receipts
  ALTER COLUMN tenant_id SET NOT NULL;

-- 8. Replace wallet_receipts RLS policies with tenant_id based
DROP POLICY IF EXISTS "Tenant members can view their receipts" ON public.wallet_receipts;
CREATE POLICY "Tenant members can view their receipts"
ON public.wallet_receipts
FOR SELECT
USING (public.is_tenant_member(tenant_id));

-- 9. Auto-create wallet trigger on new tenant
CREATE OR REPLACE FUNCTION public.auto_create_tenant_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.tenant_wallets (tenant_id, currency, balance_available, balance_pending, status)
  VALUES (NEW.id, 'SAR', 0, 0, 'active')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_wallet ON public.tenants;
CREATE TRIGGER trg_auto_create_wallet
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_tenant_wallet();

-- 10. Create wallets for existing tenants that don't have one
INSERT INTO public.tenant_wallets (tenant_id, currency, balance_available, balance_pending, status)
SELECT t.id, 'SAR', 0, 0, 'active'
FROM public.tenants t
LEFT JOIN public.tenant_wallets tw ON tw.tenant_id = t.id
WHERE tw.id IS NULL;

-- 11. Enable realtime for wallet tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
