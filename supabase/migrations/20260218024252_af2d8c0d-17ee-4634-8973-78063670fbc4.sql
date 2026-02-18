
-- Subscription integrity checker: validates and auto-corrects mismatches
CREATE OR REPLACE FUNCTION public.check_subscription_integrity(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _sub RECORD;
  _plan_slug text;
  _fixes jsonb := '[]'::jsonb;
  _orphan RECORD;
  _ent RECORD;
  _flag RECORD;
BEGIN
  -- 1. Get active subscription
  SELECT s.*, sp.slug AS plan_slug, sp.id AS sp_id
  INTO _sub
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = _tenant_id AND s.status IN ('active','trial','past_due')
  ORDER BY s.created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_subscription', 'fixes', _fixes);
  END IF;

  _plan_slug := _sub.plan_slug;

  -- 2. Check orphan paid integrations (active but not included in plan and not purchased)
  FOR _orphan IN
    SELECT tpi.id, tpi.integration_id, pi.key, pi.name_ar, tpi.activation_source, pi.included_in_plans
    FROM public.tenant_paid_integrations tpi
    JOIN public.paid_integrations pi ON pi.id = tpi.integration_id
    WHERE tpi.tenant_id = _tenant_id
      AND tpi.status = 'active'
      AND tpi.activation_source IN ('trial_auto', 'enterprise_auto')
      AND NOT (_plan_slug = ANY(pi.included_in_plans))
      AND _sub.status != 'trial'
  LOOP
    -- Auto-correct: disable orphan integration
    UPDATE public.tenant_paid_integrations
    SET status = 'disabled',
        deactivated_at = now(),
        deactivation_reason = 'integrity_check_orphan'
    WHERE id = _orphan.id;

    _fixes := _fixes || jsonb_build_object(
      'type', 'orphan_integration_disabled',
      'integration_key', _orphan.key,
      'name', _orphan.name_ar,
      'source', _orphan.activation_source,
      'plan', _plan_slug
    );
  END LOOP;

  -- 3. Check feature flags: ensure no tenant override enables a feature not in their plan entitlements
  FOR _flag IN
    SELECT ff.key, ff.name_ar
    FROM public.feature_flags ff
    WHERE ff.is_enabled_globally = true
      AND NOT (_plan_slug = ANY(ff.enabled_plans))
      AND _sub.status != 'trial'
  LOOP
    -- Check if there's an active entitlement that shouldn't exist
    IF EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = _sub.sp_id
        AND pe.feature_key = _flag.key
        AND pe.is_enabled = true
    ) THEN
      -- This is a data inconsistency: entitlement exists but plan shouldn't have it
      -- We don't auto-delete entitlements (admin-managed), but we log it
      _fixes := _fixes || jsonb_build_object(
        'type', 'entitlement_plan_mismatch',
        'feature_key', _flag.key,
        'name', _flag.name_ar,
        'plan', _plan_slug,
        'action', 'logged_for_review'
      );
    END IF;
  END LOOP;

  -- 4. If any fixes were applied, log incident and notify super admin
  IF jsonb_array_length(_fixes) > 0 THEN
    -- Log audit incident
    INSERT INTO public.audit_logs (
      tenant_id, user_id, action, entity_type, entity_id, entity_label, changes
    ) VALUES (
      _tenant_id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'integrity_auto_correct',
      'subscription',
      _sub.id,
      _plan_slug,
      jsonb_build_object('fixes', _fixes, 'checked_at', now())
    );

    -- Notify all super admins via collaboration_notifications
    INSERT INTO public.collaboration_notifications (
      tenant_id, user_id, actor_id, type, message, entity_type, entity_id
    )
    SELECT
      _tenant_id,
      pa.user_id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'integrity_alert',
      'تم اكتشاف وإصلاح ' || jsonb_array_length(_fixes) || ' مخالفة في اشتراك المنشأة تلقائياً',
      'subscription',
      _sub.id
    FROM public.platform_admins pa;
  END IF;

  RETURN jsonb_build_object(
    'status', 'checked',
    'plan', _plan_slug,
    'subscription_status', _sub.status,
    'fixes_count', jsonb_array_length(_fixes),
    'fixes', _fixes
  );
END;
$function$;

-- Trigger on plan change (subscription update)
CREATE OR REPLACE FUNCTION public.trg_integrity_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Fire when plan_id changes or status changes
  IF (OLD.plan_id IS DISTINCT FROM NEW.plan_id)
     OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('active','expired')) THEN
    PERFORM public.check_subscription_integrity(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_subscription_integrity_check
AFTER UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.trg_integrity_on_plan_change();
