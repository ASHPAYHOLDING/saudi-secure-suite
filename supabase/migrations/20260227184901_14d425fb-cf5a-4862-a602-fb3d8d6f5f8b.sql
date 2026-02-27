
-- ============================================================
-- Harden KYC Storage Policies
-- Drop all existing kyc-documents policies and replace with
-- strict role-based (owner, hr, admin, platform_admin) access
-- ============================================================

-- 1. Drop existing policies
DROP POLICY IF EXISTS "Platform admins delete KYC" ON storage.objects;
DROP POLICY IF EXISTS "Tenant admins update own KYC" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members read own KYC" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members upload own KYC" ON storage.objects;

-- 2. Helper: check if user has owner/hr/admin role in a given tenant
CREATE OR REPLACE FUNCTION public.has_kyc_access(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin', 'hr')
  )
  OR public.is_platform_admin();
$$;

-- 3. SELECT: only owner/hr/admin of same tenant, or platform_admin
CREATE POLICY "kyc_select_by_role"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (
    public.has_kyc_access( (split_part(name, '/', 1))::uuid )
  )
);

-- 4. INSERT: only owner/hr/admin can upload to their tenant folder
CREATE POLICY "kyc_insert_by_role"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND public.has_kyc_access( (split_part(name, '/', 1))::uuid )
);

-- 5. UPDATE: same restriction
CREATE POLICY "kyc_update_by_role"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND public.has_kyc_access( (split_part(name, '/', 1))::uuid )
);

-- 6. DELETE: platform_admin only
CREATE POLICY "kyc_delete_platform_admin_only"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND public.is_platform_admin()
);
