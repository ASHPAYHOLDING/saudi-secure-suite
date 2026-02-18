
-- Function to deactivate paid integrations that were accessible during trial
-- but aren't included in the tenant's actual plan after trial ends
CREATE OR REPLACE FUNCTION public.cleanup_after_trial_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _plan_slug text;
  _integration RECORD;
BEGIN
  -- Only fire when status changes FROM trial to expired
  IF OLD.status = 'trial' AND NEW.status = 'expired' THEN
    
    -- Get the plan slug for this subscription
    SELECT sp.slug INTO _plan_slug
    FROM public.subscription_plans sp
    WHERE sp.id = NEW.plan_id;

    -- Deactivate all paid integrations that were trial-only
    -- Keep integrations that are included in the actual plan
    FOR _integration IN
      SELECT tpi.id, tpi.integration_id, pi.included_in_plans
      FROM public.tenant_paid_integrations tpi
      JOIN public.paid_integrations pi ON pi.id = tpi.integration_id
      WHERE tpi.tenant_id = NEW.tenant_id
        AND tpi.status = 'active'
        AND tpi.activation_source = 'trial_auto'
    LOOP
      -- If the plan doesn't include this integration, disable it
      IF _plan_slug IS NULL OR NOT (_plan_slug = ANY(_integration.included_in_plans)) THEN
        UPDATE public.tenant_paid_integrations
        SET status = 'disabled',
            deactivated_at = now(),
            deactivation_reason = 'trial_expired'
        WHERE id = _integration.id;
      END IF;
    END LOOP;

    -- Log the cleanup
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      NEW.tenant_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'trial_cleanup',
      'subscription',
      NEW.id,
      'trial_expired',
      jsonb_build_object('plan_slug', _plan_slug, 'action', 'deactivated_trial_integrations')
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger for trial expiry cleanup
DROP TRIGGER IF EXISTS trg_cleanup_after_trial_expiry ON public.subscriptions;
CREATE TRIGGER trg_cleanup_after_trial_expiry
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_after_trial_expiry();

-- Add deactivation tracking columns to tenant_paid_integrations
ALTER TABLE public.tenant_paid_integrations 
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivation_reason text;
