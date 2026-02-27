
-- CSP Reports table for monitoring Content-Security-Policy violations
CREATE TABLE public.csp_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  violated_directive text NOT NULL,
  blocked_uri text,
  document_uri text,
  source_file text,
  line_number integer,
  status_code integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.csp_reports ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert (from edge function) and select (for admin review)
CREATE POLICY "service_role_full_access" ON public.csp_reports
  FOR ALL USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- Platform admins can read via authenticated role
CREATE POLICY "platform_admins_can_read" ON public.csp_reports
  FOR SELECT USING (public.is_platform_admin());

-- Auto-cleanup: drop rows older than 30 days
CREATE INDEX idx_csp_reports_created_at ON public.csp_reports (created_at);
