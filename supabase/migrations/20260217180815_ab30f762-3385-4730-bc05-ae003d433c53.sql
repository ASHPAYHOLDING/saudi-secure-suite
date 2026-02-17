
-- Fix: Replace overly permissive "Service role manages tokens" with proper policy
-- Service role bypasses RLS anyway, so we need a policy for trigger-based inserts
DROP POLICY "Service role manages tokens" ON public.document_access_tokens;

-- Allow inserts from authenticated users and triggers (SECURITY DEFINER functions)
CREATE POLICY "Authenticated users create tokens"
  ON public.document_access_tokens FOR INSERT
  WITH CHECK (
    public.is_tenant_member(tenant_id)
    OR public.is_platform_admin()
  );

-- Allow updates (for access_count increment) via SECURITY DEFINER functions
-- The validate_document_token function runs as SECURITY DEFINER so it bypasses RLS
CREATE POLICY "Tenant members update own tokens"
  ON public.document_access_tokens FOR UPDATE
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins delete tokens"
  ON public.document_access_tokens FOR DELETE
  USING (public.is_tenant_admin(tenant_id));
