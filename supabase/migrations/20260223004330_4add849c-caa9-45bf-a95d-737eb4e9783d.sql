
-- Fix overly permissive policies: restrict INSERT/UPDATE to service_role only
-- hr_document_alerts
DROP POLICY IF EXISTS "Service role insert" ON public.hr_document_alerts;
DROP POLICY IF EXISTS "Service role update" ON public.hr_document_alerts;

-- Only service_role (via edge function) can insert/update alerts
-- RLS is bypassed for service_role, so we create restrictive policies for anon/authenticated
CREATE POLICY "No direct insert by users"
  ON public.hr_document_alerts FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct update by users"
  ON public.hr_document_alerts FOR UPDATE
  USING (false);

-- user_notifications
DROP POLICY IF EXISTS "Service role insert notifications" ON public.user_notifications;

CREATE POLICY "No direct insert by users"
  ON public.user_notifications FOR INSERT
  WITH CHECK (false);
