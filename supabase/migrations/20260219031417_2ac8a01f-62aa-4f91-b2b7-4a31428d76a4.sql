
-- ============================================================
-- Go/No-Go Fixes: Critical Security Hardening
-- ============================================================

-- FIX 1: Revoke EXECUTE from anon on sensitive mutating RPCs
-- These functions have internal auth guards but shouldn't be callable by anon at all
REVOKE EXECUTE ON FUNCTION public.admin_set_wallet_status FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_topup_request FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_wallet_transaction FROM anon;
REVOKE EXECUTE ON FUNCTION public.encrypt_zatca_private_key FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_zatca_private_key FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_affiliate_payout FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_matured_commissions FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_subscription_discount FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_affiliate_payout FROM anon;
REVOKE EXECUTE ON FUNCTION public.lock_affiliate_commission FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_affiliate_commissions FROM anon;
REVOKE EXECUTE ON FUNCTION public.activate_budget FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_stock_movement FROM anon;
REVOKE EXECUTE ON FUNCTION public.reserve_stock_for_order FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_stock_reservation FROM anon;

-- FIX 2: Fix check_subscription_integrity text=uuid type mismatch
-- The function references _sub.sp_id which is text but compared to plan_id (uuid)
CREATE OR REPLACE FUNCTION public.check_subscription_integrity(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _sub RECORD;
  _plan_slug text;
  _fixes jsonb := '[]'::jsonb;
  _orphan RECORD;
  _ent RECORD;
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
      WHERE pe.plan_id = _sub.sp_id::uuid
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

-- FIX 3: Add RLS policy to webhook_events (service_role only — written by Edge Functions)
CREATE POLICY "Service role full access on webhook_events"
  ON public.webhook_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Ensure authenticated users cannot read webhook_events directly
REVOKE ALL ON public.webhook_events FROM anon, authenticated;
GRANT SELECT ON public.webhook_events TO authenticated;

-- Restrict webhook_events SELECT to platform admins only
DROP POLICY IF EXISTS "Service role full access on webhook_events" ON public.webhook_events;
CREATE POLICY "Platform admins can read webhook_events"
  ON public.webhook_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

CREATE POLICY "Service role can insert webhook_events"
  ON public.webhook_events FOR INSERT
  WITH CHECK (true);
