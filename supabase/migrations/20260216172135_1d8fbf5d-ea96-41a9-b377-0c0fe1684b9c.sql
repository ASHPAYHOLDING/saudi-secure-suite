
-- Add grace period to subscription plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS grace_period_days integer NOT NULL DEFAULT 7;

-- Add grace period end date to subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS grace_ends_at timestamp with time zone;

-- Add past_due status handling - update subscriptions with grace period when they expire
-- Create function for auto-expiry processing
CREATE OR REPLACE FUNCTION public.process_subscription_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sub RECORD;
  _grace_days integer;
BEGIN
  -- Step 1: Move active subscriptions past their end date to past_due with grace period
  FOR _sub IN
    SELECT s.id, s.tenant_id, s.plan_id, s.status, s.current_period_end,
           sp.grace_period_days
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE s.status = 'active'
      AND s.current_period_end < now()
      AND s.cancel_at_period_end = false
  LOOP
    UPDATE public.subscriptions
    SET status = 'past_due',
        grace_ends_at = _sub.current_period_end + (_sub.grace_period_days || ' days')::interval,
        updated_at = now()
    WHERE id = _sub.id;

    -- Log the change
    INSERT INTO public.subscription_logs (subscription_id, tenant_id, action, old_status, new_status, performed_by, notes)
    VALUES (_sub.id, _sub.tenant_id, 'status_change', 'active', 'past_due', '00000000-0000-0000-0000-000000000000', 
            'انتهت فترة الاشتراك - بداية فترة السماح ' || _sub.grace_period_days || ' يوم');
  END LOOP;

  -- Step 2: Move past_due subscriptions past grace period to expired
  FOR _sub IN
    SELECT s.id, s.tenant_id
    FROM public.subscriptions s
    WHERE s.status = 'past_due'
      AND s.grace_ends_at IS NOT NULL
      AND s.grace_ends_at < now()
  LOOP
    UPDATE public.subscriptions
    SET status = 'expired', updated_at = now()
    WHERE id = _sub.id;

    INSERT INTO public.subscription_logs (subscription_id, tenant_id, action, old_status, new_status, performed_by, notes)
    VALUES (_sub.id, _sub.tenant_id, 'status_change', 'past_due', 'expired', '00000000-0000-0000-0000-000000000000', 
            'انتهت فترة السماح - تم إيقاف الاشتراك');
  END LOOP;

  -- Step 3: Move active subscriptions that are set to cancel at period end to cancelled
  FOR _sub IN
    SELECT s.id, s.tenant_id
    FROM public.subscriptions s
    WHERE s.status = 'active'
      AND s.cancel_at_period_end = true
      AND s.current_period_end < now()
  LOOP
    UPDATE public.subscriptions
    SET status = 'cancelled', updated_at = now()
    WHERE id = _sub.id;

    INSERT INTO public.subscription_logs (subscription_id, tenant_id, action, old_status, new_status, performed_by, notes)
    VALUES (_sub.id, _sub.tenant_id, 'cancel', 'active', 'cancelled', '00000000-0000-0000-0000-000000000000', 
            'تم إلغاء الاشتراك تلقائياً عند انتهاء الفترة');
  END LOOP;

  -- Step 4: Expire trials
  FOR _sub IN
    SELECT s.id, s.tenant_id
    FROM public.subscriptions s
    WHERE s.status = 'trial'
      AND s.trial_ends_at IS NOT NULL
      AND s.trial_ends_at < now()
  LOOP
    UPDATE public.subscriptions
    SET status = 'expired', updated_at = now()
    WHERE id = _sub.id;

    INSERT INTO public.subscription_logs (subscription_id, tenant_id, action, old_status, new_status, performed_by, notes)
    VALUES (_sub.id, _sub.tenant_id, 'status_change', 'trial', 'expired', '00000000-0000-0000-0000-000000000000', 
            'انتهت الفترة التجريبية');
  END LOOP;
END;
$$;
