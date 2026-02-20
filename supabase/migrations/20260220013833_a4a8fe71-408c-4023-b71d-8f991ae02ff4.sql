
DROP FUNCTION IF EXISTS public.get_paid_integrations_state(uuid);

CREATE OR REPLACE FUNCTION public.get_paid_integrations_state(p_tenant_id uuid)
RETURNS TABLE(
  id uuid,
  key text,
  name_ar text,
  name_en text,
  description_ar text,
  integration_type text,
  price_once numeric,
  sort_order int,
  is_ready boolean,
  requires_api_keys boolean,
  api_key_label text,
  trial_days int,
  has_service boolean,
  has_api_client boolean,
  has_test_connection boolean,
  tenant_status text,
  activation_source text,
  has_secret_configured boolean,
  ent_allowed boolean,
  ent_reason text,
  is_accessible boolean
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
  PERFORM assert_tenant_member(p_tenant_id);

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

  IF v_sub_status = 'trial' THEN
    v_ent_allowed := true;
    v_ent_reason  := 'trial';
  ELSIF v_plan_slug IN ('pro', 'professional', 'enterprise') THEN
    SELECT pe.is_enabled
      INTO v_ent_allowed
      FROM plan_entitlements pe
      JOIN subscription_plans sp2 ON sp2.id = pe.plan_id
     WHERE sp2.slug       = v_plan_slug
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
    pi.id,
    pi.key,
    pi.name_ar,
    pi.name_en,
    COALESCE(pi.description_ar, ''),
    pi.integration_type,
    COALESCE(pi.price_once, 0),
    COALESCE(pi.sort_order, 999),
    COALESCE(pi.is_ready, false),
    COALESCE(pi.requires_api_keys, false),
    COALESCE(pi.api_key_label, ''),
    COALESCE(pi.trial_days, 0),
    COALESCE(pi.has_service, false),
    COALESCE(pi.has_api_client, false),
    COALESCE(pi.has_test_connection, false),
    COALESCE(tpi.status, 'none'),
    tpi.activation_source,
    (tpi.api_secret_encrypted IS NOT NULL) AS has_secret_configured,
    v_ent_allowed,
    v_ent_reason,
    (v_ent_allowed AND COALESCE(pi.is_ready, false))
  FROM paid_integrations pi
  LEFT JOIN tenant_paid_integrations tpi
         ON tpi.integration_id = pi.id
        AND tpi.tenant_id      = p_tenant_id
  WHERE pi.is_listed = true
  ORDER BY COALESCE(pi.sort_order, 999), pi.name_ar;
END;
$$;
