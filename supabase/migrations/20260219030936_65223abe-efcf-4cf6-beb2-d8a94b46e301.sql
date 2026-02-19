
-- Step 1: Drop the plaintext private_key column permanently
ALTER TABLE public.zatca_certificates DROP COLUMN IF EXISTS private_key;

-- Step 2: Add a trigger to prevent any direct INSERT/UPDATE that puts plaintext in private_key_encrypted
-- (private_key_encrypted should ONLY be set via encrypt_zatca_private_key RPC)
CREATE OR REPLACE FUNCTION public.prevent_direct_key_write()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow only service_role (RPC calls) to set private_key_encrypted
  -- Check if the caller is using the encrypt_zatca_private_key function context
  IF TG_OP = 'INSERT' AND NEW.private_key_encrypted IS NOT NULL THEN
    -- Only service_role can write encrypted keys
    IF current_setting('role', true) != 'service_role' THEN
      RAISE EXCEPTION 'Direct private key writes are forbidden. Use the secure encryption RPC.';
    END IF;
  END IF;
  
  IF TG_OP = 'UPDATE' AND NEW.private_key_encrypted IS DISTINCT FROM OLD.private_key_encrypted THEN
    IF current_setting('role', true) != 'service_role' THEN
      RAISE EXCEPTION 'Direct private key writes are forbidden. Use the secure encryption RPC.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_prevent_direct_key_write
  BEFORE INSERT OR UPDATE ON public.zatca_certificates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_key_write();

-- Step 3: Update RLS — remove direct SELECT on zatca_certificates for non-service users
-- Drop existing read policy that exposes all columns
DROP POLICY IF EXISTS "Tenant owners can read certificates" ON public.zatca_certificates;

-- Recreate a restrictive SELECT policy that only allows reading through the safe view
-- The safe view is SECURITY INVOKER so it respects RLS, but we block direct table reads
-- Instead, we allow SELECT but ONLY on specific columns via the safe view
-- Actually, since the private_key column is now dropped, SELECT is safe again
-- But we still want to prevent reading private_key_encrypted (bytea) directly
-- Solution: revoke SELECT on private_key_encrypted from authenticated role
REVOKE ALL ON public.zatca_certificates FROM authenticated;
GRANT SELECT (id, tenant_id, certificate_type, csid, certificate, request_id, environment, issued_at, expires_at, is_active, created_by, created_at, updated_at, private_key_kid) ON public.zatca_certificates TO authenticated;
GRANT INSERT, UPDATE ON public.zatca_certificates TO authenticated;

-- Recreate the read policy
CREATE POLICY "Tenant owners can read certificates" ON public.zatca_certificates
  FOR SELECT USING (is_tenant_owner(tenant_id));

-- Step 4: Recreate safe view without the dropped column
DROP VIEW IF EXISTS public.zatca_certificates_safe;
CREATE VIEW public.zatca_certificates_safe 
  WITH (security_invoker = true)
AS
SELECT 
  id,
  tenant_id,
  certificate_type,
  csid,
  certificate,
  request_id,
  environment,
  issued_at,
  expires_at,
  is_active,
  created_by,
  created_at,
  updated_at,
  (private_key_encrypted IS NOT NULL) AS is_key_encrypted,
  private_key_kid,
  CASE 
    WHEN NOT is_active THEN 'inactive'
    WHEN expires_at IS NOT NULL AND expires_at < now() THEN 'expired'
    WHEN private_key_encrypted IS NULL THEN 'missing_key'
    ELSE 'active'
  END AS key_status
FROM zatca_certificates;
