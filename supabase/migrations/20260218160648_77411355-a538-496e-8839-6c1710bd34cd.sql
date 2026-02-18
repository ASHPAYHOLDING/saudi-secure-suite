
-- ============================================
-- 1. Add referral_code to tenants for tracking
-- ============================================
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS referral_code text;
CREATE INDEX IF NOT EXISTS idx_tenants_referral_code ON public.tenants(referral_code);

-- ============================================
-- 2. ATOMIC: Process affiliate commission on new subscription
-- ============================================
CREATE OR REPLACE FUNCTION public.process_affiliate_commission(
  _tenant_id uuid,
  _subscription_id uuid,
  _plan_id uuid,
  _paid_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant RECORD;
  _affiliate RECORD;
  _referral RECORD;
  _commission_amount numeric;
  _commission_id uuid;
BEGIN
  -- 1. Get tenant and check referral_code
  SELECT * INTO _tenant FROM public.tenants WHERE id = _tenant_id;
  IF _tenant.referral_code IS NULL OR _tenant.referral_code = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_referral_code');
  END IF;

  -- 2. Find active affiliate by code
  SELECT * INTO _affiliate
  FROM public.affiliates
  WHERE code = _tenant.referral_code AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'affiliate_not_found_or_inactive');
  END IF;

  -- 3. Prevent self-referral
  IF _affiliate.tenant_id = _tenant_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'self_referral_blocked');
  END IF;

  -- 4. Check duplicate: already have commission for this subscription
  IF EXISTS (
    SELECT 1 FROM public.affiliate_commissions
    WHERE affiliate_id = _affiliate.id
      AND subscription_id = _subscription_id
      AND status NOT IN ('cancelled')
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'commission_already_exists');
  END IF;

  -- 5. Ensure referral record exists
  SELECT id INTO _referral
  FROM public.affiliate_referrals
  WHERE affiliate_id = _affiliate.id AND referred_tenant_id = _tenant_id
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.affiliate_referrals (affiliate_id, referred_tenant_id, subscription_id, source)
    VALUES (_affiliate.id, _tenant_id, _subscription_id, 'referral_code');
  END IF;

  -- 6. Calculate commission
  _commission_amount := ROUND(_paid_amount * _affiliate.commission_rate / 100, 2);

  -- 7. Create commission record (pending)
  INSERT INTO public.affiliate_commissions (
    affiliate_id, subscription_id, tenant_id,
    gross_amount, net_amount, commission_rate, commission_amount,
    status
  ) VALUES (
    _affiliate.id, _subscription_id, _tenant_id,
    _paid_amount, _paid_amount, _affiliate.commission_rate, _commission_amount,
    'pending'
  ) RETURNING id INTO _commission_id;

  -- 8. Audit
  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (
    _tenant_id,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'commission_created',
    'affiliate_commission',
    _commission_id,
    _affiliate.code,
    jsonb_build_object(
      'affiliate_id', _affiliate.id,
      'paid_amount', _paid_amount,
      'commission_rate', _affiliate.commission_rate,
      'commission_amount', _commission_amount,
      'tier', _affiliate.tier
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'commission_id', _commission_id,
    'affiliate_id', _affiliate.id,
    'commission_amount', _commission_amount
  );
END;
$$;

-- ============================================
-- 3. Lock commission after payment confirmation
-- ============================================
CREATE OR REPLACE FUNCTION public.lock_affiliate_commission(
  _subscription_id uuid,
  _cooling_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _commission RECORD;
  _locked_count integer := 0;
BEGIN
  FOR _commission IN
    SELECT id, affiliate_id, commission_amount
    FROM public.affiliate_commissions
    WHERE subscription_id = _subscription_id AND status = 'pending'
    FOR UPDATE
  LOOP
    UPDATE public.affiliate_commissions
    SET status = 'locked',
        locked_until = now() + (_cooling_days || ' days')::interval
    WHERE id = _commission.id;

    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      (SELECT tenant_id FROM public.affiliate_commissions WHERE id = _commission.id),
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'commission_locked',
      'affiliate_commission',
      _commission.id,
      'cooling_period',
      jsonb_build_object('locked_until', now() + (_cooling_days || ' days')::interval, 'amount', _commission.commission_amount)
    );

    _locked_count := _locked_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'locked_count', _locked_count);
END;
$$;

-- ============================================
-- 4. Cancel commissions on refund/cancellation
-- ============================================
CREATE OR REPLACE FUNCTION public.cancel_affiliate_commissions(_subscription_id uuid, _reason text DEFAULT 'subscription_cancelled')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _commission RECORD;
  _cancelled_count integer := 0;
BEGIN
  FOR _commission IN
    SELECT id, affiliate_id, commission_amount, tenant_id
    FROM public.affiliate_commissions
    WHERE subscription_id = _subscription_id AND status IN ('pending', 'locked')
    FOR UPDATE
  LOOP
    UPDATE public.affiliate_commissions
    SET status = 'cancelled'
    WHERE id = _commission.id;

    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      _commission.tenant_id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'commission_cancelled',
      'affiliate_commission',
      _commission.id,
      _reason,
      jsonb_build_object('amount', _commission.commission_amount, 'reason', _reason)
    );

    _cancelled_count := _cancelled_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'cancelled_count', _cancelled_count);
END;
$$;

-- ============================================
-- 5. Approve matured commissions (cooling period ended)
-- ============================================
CREATE OR REPLACE FUNCTION public.approve_matured_commissions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _commission RECORD;
  _approved_count integer := 0;
BEGIN
  FOR _commission IN
    SELECT id, affiliate_id, commission_amount, tenant_id
    FROM public.affiliate_commissions
    WHERE status = 'locked' AND locked_until <= now()
    FOR UPDATE
  LOOP
    UPDATE public.affiliate_commissions
    SET status = 'approved'
    WHERE id = _commission.id;

    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      _commission.tenant_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'commission_approved',
      'affiliate_commission',
      _commission.id,
      'cooling_period_ended',
      jsonb_build_object('amount', _commission.commission_amount)
    );

    _approved_count := _approved_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'approved_count', _approved_count);
END;
$$;

-- ============================================
-- 6. Auto-trigger commission on subscription activation
-- ============================================
CREATE OR REPLACE FUNCTION public.trg_commission_on_subscription_activate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _plan RECORD;
  _result jsonb;
BEGIN
  -- Only fire when status changes to 'active'
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT * INTO _plan FROM public.subscription_plans WHERE id = NEW.plan_id;

    IF _plan IS NOT NULL THEN
      _result := public.process_affiliate_commission(
        NEW.tenant_id,
        NEW.id,
        NEW.plan_id,
        COALESCE(_plan.price_monthly, 0)
      );
      -- Also lock immediately since activation = payment confirmed
      IF (_result->>'success')::boolean THEN
        PERFORM public.lock_affiliate_commission(NEW.id, 7);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_affiliate_commission_on_sub_activate
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_commission_on_subscription_activate();

-- ============================================
-- 7. Auto-cancel commissions on subscription cancellation/expiry
-- ============================================
CREATE OR REPLACE FUNCTION public.trg_commission_on_subscription_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'expired') AND OLD.status NOT IN ('cancelled', 'expired') THEN
    PERFORM public.cancel_affiliate_commissions(NEW.id, 'subscription_' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_affiliate_commission_on_sub_cancel
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_commission_on_subscription_cancel();
