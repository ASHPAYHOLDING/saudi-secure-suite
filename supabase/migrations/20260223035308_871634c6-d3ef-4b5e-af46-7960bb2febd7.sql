
-- Step 1: Delete the incorrect usage record for NUM100
DELETE FROM public.subscription_discount_usage 
WHERE id = 'ae14a078-9841-44c5-860c-6c3a45bb2c44';

-- Step 2: Decrement the used_count back
UPDATE public.subscription_discounts 
SET used_count = GREATEST(used_count - 1, 0) 
WHERE code = 'NUM100';

-- Step 3: Rewrite the function to ONLY validate, not record usage
-- Usage recording should happen in the upgrade-subscription edge function after successful payment
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

  _caller_id := COALESCE(
    auth.uid(),
    (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid
  );
  IF _caller_id IS NULL THEN
    SELECT user_id INTO _caller_id FROM public.tenant_members WHERE tenant_id = _tenant_id AND role = 'owner' LIMIT 1;
  END IF;
  IF _caller_id IS NULL THEN
    _caller_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  SELECT * INTO _discount FROM public.subscription_discounts WHERE code = UPPER(TRIM(_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الكود غير موجود');
  END IF;
  IF NOT _discount.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'الكود معطل');
  END IF;
  IF now() < _discount.starts_at OR now() > _discount.expires_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'الكود منتهي الصلاحية');
  END IF;
  IF _discount.max_uses IS NOT NULL AND _discount.used_count >= _discount.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'تم استنفاد عدد الاستخدامات المسموح');
  END IF;
  IF _discount.eligible_plan_ids IS NOT NULL AND NOT (_plan_id = ANY(_discount.eligible_plan_ids)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'الكود غير صالح لهذه الخطة');
  END IF;

  -- Check if already used by this tenant (only count confirmed usages)
  SELECT EXISTS(
    SELECT 1 FROM public.subscription_discount_usage 
    WHERE discount_id = _discount.id AND tenant_id = _tenant_id
  ) INTO _already_used;
  IF _already_used THEN
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

  -- DO NOT record usage here - only validate and return the discount info
  -- Usage will be recorded by the upgrade-subscription edge function after successful payment

  RETURN jsonb_build_object('success', true, 'discount_id', _discount.id, 'code', _discount.code,
    'discount_type', _discount.discount_type, 'discount_value', _discount.discount_value,
    'amount_before', _original_price, 'amount_after', _new_price, 'discount_amount', _discount_amount);
END;
$function$;

-- Re-grant permissions
REVOKE EXECUTE ON FUNCTION public.apply_subscription_discount(text, uuid, uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.apply_subscription_discount(text, uuid, uuid) TO service_role;

-- Create a new function to record discount usage after successful payment
CREATE OR REPLACE FUNCTION public.record_discount_usage(
  _discount_id uuid, _tenant_id uuid, _subscription_id uuid, _amount_before numeric, _amount_after numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.subscription_discount_usage (discount_id, tenant_id, subscription_id, amount_before, amount_after)
  VALUES (_discount_id, _tenant_id, _subscription_id, _amount_before, _amount_after)
  ON CONFLICT DO NOTHING;
  
  UPDATE public.subscription_discounts SET used_count = used_count + 1 WHERE id = _discount_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_discount_usage(uuid, uuid, uuid, numeric, numeric) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_discount_usage(uuid, uuid, uuid, numeric, numeric) TO service_role;
