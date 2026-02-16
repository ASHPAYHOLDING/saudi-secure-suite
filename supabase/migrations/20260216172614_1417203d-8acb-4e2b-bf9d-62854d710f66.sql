
-- Auto-assign a trial subscription when a new tenant is created
CREATE OR REPLACE FUNCTION public.auto_create_trial_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _starter_plan_id uuid;
BEGIN
  -- Get the starter plan (lowest sort_order)
  SELECT id INTO _starter_plan_id
  FROM public.subscription_plans
  WHERE is_active = true
  ORDER BY sort_order ASC
  LIMIT 1;

  IF _starter_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (
      tenant_id,
      plan_id,
      status,
      billing_cycle,
      current_period_start,
      current_period_end,
      trial_ends_at
    ) VALUES (
      NEW.id,
      _starter_plan_id,
      'trial',
      'monthly',
      now(),
      now() + interval '14 days',
      now() + interval '14 days'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to tenants table
CREATE TRIGGER on_tenant_created_assign_trial
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_trial_subscription();

-- Also allow tenant members to view their own subscription logs
CREATE POLICY "Members can view own subscription logs"
  ON public.subscription_logs
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Allow system inserts to subscription_logs (for upgrade/downgrade by owners)
CREATE POLICY "Owners can insert subscription logs"
  ON public.subscription_logs
  FOR INSERT
  WITH CHECK (is_tenant_owner(tenant_id));
