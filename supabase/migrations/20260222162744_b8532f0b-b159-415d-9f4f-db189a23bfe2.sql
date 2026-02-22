-- Allow anonymous users to view active subscription plans (for landing page pricing)
CREATE POLICY "Anyone can view active plans"
ON public.subscription_plans
FOR SELECT
USING (is_active = true);
