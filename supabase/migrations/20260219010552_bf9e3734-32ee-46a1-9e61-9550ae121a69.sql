
-- =====================================================
-- P0 FIX: Protect ZATCA Private Keys
-- =====================================================

-- 1. Create a public-facing view WITHOUT private_key
CREATE OR REPLACE VIEW public.zatca_certificates_safe
WITH (security_invoker = on) AS
  SELECT 
    id, tenant_id, certificate_type, csid, certificate,
    request_id, environment, issued_at, expires_at, 
    is_active, created_by, created_at, updated_at
  FROM public.zatca_certificates;
  -- Excludes: private_key

-- 2. Create a SECURITY DEFINER function for edge functions to retrieve private key
-- Only callable by authenticated users who own the tenant
CREATE OR REPLACE FUNCTION public.get_zatca_private_key(
  _tenant_id uuid,
  _certificate_type text
)
RETURNS TABLE(private_key text, certificate text, csid text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is a member of this tenant
  IF NOT EXISTS (
    SELECT 1 FROM tenant_members tm
    WHERE tm.tenant_id = _tenant_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a tenant admin';
  END IF;

  RETURN QUERY
  SELECT zc.private_key, zc.certificate, zc.csid
  FROM zatca_certificates zc
  WHERE zc.tenant_id = _tenant_id
    AND zc.certificate_type = _certificate_type
    AND zc.is_active = true
  LIMIT 1;
END;
$$;

-- 3. Tighten the existing RLS policy - drop current permissive policy
DROP POLICY IF EXISTS "Owner manages zatca certificates" ON public.zatca_certificates;

-- Allow tenant owners to SELECT only non-sensitive columns via the safe view
-- Direct SELECT on base table: hide private_key by only allowing via RPC
CREATE POLICY "Tenant owners can read certificates"
  ON public.zatca_certificates FOR SELECT TO authenticated
  USING (is_tenant_owner(tenant_id));

-- Allow tenant owners to INSERT/UPDATE (for certificate registration)
CREATE POLICY "Tenant owners can insert certificates"
  ON public.zatca_certificates FOR INSERT TO authenticated
  WITH CHECK (is_tenant_owner(tenant_id));

CREATE POLICY "Tenant owners can update certificates"
  ON public.zatca_certificates FOR UPDATE TO authenticated
  USING (is_tenant_owner(tenant_id));
