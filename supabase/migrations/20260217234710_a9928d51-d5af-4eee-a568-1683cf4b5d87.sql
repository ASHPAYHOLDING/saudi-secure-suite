
-- 1. Create subscription_discounts table
CREATE TABLE public.subscription_discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  max_uses INTEGER DEFAULT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  eligible_plan_ids UUID[] DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_discount_code UNIQUE (code),
  CONSTRAINT valid_percentage CHECK (discount_type != 'percentage' OR (discount_value > 0 AND discount_value <= 100))
);

-- Auto-uppercase code trigger
CREATE OR REPLACE FUNCTION public.uppercase_discount_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.code := UPPER(TRIM(NEW.code));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_uppercase_discount_code
BEFORE INSERT OR UPDATE ON public.subscription_discounts
FOR EACH ROW EXECUTE FUNCTION public.uppercase_discount_code();

-- Updated_at trigger
CREATE TRIGGER update_subscription_discounts_updated_at
BEFORE UPDATE ON public.subscription_discounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Prevent DELETE trigger (deactivate only)
CREATE OR REPLACE FUNCTION public.prevent_discount_delete()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'لا يمكن حذف أكواد الخصم، يمكنك تعطيلها فقط (Discount codes cannot be deleted, only deactivated)';
END;
$$;

CREATE TRIGGER trg_prevent_discount_delete
BEFORE DELETE ON public.subscription_discounts
FOR EACH ROW EXECUTE FUNCTION public.prevent_discount_delete();

-- 2. Create subscription_discount_usage table
CREATE TABLE public.subscription_discount_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discount_id UUID NOT NULL REFERENCES public.subscription_discounts(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id),
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount_before NUMERIC NOT NULL,
  amount_after NUMERIC NOT NULL
);

-- 3. RLS
ALTER TABLE public.subscription_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_discount_usage ENABLE ROW LEVEL SECURITY;

-- subscription_discounts: platform admins full access
CREATE POLICY "Platform admins full access on discounts"
ON public.subscription_discounts FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- subscription_discounts: authenticated users can SELECT active codes only
CREATE POLICY "Users can verify active discount codes"
ON public.subscription_discounts FOR SELECT TO authenticated
USING (is_active = true AND starts_at <= now() AND expires_at > now());

-- subscription_discount_usage: platform admins full access
CREATE POLICY "Platform admins full access on discount usage"
ON public.subscription_discount_usage FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- subscription_discount_usage: tenants can view own usage
CREATE POLICY "Tenants can view own discount usage"
ON public.subscription_discount_usage FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id));

-- 4. Server-side RPC: apply_subscription_discount
CREATE OR REPLACE FUNCTION public.apply_subscription_discount(
  _code TEXT,
  _tenant_id UUID,
  _plan_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _discount RECORD;
  _plan RECORD;
  _sub RECORD;
  _already_used BOOLEAN;
  _original_price NUMERIC;
  _new_price NUMERIC;
  _discount_amount NUMERIC;
BEGIN
  -- 1. Find discount code
  SELECT * INTO _discount
  FROM public.subscription_discounts
  WHERE code = UPPER(TRIM(_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Audit failed attempt
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, auth.uid(), 'discount_failed', 'subscription_discount', NULL, UPPER(TRIM(_code)),
      jsonb_build_object('reason', 'code_not_found', 'code', UPPER(TRIM(_code))));
    RETURN jsonb_build_object('success', false, 'error', 'الكود غير موجود');
  END IF;

  -- 2. Check active
  IF NOT _discount.is_active THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, auth.uid(), 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'code_inactive'));
    RETURN jsonb_build_object('success', false, 'error', 'الكود معطل');
  END IF;

  -- 3. Check date range
  IF now() < _discount.starts_at OR now() > _discount.expires_at THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, auth.uid(), 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'code_expired'));
    RETURN jsonb_build_object('success', false, 'error', 'الكود منتهي الصلاحية');
  END IF;

  -- 4. Check max uses
  IF _discount.max_uses IS NOT NULL AND _discount.used_count >= _discount.max_uses THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, auth.uid(), 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'max_uses_reached', 'max_uses', _discount.max_uses));
    RETURN jsonb_build_object('success', false, 'error', 'تم استنفاد عدد الاستخدامات المسموح');
  END IF;

  -- 5. Check eligible plans
  IF _discount.eligible_plan_ids IS NOT NULL AND NOT (_plan_id = ANY(_discount.eligible_plan_ids)) THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, auth.uid(), 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'plan_not_eligible', 'plan_id', _plan_id::text));
    RETURN jsonb_build_object('success', false, 'error', 'الكود غير صالح لهذه الخطة');
  END IF;

  -- 6. Check already used by this tenant
  SELECT EXISTS(
    SELECT 1 FROM public.subscription_discount_usage
    WHERE discount_id = _discount.id AND tenant_id = _tenant_id
  ) INTO _already_used;

  IF _already_used THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, auth.uid(), 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'already_used_by_tenant'));
    RETURN jsonb_build_object('success', false, 'error', 'تم استخدام هذا الكود مسبقاً');
  END IF;

  -- 7. Get plan price
  SELECT * INTO _plan FROM public.subscription_plans WHERE id = _plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الخطة غير موجودة');
  END IF;

  _original_price := _plan.price_monthly;

  -- 8. Calculate discounted price
  IF _discount.discount_type = 'percentage' THEN
    _discount_amount := ROUND(_original_price * _discount.discount_value / 100, 2);
  ELSE
    _discount_amount := LEAST(_discount.discount_value, _original_price);
  END IF;
  _new_price := GREATEST(_original_price - _discount_amount, 0);

  -- 9. Get current subscription
  SELECT * INTO _sub FROM public.subscriptions
  WHERE tenant_id = _tenant_id AND status IN ('active', 'trial', 'past_due')
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يوجد اشتراك فعال');
  END IF;

  -- 10. Record usage
  INSERT INTO public.subscription_discount_usage (discount_id, tenant_id, subscription_id, amount_before, amount_after)
  VALUES (_discount.id, _tenant_id, _sub.id, _original_price, _new_price);

  -- 11. Atomic increment used_count
  UPDATE public.subscription_discounts
  SET used_count = used_count + 1
  WHERE id = _discount.id;

  -- 12. Audit success
  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (_tenant_id, auth.uid(), 'discount_applied', 'subscription_discount', _discount.id, _discount.code,
    jsonb_build_object(
      'plan_id', _plan_id::text,
      'amount_before', _original_price,
      'amount_after', _new_price,
      'discount_value', _discount.discount_value,
      'discount_type', _discount.discount_type
    ));

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
$$;

-- 5. Audit trigger for discount creation/modification
CREATE OR REPLACE FUNCTION public.audit_discount_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, NEW.created_by, 'create', 'subscription_discount', NEW.id, NEW.code,
      jsonb_build_object('discount_type', NEW.discount_type, 'discount_value', NEW.discount_value, 'max_uses', NEW.max_uses, 'expires_at', NEW.expires_at));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, COALESCE(auth.uid(), NEW.created_by), 'update', 'subscription_discount', NEW.id, NEW.code,
      jsonb_build_object(
        'old_active', OLD.is_active, 'new_active', NEW.is_active,
        'old_value', OLD.discount_value, 'new_value', NEW.discount_value,
        'used_count', NEW.used_count
      ));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_discount_changes
AFTER INSERT OR UPDATE ON public.subscription_discounts
FOR EACH ROW EXECUTE FUNCTION public.audit_discount_changes();
