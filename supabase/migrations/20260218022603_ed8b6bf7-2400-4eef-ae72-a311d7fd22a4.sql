-- 1. Update all paid integrations to include 'enterprise' in included_in_plans
UPDATE public.paid_integrations
SET included_in_plans = CASE
  WHEN NOT ('enterprise' = ANY(included_in_plans)) THEN included_in_plans || ARRAY['enterprise']
  ELSE included_in_plans
END;

-- 2. Create function to auto-activate all ready integrations for enterprise tenants
CREATE OR REPLACE FUNCTION public.auto_activate_enterprise_integrations(_tenant_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _integration RECORD;
BEGIN
  -- Only proceed if tenant has enterprise plan
  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE s.tenant_id = _tenant_id
      AND s.status IN ('active', 'trial')
      AND sp.slug = 'enterprise'
  ) THEN
    RETURN;
  END IF;

  -- Auto-activate all ready & listed integrations that aren't already activated
  FOR _integration IN
    SELECT id, key, requires_api_keys
    FROM public.paid_integrations
    WHERE is_ready = true AND is_listed = true
  LOOP
    INSERT INTO public.tenant_paid_integrations (
      tenant_id, integration_id, status, activated_by, 
      purchased_at, activated_at, activation_source
    ) VALUES (
      _tenant_id, _integration.id,
      CASE WHEN _integration.requires_api_keys THEN 'disabled' ELSE 'active' END,
      _user_id,
      now(), now(), 'enterprise_auto'
    )
    ON CONFLICT (tenant_id, integration_id) DO NOTHING;
  END LOOP;
END;
$$;

-- 3. Trigger: auto-activate integrations when subscription changes to enterprise
CREATE OR REPLACE FUNCTION public.trigger_enterprise_auto_activate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _plan_slug text;
  _owner_id uuid;
BEGIN
  -- Only fire on status change to active
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT slug INTO _plan_slug FROM public.subscription_plans WHERE id = NEW.plan_id;
    
    IF _plan_slug = 'enterprise' THEN
      -- Get tenant owner
      SELECT user_id INTO _owner_id 
      FROM public.tenant_members 
      WHERE tenant_id = NEW.tenant_id AND role = 'owner' 
      LIMIT 1;
      
      PERFORM public.auto_activate_enterprise_integrations(NEW.tenant_id, COALESCE(_owner_id, '00000000-0000-0000-0000-000000000000'::uuid));
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enterprise_auto_activate
AFTER UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_enterprise_auto_activate();

-- 4. RLS: Prevent manual insert into tenant_paid_integrations unless entitled
CREATE POLICY "enforce_paid_integrations_entitlement"
ON public.tenant_paid_integrations
FOR INSERT
TO authenticated
WITH CHECK (
  public.enforce_feature_entitlement(tenant_id, 'paid_integrations')
);

-- 5. Validate activation source — prevent 'enterprise_auto' from non-server context
CREATE OR REPLACE FUNCTION public.validate_integration_activation_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _plan_slug text;
BEGIN
  -- If activation_source is 'enterprise_auto', verify tenant actually has enterprise plan
  IF NEW.activation_source = 'enterprise_auto' THEN
    SELECT sp.slug INTO _plan_slug
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE s.tenant_id = NEW.tenant_id
      AND s.status IN ('active', 'trial')
    ORDER BY s.created_at DESC LIMIT 1;
    
    IF _plan_slug IS DISTINCT FROM 'enterprise' THEN
      RAISE EXCEPTION 'activation_source enterprise_auto is only valid for enterprise plan tenants';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_integration_source
BEFORE INSERT OR UPDATE ON public.tenant_paid_integrations
FOR EACH ROW
EXECUTE FUNCTION public.validate_integration_activation_source();
