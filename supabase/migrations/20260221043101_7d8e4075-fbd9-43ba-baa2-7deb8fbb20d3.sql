
-- Fix: Replace SECURITY DEFINER view with SECURITY INVOKER
CREATE OR REPLACE VIEW public.tenant_region_stats
WITH (security_invoker = true)
AS
SELECT 
  region::text,
  COUNT(*) AS tenant_count,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM subscriptions s WHERE s.tenant_id = t.id AND s.status = 'active'
  )) AS active_subscriptions
FROM tenants t
GROUP BY region;
