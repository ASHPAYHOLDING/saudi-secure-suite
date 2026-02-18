
CREATE OR REPLACE FUNCTION public.validate_subscription_discount(_code text, _tenant_id uuid, _plan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _discount RECORD;
  _plan RECORD;
  _already_used BOOLEAN;
  _original_price NUMERIC;
  _new_price NUMERIC;
  _discount_amount NUMERIC;
BEGIN
  SELECT * INTO _discount
  FROM public.subscription_discounts
  WHERE code = UPPER(TRIM(_code));

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

  SELECT EXISTS(
    SELECT 1 FROM public.subscription_discount_usage
    WHERE discount_id = _discount.id AND tenant_id = _tenant_id
  ) INTO _already_used;

  IF _already_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'تم استخدام هذا الكود مسبقاً');
  END IF;

  SELECT * INTO _plan FROM public.subscription_plans WHERE id = _plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الخطة غير موجودة');
  END IF;

  _original_price := _plan.price_monthly;

  IF _discount.discount_type = 'percentage' THEN
    _discount_amount := ROUND(_original_price * _discount.discount_value / 100, 2);
  ELSE
    _discount_amount := LEAST(_discount.discount_value, _original_price);
  END IF;
  _new_price := GREATEST(_original_price - _discount_amount, 0);

  RETURN jsonb_build_object(
    'success', true,
    'discount_id', _discount.id,
    'code', _discount.code,
    'discount_type', _discount.discount_type,
    'discount_value', _discount.discount_value,
    'amount_before', _original_price,
    'amount_after', _new_price,
    'discount_amount', _discount_amount
  );
END;
$function$;
