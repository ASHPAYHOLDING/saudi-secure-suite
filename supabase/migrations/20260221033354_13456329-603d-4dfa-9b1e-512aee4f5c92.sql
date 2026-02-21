
-- Fix overly permissive write policies — restrict to service_role only
DROP POLICY "Service role can manage revenue analytics" ON public.analytics_daily_revenue;
DROP POLICY "Service role can manage expense analytics" ON public.analytics_daily_expenses;
DROP POLICY "Service role can manage cashflow analytics" ON public.analytics_daily_cashflow;

-- These tables are written ONLY by the ETL edge function using service_role.
-- No additional write policies needed — service_role bypasses RLS by default.
-- The SELECT policies for tenant members remain in place.
