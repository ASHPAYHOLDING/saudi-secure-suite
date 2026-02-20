
-- Create get_paid_integrations_state RPC
-- Returns all listed integrations with tenant activation status, entitlement, and can_activate
-- in a single round-trip (replaces N+1 waterfall)

CREATE OR REPLACE FUNCTION public.get_paid_integrations_state(p_tenant_id uuid)
RETURNS TABLE (
  integration_id       uuid,
  key                  text,
  name_ar              text,
  name_en              text,
  description_ar       text,
  integration_type     text,
  price_once           numeric,
  sort_order           int,
  is_ready             boolean,
  requires_api_keys    boolean,
  api_key_label        text,
  trial_days           int,
  has_service          boolean,
  has_api_client       boolean,
  has_test_connection  boolean,
  tenant_activation_status text,   -- 'active' | 'disabled' | 'none'
  activation_source    text,       -- 'trial_auto' | 'enterprise_auto' | 'purchase' | null
  api_key_encrypted    text,       -- null if not set
  entitlement_allowed  boolean,
  entitlement_reason   text,
  can_activate         boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_slug   text;
  v_sub_status  text;
  v_ent_allowed boolean := false;
  v_ent_reason  text    := 'not_found';
BEGIN
  -- Security: caller must be a member of the tenant
  PERFORM assert_tenant_member(p_tenant_id);

  -- Resolve active subscription plan
  SELECT sp.slug, s.status
    INTO v_plan_slug, v_sub_status
    FROM subscriptions s
    JOIN subscription_plans sp ON sp.id = s.plan_id
   WHERE s.tenant_id = p_tenant_id
     AND s.status IN ('active', 'trial')
   ORDER BY
     CASE s.status WHEN 'active' THEN 0 ELSE 1 END,
     s.created_at DESC
   LIMIT 1;

  -- Determine entitlement for paid_integrations feature
  IF v_sub_status = 'trial' THEN
    v_ent_allowed := true;
    v_ent_reason  := 'trial';
  ELSIF v_plan_slug IN ('pro', 'professional', 'enterprise') THEN
    -- Check plan_entitlements table
    SELECT pe.is_allowed
      INTO v_ent_allowed
      FROM plan_entitlements pe
      JOIN subscription_plans sp2 ON sp2.id = pe.plan_id
     WHERE sp2.slug   = v_plan_slug
       AND pe.feature_key = 'paid_integrations'
     LIMIT 1;

    IF v_ent_allowed IS NULL THEN
      v_ent_allowed := false;
      v_ent_reason  := 'not_found';
    ELSE
      v_ent_reason := CASE WHEN v_ent_allowed THEN 'plan' ELSE 'not_in_plan' END;
    END IF;
  ELSE
    v_ent_allowed := false;
    v_ent_reason  := 'not_in_plan';
  END IF;

  RETURN QUERY
  SELECT
    pi.id                                                      AS integration_id,
    pi.key,
    pi.name_ar,
    pi.name_en,
    COALESCE(pi.description_ar, '')                           AS description_ar,
    pi.integration_type,
    COALESCE(pi.price_once, 0)                               AS price_once,
    COALESCE(pi.sort_order, 999)                             AS sort_order,
    COALESCE(pi.is_ready, false)                             AS is_ready,
    COALESCE(pi.requires_api_keys, false)                    AS requires_api_keys,
    COALESCE(pi.api_key_label, '')                           AS api_key_label,
    COALESCE(pi.trial_days, 0)                               AS trial_days,
    COALESCE(pi.has_service, false)                          AS has_service,
    COALESCE(pi.has_api_client, false)                       AS has_api_client,
    COALESCE(pi.has_test_connection, false)                  AS has_test_connection,
    COALESCE(tpi.status, 'none')                             AS tenant_activation_status,
    tpi.activation_source,
    tpi.api_key_encrypted,
    v_ent_allowed                                             AS entitlement_allowed,
    v_ent_reason                                              AS entitlement_reason,
    -- can_activate: entitlement allowed AND integration is ready
    (v_ent_allowed AND COALESCE(pi.is_ready, false))         AS can_activate
  FROM paid_integrations pi
  LEFT JOIN tenant_paid_integrations tpi
         ON tpi.integration_id = pi.id
        AND tpi.tenant_id      = p_tenant_id
  WHERE pi.is_listed = true
  ORDER BY COALESCE(pi.sort_order, 999), pi.name_ar;
END;
$$;

-- Grant execute to authenticated role only (deny public/anon)
REVOKE ALL ON FUNCTION public.get_paid_integrations_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_paid_integrations_state(uuid) TO authenticated;
