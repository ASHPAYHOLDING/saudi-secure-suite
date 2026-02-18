
-- ============================================
-- 1. Add bank details to affiliates
-- ============================================
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_iban text,
  ADD COLUMN IF NOT EXISTS bank_account_name text;

-- ============================================
-- 2. Add payout_id to commissions for linking
-- ============================================
ALTER TABLE public.affiliate_commissions
  ADD COLUMN IF NOT EXISTS payout_id uuid REFERENCES public.affiliate_payouts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_payout_id ON public.affiliate_commissions(payout_id);

-- ============================================
-- 3. ATOMIC: Request payout
-- ============================================
CREATE OR REPLACE FUNCTION public.request_affiliate_payout(
  _affiliate_id uuid,
  _method text DEFAULT 'wallet',
  _commission_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _affiliate RECORD;
  _total numeric;
  _payout_id uuid;
  _min_payout numeric := 500;
  _has_pending boolean;
  _ids uuid[];
BEGIN
  -- 1. Verify affiliate
  SELECT * INTO _affiliate FROM public.affiliates WHERE id = _affiliate_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الشريك غير موجود أو غير نشط');
  END IF;

  -- 2. Verify caller owns this affiliate
  IF _affiliate.user_id IS DISTINCT FROM auth.uid() THEN
    IF NOT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()) THEN
      RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
    END IF;
  END IF;

  -- 3. Check no pending payouts
  IF EXISTS (SELECT 1 FROM public.affiliate_payouts WHERE affiliate_id = _affiliate_id AND status IN ('pending','approved')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'يوجد طلب صرف قيد المراجعة بالفعل');
  END IF;

  -- 4. Check method
  IF _method NOT IN ('wallet', 'bank_transfer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'طريقة الصرف غير صالحة');
  END IF;

  -- 5. Bank transfer requires bank info
  IF _method = 'bank_transfer' AND (_affiliate.bank_iban IS NULL OR _affiliate.bank_iban = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'يرجى إضافة بيانات الحساب البنكي أولاً');
  END IF;

  -- 6. Get approved commissions
  IF _commission_ids IS NOT NULL AND array_length(_commission_ids, 1) > 0 THEN
    SELECT COALESCE(SUM(commission_amount), 0), array_agg(id)
    INTO _total, _ids
    FROM public.affiliate_commissions
    WHERE id = ANY(_commission_ids) AND affiliate_id = _affiliate_id AND status = 'approved' AND payout_id IS NULL;
  ELSE
    SELECT COALESCE(SUM(commission_amount), 0), array_agg(id)
    INTO _total, _ids
    FROM public.affiliate_commissions
    WHERE affiliate_id = _affiliate_id AND status = 'approved' AND payout_id IS NULL;
  END IF;

  IF _total < _min_payout THEN
    RETURN jsonb_build_object('success', false, 'error', 'الحد الأدنى للسحب ' || _min_payout || ' ر.س — رصيدك المتاح: ' || _total || ' ر.س');
  END IF;

  -- 7. Check locked/pending commissions
  SELECT EXISTS (
    SELECT 1 FROM public.affiliate_commissions
    WHERE affiliate_id = _affiliate_id AND status IN ('pending','locked')
  ) INTO _has_pending;

  -- 8. Create payout
  INSERT INTO public.affiliate_payouts (affiliate_id, amount, method, status, notes)
  VALUES (_affiliate_id, _total, _method, 'pending',
    CASE WHEN _has_pending THEN 'تنبيه: توجد عمولات معلقة لم تُصرف' ELSE NULL END
  ) RETURNING id INTO _payout_id;

  -- 9. Link commissions to payout
  UPDATE public.affiliate_commissions
  SET payout_id = _payout_id
  WHERE id = ANY(_ids);

  -- 10. Audit
  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (
    COALESCE(_affiliate.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'payout_requested', 'affiliate_payout', _payout_id, _affiliate.code,
    jsonb_build_object('amount', _total, 'method', _method, 'commission_count', array_length(_ids, 1), 'has_pending_commissions', _has_pending)
  );

  RETURN jsonb_build_object('success', true, 'payout_id', _payout_id, 'amount', _total, 'method', _method);
END;
$$;

-- ============================================
-- 4. ATOMIC: Approve/Reject payout (admin only)
-- ============================================
CREATE OR REPLACE FUNCTION public.process_affiliate_payout(
  _payout_id uuid,
  _action text, -- 'approve' or 'reject'
  _admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _payout RECORD;
  _affiliate RECORD;
  _wallet RECORD;
  _wallet_result jsonb;
  _updated_count integer;
BEGIN
  -- 1. Admin check
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح — صلاحيات السوبر أدمن مطلوبة');
  END IF;

  -- 2. Get payout
  SELECT * INTO _payout FROM public.affiliate_payouts WHERE id = _payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'طلب الصرف غير موجود');
  END IF;

  IF _payout.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'طلب الصرف ليس في حالة انتظار');
  END IF;

  -- 3. Get affiliate
  SELECT * INTO _affiliate FROM public.affiliates WHERE id = _payout.affiliate_id;

  -- ========= REJECT =========
  IF _action = 'reject' THEN
    UPDATE public.affiliate_payouts
    SET status = 'rejected', processed_at = now(), processed_by = auth.uid(),
        notes = COALESCE(_admin_notes, notes)
    WHERE id = _payout_id;

    -- Unlink commissions
    UPDATE public.affiliate_commissions SET payout_id = NULL WHERE payout_id = _payout_id;

    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      COALESCE(_affiliate.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
      auth.uid(), 'payout_rejected', 'affiliate_payout', _payout_id, _affiliate.code,
      jsonb_build_object('amount', _payout.amount, 'reason', COALESCE(_admin_notes, 'rejected'))
    );

    RETURN jsonb_build_object('success', true, 'action', 'rejected');
  END IF;

  -- ========= APPROVE =========
  IF _action != 'approve' THEN
    RETURN jsonb_build_object('success', false, 'error', 'الإجراء غير صالح — استخدم approve أو reject');
  END IF;

  -- 4a. Wallet payout: deposit into affiliate's tenant wallet
  IF _payout.method = 'wallet' THEN
    IF _affiliate.tenant_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'الشريك ليس مرتبطاً بمنشأة — لا يمكن الإيداع في المحفظة');
    END IF;

    -- Get wallet
    SELECT * INTO _wallet FROM public.wallets WHERE tenant_id = _affiliate.tenant_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'المحفظة غير موجودة للمنشأة');
    END IF;

    -- Process wallet deposit
    _wallet_result := public.process_wallet_transaction(
      _affiliate.tenant_id,
      'deposit',
      _payout.amount,
      'system',
      'payout',
      'payout',
      _payout_id::text
    );

    IF NOT (_wallet_result->>'success')::boolean THEN
      RETURN jsonb_build_object('success', false, 'error', 'فشل إيداع المحفظة: ' || COALESCE(_wallet_result->>'error', 'unknown'));
    END IF;
  END IF;

  -- 5. Mark payout as paid
  UPDATE public.affiliate_payouts
  SET status = 'paid', processed_at = now(), processed_by = auth.uid(),
      notes = COALESCE(_admin_notes, notes)
  WHERE id = _payout_id;

  -- 6. Mark all linked commissions as paid
  UPDATE public.affiliate_commissions
  SET status = 'paid', paid_at = now()
  WHERE payout_id = _payout_id AND status = 'approved';

  GET DIAGNOSTICS _updated_count = ROW_COUNT;

  -- 7. Audit
  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (
    COALESCE(_affiliate.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    auth.uid(), 'payout_approved', 'affiliate_payout', _payout_id, _affiliate.code,
    jsonb_build_object(
      'amount', _payout.amount, 'method', _payout.method,
      'commissions_paid', _updated_count,
      'wallet_deposit', _payout.method = 'wallet'
    )
  );

  RETURN jsonb_build_object('success', true, 'action', 'approved', 'amount', _payout.amount, 'commissions_paid', _updated_count);
END;
$$;
