
-- Enforce budget creation limit based on plan entitlements
CREATE OR REPLACE FUNCTION public.enforce_budget_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ent RECORD;
  budget_count INT;
BEGIN
  -- Check budgets_basic entitlement
  SELECT * INTO ent FROM public.check_entitlement(NEW.tenant_id, 'budgets_basic');
  
  IF NOT (ent).allowed THEN
    RAISE EXCEPTION 'Budget feature not available in current plan';
  END IF;
  
  -- Check budget count limit if limit_value is set
  IF (ent).limit IS NOT NULL THEN
    SELECT COUNT(*) INTO budget_count
    FROM public.budgets
    WHERE tenant_id = NEW.tenant_id;
    
    IF budget_count >= (ent).limit THEN
      RAISE EXCEPTION 'Budget limit reached for current plan (% allowed)', (ent).limit;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_enforce_budget_entitlement ON public.budgets;
CREATE TRIGGER trg_enforce_budget_entitlement
  BEFORE INSERT ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_budget_entitlement();

-- Enforce alert events only for plans with budgets_alerts
CREATE OR REPLACE FUNCTION public.enforce_budget_alerts_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ent RECORD;
BEGIN
  SELECT * INTO ent FROM public.check_entitlement(NEW.tenant_id, 'budgets_alerts');
  
  IF NOT (ent).allowed THEN
    RAISE EXCEPTION 'Budget alerts not available in current plan';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_budget_alerts_entitlement ON public.budget_alert_events;
CREATE TRIGGER trg_enforce_budget_alerts_entitlement
  BEFORE INSERT ON public.budget_alert_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_budget_alerts_entitlement();
