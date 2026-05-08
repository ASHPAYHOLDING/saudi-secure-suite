-- Allow platform admins to read the email send log for monitoring purposes
CREATE POLICY "Platform admins can read send log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid()
  )
);

-- Helpful indexes for dashboard filters
CREATE INDEX IF NOT EXISTS idx_email_send_log_created_at ON public.email_send_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_message_id ON public.email_send_log (message_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_status ON public.email_send_log (status);
CREATE INDEX IF NOT EXISTS idx_email_send_log_template ON public.email_send_log (template_name);