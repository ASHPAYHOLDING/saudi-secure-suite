
-- Fix: cast plan_entitlements.plan_id to text for comparison with RECORD field
CREATE OR REPLACE FUNCTION public.check_subscription_integrity(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _sub RECORD;
  _plan_slug text;
  _plan_uuid uuid;
  _fixes jsonb := '[]'::jsonb;
  _orphan RECORD;
  _flag RECORD;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);

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
  _plan_uuid := _sub.sp_id;

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

  FOR _flag IN
    SELECT ff.key, ff.name_ar
    FROM public.feature_flags ff
    WHERE ff.is_enabled_globally = true
      AND NOT (_plan_slug = ANY(ff.enabled_plans))
      AND _sub.status != 'trial'
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = _plan_uuid
        AND pe.feature_key = _flag.key
        AND pe.is_enabled = true
    ) THEN
      _fixes := _fixes || jsonb_build_object(
        'type', 'entitlement_plan_mismatch',
        'feature_key', _flag.key,
        'name', _flag.name_ar,
        'plan', _plan_slug,
        'action', 'logged_for_review'
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(_fixes) > 0 THEN
    INSERT INTO public.audit_logs (
      tenant_id, user_id, action, entity_type, entity_id, entity_label, changes
    ) VALUES (
      _tenant_id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'integrity_auto_correct',
      'subscription',
      _sub.id::text,
      _plan_slug,
      jsonb_build_object('fixes', _fixes, 'checked_at', now())
    );

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
      _sub.id::text
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
$$;
