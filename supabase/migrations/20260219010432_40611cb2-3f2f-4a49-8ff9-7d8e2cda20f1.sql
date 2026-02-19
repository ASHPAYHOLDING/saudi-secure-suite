
-- =====================================================
-- P0 FIX: KYC Storage Tenant Isolation
-- Drop overly permissive policies and replace with tenant-scoped ones
-- =====================================================

-- Drop all existing permissive policies
DROP POLICY IF EXISTS "kyc_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "kyc_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "kyc_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "kyc_delete_policy" ON storage.objects;

-- Tenant members can only upload to their own tenant folder
CREATE POLICY "Tenant members upload own KYC"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT tm.tenant_id::text FROM tenant_members tm WHERE tm.user_id = auth.uid()
  )
);

-- Tenant members can only read their own tenant's KYC documents
CREATE POLICY "Tenant members read own KYC"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (
    -- Tenant member accessing own folder
    (storage.foldername(name))[1] IN (
      SELECT tm.tenant_id::text FROM tenant_members tm WHERE tm.user_id = auth.uid()
    )
    OR
    -- Platform admins can read all for review
    is_platform_admin()
  )
);

-- Only tenant owner/admin can update KYC documents
CREATE POLICY "Tenant admins update own KYC"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT tm.tenant_id::text FROM tenant_members tm
    WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  )
);

-- Only platform admins can delete KYC documents
CREATE POLICY "Platform admins delete KYC"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND is_platform_admin()
);
