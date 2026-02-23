
-- Fix apply_subscription_discount: use COALESCE with a fallback for service_role calls
CREATE OR REPLACE FUNCTION public.apply_subscription_discount(_code text, _tenant_id uuid, _plan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _discount RECORD; _plan RECORD; _sub RECORD;
  _already_used BOOLEAN; _original_price NUMERIC; _new_price NUMERIC; _discount_amount NUMERIC;
  _caller_id uuid;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);

  -- Resolve caller: auth.uid() for direct calls, fallback to requesting user from JWT claims for service_role
  _caller_id := COALESCE(
    auth.uid(),
    (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid
  );
  -- If still null, try to find tenant owner as fallback
  IF _caller_id IS NULL THEN
    SELECT user_id INTO _caller_id FROM public.tenant_members WHERE tenant_id = _tenant_id AND role = 'owner' LIMIT 1;
  END IF;
  -- Final fallback to prevent NOT NULL violation
  IF _caller_id IS NULL THEN
    _caller_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  SELECT * INTO _discount FROM public.subscription_discounts WHERE code = UPPER(TRIM(_code)) FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, _caller_id, 'discount_failed', 'subscription_discount', NULL, UPPER(TRIM(_code)),
      jsonb_build_object('reason', 'code_not_found', 'code', UPPER(TRIM(_code))));
    RETURN jsonb_build_object('success', false, 'error', 'الكود غير موجود');
  END IF;
  IF NOT _discount.is_active THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, _caller_id, 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'code_inactive'));
    RETURN jsonb_build_object('success', false, 'error', 'الكود معطل');
  END IF;
  IF now() < _discount.starts_at OR now() > _discount.expires_at THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, _caller_id, 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'code_expired'));
    RETURN jsonb_build_object('success', false, 'error', 'الكود منتهي الصلاحية');
  END IF;
  IF _discount.max_uses IS NOT NULL AND _discount.used_count >= _discount.max_uses THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, _caller_id, 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'max_uses_reached', 'max_uses', _discount.max_uses));
    RETURN jsonb_build_object('success', false, 'error', 'تم استنفاد عدد الاستخدامات المسموح');
  END IF;
  IF _discount.eligible_plan_ids IS NOT NULL AND NOT (_plan_id = ANY(_discount.eligible_plan_ids)) THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, _caller_id, 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'plan_not_eligible', 'plan_id', _plan_id::text));
    RETURN jsonb_build_object('success', false, 'error', 'الكود غير صالح لهذه الخطة');
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.subscription_discount_usage WHERE discount_id = _discount.id AND tenant_id = _tenant_id) INTO _already_used;
  IF _already_used THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, _caller_id, 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'already_used_by_tenant'));
    RETURN jsonb_build_object('success', false, 'error', 'تم استخدام هذا الكود مسبقاً');
  END IF;
  SELECT * INTO _plan FROM public.subscription_plans WHERE id = _plan_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'الخطة غير موجودة'); END IF;
  _original_price := _plan.price_monthly;
  IF _discount.discount_type = 'percentage' THEN
    _discount_amount := ROUND(_original_price * _discount.discount_value / 100, 2);
  ELSE
    _discount_amount := LEAST(_discount.discount_value, _original_price);
  END IF;
  _new_price := GREATEST(_original_price - _discount_amount, 0);
  SELECT * INTO _sub FROM public.subscriptions WHERE tenant_id = _tenant_id AND status IN ('active', 'trial', 'past_due') ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'لا يوجد اشتراك فعال'); END IF;
  INSERT INTO public.subscription_discount_usage (discount_id, tenant_id, subscription_id, amount_before, amount_after)
  VALUES (_discount.id, _tenant_id, _sub.id, _original_price, _new_price);
  UPDATE public.subscription_discounts SET used_count = used_count + 1 WHERE id = _discount.id;
  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (_tenant_id, _caller_id, 'discount_applied', 'subscription_discount', _discount.id, _discount.code,
    jsonb_build_object('plan_id', _plan_id::text, 'amount_before', _original_price, 'amount_after', _new_price,
      'discount_value', _discount.discount_value, 'discount_type', _discount.discount_type));
  RETURN jsonb_build_object('success', true, 'discount_id', _discount.id, 'code', _discount.code,
    'discount_type', _discount.discount_type, 'discount_value', _discount.discount_value,
    'amount_before', _original_price, 'amount_after', _new_price, 'discount_amount', _discount_amount);
END;
$function$;

-- Re-grant permissions
REVOKE EXECUTE ON FUNCTION public.apply_subscription_discount(text, uuid, uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.apply_subscription_discount(text, uuid, uuid) TO service_role;
