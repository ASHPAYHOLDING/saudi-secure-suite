-- Add enterprise_mode entitlement to Enterprise plan
INSERT INTO plan_entitlements (plan_id, feature_key, is_enabled, limit_value)
VALUES ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'enterprise_mode', true, NULL)
ON CONFLICT DO NOTHING;

-- Rebuild entitlements cache for all tenants with enterprise plan
DO $$
DECLARE
  _tenant_id uuid;
BEGIN
  FOR _tenant_id IN
    SELECT DISTINCT s.tenant_id 
    FROM subscriptions s 
    WHERE s.plan_id = '8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f' 
      AND s.status IN ('active', 'trial', 'past_due')
      AND s.deleted_at IS NULL
  LOOP
    PERFORM rebuild_tenant_entitlements_cache(_tenant_id);
  END LOOP;
END $$;