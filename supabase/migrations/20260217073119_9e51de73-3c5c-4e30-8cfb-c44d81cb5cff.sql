
CREATE OR REPLACE FUNCTION public.admin_review_topup_request(
  p_request_id uuid,
  p_action text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request RECORD;
  v_tx_id uuid;
  v_admin_id uuid;
BEGIN
  v_admin_id := auth.uid();
  
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_admin_id) THEN
    RAISE EXCEPTION 'غير مصرح — هذه العملية متاحة فقط لمديري المنصة';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'الإجراء غير صالح: %. المسموح: approve, reject', p_action;
  END IF;

  SELECT * INTO v_request
  FROM public.wallet_topup_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب الشحن غير موجود';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'تمت مراجعة هذا الطلب مسبقاً. الحالة الحالية: %', v_request.status;
  END IF;

  IF p_action = 'approve' THEN
    v_tx_id := public.process_wallet_transaction(
      p_wallet_id := v_request.wallet_id,
      p_type := 'credit',
      p_amount := v_request.amount,
      p_source := 'admin',
      p_reason := 'topup',
      p_reference_type := 'topup',
      p_reference_id := v_request.id,
      p_actor_id := v_admin_id
    );

    UPDATE public.wallet_topup_requests
    SET status = 'approved',
        reviewed_by = v_admin_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'action', 'approved', 'transaction_id', v_tx_id);

  ELSIF p_action = 'reject' THEN
    UPDATE public.wallet_topup_requests
    SET status = 'rejected',
        reviewed_by = v_admin_id,
        reviewed_at = now(),
        rejection_reason = COALESCE(p_rejection_reason, 'تم الرفض من قبل الإدارة'),
        updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'action', 'rejected');
  END IF;

  RETURN jsonb_build_object('success', false);
END;
$$;
