
-- Fix: Restrict email_template_definitions to authenticated only
DROP POLICY IF EXISTS "Authenticated users can read active definitions" ON public.email_template_definitions;
CREATE POLICY "Authenticated users can read active definitions"
  ON public.email_template_definitions
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Fix: Restrict email_template_versions to authenticated only
DROP POLICY IF EXISTS "Authenticated users can read versions" ON public.email_template_versions;
CREATE POLICY "Authenticated users can read versions"
  ON public.email_template_versions
  FOR SELECT
  TO authenticated
  USING (true);
