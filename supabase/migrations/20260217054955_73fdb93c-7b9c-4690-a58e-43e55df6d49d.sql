
-- 1. Trigger: Block any direct INSERT on wallet_transactions (must go through process_wallet_transaction)
CREATE OR REPLACE FUNCTION public.guard_wallet_transaction_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- process_wallet_transaction sets this config before calling
  IF current_setting('app.wallet_bypass', true) = 'true' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'لا يمكن إدراج عمليات محفظة مباشرة — استخدم process_wallet_transaction()';
END;
$$;

-- 2. Trigger: Block any direct UPDATE on tenant_wallets balance columns
CREATE OR REPLACE FUNCTION public.guard_wallet_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('app.wallet_bypass', true) = 'true' THEN
    -- Audit the change
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      NEW.tenant_id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'wallet_balance_update',
      'wallet',
      NEW.id,
      'balance update',
      jsonb_build_object(
        'old_balance_available', OLD.balance_available,
        'new_balance_available', NEW.balance_available,
        'old_balance_pending', OLD.balance_pending,
        'new_balance_pending', NEW.balance_pending,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
    RETURN NEW;
  END IF;

  -- Allow status-only changes from admin_set_wallet_status (no balance change)
  IF current_setting('app.wallet_status_bypass', true) = 'true' THEN
    IF NEW.balance_available IS DISTINCT FROM OLD.balance_available
       OR NEW.balance_pending IS DISTINCT FROM OLD.balance_pending THEN
      RAISE EXCEPTION 'admin_set_wallet_status لا يسمح بتغيير الرصيد';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'لا يمكن تعديل المحفظة مباشرة — استخدم process_wallet_transaction()';
END;
$$;

-- 3. Audit trigger for wallet_transactions INSERT (logging after allowed insert)
CREATE OR REPLACE FUNCTION public.audit_wallet_transaction_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_wallets WHERE id = NEW.wallet_id;

  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (
    v_tenant_id,
    NEW.created_by,
    'wallet_tx_' || NEW.type,
    'wallet_transaction',
    NEW.id,
    NEW.type || ' — ' || NEW.amount,
    jsonb_build_object(
      'type', NEW.type,
      'amount', NEW.amount,
      'source', NEW.source,
      'reason', NEW.reason,
      'reference_type', NEW.reference_type,
      'reference_id', NEW.reference_id
    )
  );
  RETURN NEW;
END;
$$;

-- Create the triggers
DROP TRIGGER IF EXISTS trg_guard_wallet_tx_insert ON public.wallet_transactions;
CREATE TRIGGER trg_guard_wallet_tx_insert
  BEFORE INSERT ON public.wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_wallet_transaction_insert();

DROP TRIGGER IF EXISTS trg_guard_wallet_update ON public.tenant_wallets;
CREATE TRIGGER trg_guard_wallet_update
  BEFORE UPDATE ON public.tenant_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_wallet_update();

DROP TRIGGER IF EXISTS trg_audit_wallet_tx_insert ON public.wallet_transactions;
CREATE TRIGGER trg_audit_wallet_tx_insert
  AFTER INSERT ON public.wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_wallet_transaction_insert();

-- 4. Update process_wallet_transaction to set bypass flag
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
  -- Set bypass flag so triggers allow our operations
  PERFORM set_config('app.wallet_bypass', 'true', true);

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

  -- Lock wallet row
  SELECT id, tenant_id, balance_available, balance_pending, status, currency
  INTO v_wallet
  FROM public.tenant_wallets
  WHERE id = p_wallet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المحفظة غير موجودة: %', p_wallet_id;
  END IF;

  IF v_wallet.status = 'frozen' THEN
    RAISE EXCEPTION 'المحفظة مجمّدة — لا يمكن تنفيذ أي عملية. يرجى التواصل مع الإدارة.';
  END IF;

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

  -- Create transaction record
  INSERT INTO public.wallet_transactions (
    wallet_id, type, source, reason, amount,
    reference_type, reference_id, created_by
  ) VALUES (
    p_wallet_id, p_type, p_source, p_reason, p_amount,
    p_reference_type, p_reference_id, p_actor_id
  )
  RETURNING id INTO v_tx_id;

  -- Update balance atomically
  UPDATE public.tenant_wallets
  SET balance_available = v_new_balance,
      balance_pending = v_new_pending
  WHERE id = p_wallet_id;

  RETURN v_tx_id;
END;
$$;

-- 5. Update admin_set_wallet_status to set its own bypass flag
CREATE OR REPLACE FUNCTION public.admin_set_wallet_status(
  p_wallet_id uuid,
  p_status text,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet RECORD;
BEGIN
  IF p_status NOT IN ('active', 'frozen') THEN
    RAISE EXCEPTION 'حالة غير صالحة: %. المسموح: active, frozen', p_status;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_admin_id) THEN
    RAISE EXCEPTION 'غير مصرح — يتطلب صلاحية سوبر أدمن';
  END IF;

  -- Set status-only bypass
  PERFORM set_config('app.wallet_status_bypass', 'true', true);

  SELECT id, tenant_id, status INTO v_wallet
  FROM public.tenant_wallets WHERE id = p_wallet_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المحفظة غير موجودة';
  END IF;

  UPDATE public.tenant_wallets SET status = p_status WHERE id = p_wallet_id;

  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (
    v_wallet.tenant_id, p_admin_id,
    CASE p_status WHEN 'frozen' THEN 'wallet_freeze' ELSE 'wallet_unfreeze' END,
    'wallet', p_wallet_id, p_status,
    jsonb_build_object('old_status', v_wallet.status, 'new_status', p_status)
  );
END;
$$;
