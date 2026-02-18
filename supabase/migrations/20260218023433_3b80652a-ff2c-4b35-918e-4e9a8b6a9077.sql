
-- Update the validation trigger to also allow trial_auto source
CREATE OR REPLACE FUNCTION public.validate_integration_activation_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _plan_slug text;
  _sub_status text;
BEGIN
  -- Get current plan info
  SELECT sp.slug, s.status INTO _plan_slug, _sub_status
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = NEW.tenant_id
    AND s.status IN ('active', 'trial')
  ORDER BY s.created_at DESC LIMIT 1;

  -- If activation_source is 'enterprise_auto', verify tenant has enterprise plan
  IF NEW.activation_source = 'enterprise_auto' THEN
    IF _plan_slug IS DISTINCT FROM 'enterprise' THEN
      RAISE EXCEPTION 'activation_source enterprise_auto is only valid for enterprise plan tenants';
    END IF;
  END IF;

  -- If activation_source is 'trial_auto', verify tenant is actually on trial
  IF NEW.activation_source = 'trial_auto' THEN
    IF _sub_status IS DISTINCT FROM 'trial' THEN
      RAISE EXCEPTION 'activation_source trial_auto is only valid for tenants with active trial';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
