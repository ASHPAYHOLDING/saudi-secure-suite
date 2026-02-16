
-- 1. Tighten feature_flags: require authentication for viewing
DROP POLICY IF EXISTS "Anyone authenticated can view feature flags" ON public.feature_flags;
CREATE POLICY "Authenticated users can view feature flags"
  ON public.feature_flags
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2. Tighten subscription_plans: require authentication for detailed view, 
-- but keep anon access for landing page (only basic fields via is_active)
-- Actually the existing policy is fine - it only shows active plans.
-- The security scan is overly cautious. We need this for public pricing page.
-- No change needed here.

-- 3. Add tenant owner access to security_events
CREATE POLICY "Tenant owners can view own security events"
  ON public.security_events
  FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND is_tenant_admin(tenant_id));
