
-- Drop duplicate/conflicting policies
DROP POLICY IF EXISTS "Tenant users can upload KYC docs" ON storage.objects;
DROP POLICY IF EXISTS "Tenant users can read KYC docs" ON storage.objects;
DROP POLICY IF EXISTS "Platform admins can read all KYC docs" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can upload KYC docs" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can view own KYC docs" ON storage.objects;
DROP POLICY IF EXISTS "Platform admins can view all KYC docs" ON storage.objects;

-- Update bucket settings
UPDATE storage.buckets 
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/jpg','image/png','image/webp']
WHERE id = 'kyc-documents';

-- Simple, permissive INSERT policy for authenticated users to this bucket
CREATE POLICY "kyc_upload_policy" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-documents');

-- Simple SELECT policy for authenticated users
CREATE POLICY "kyc_read_policy" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents');

-- UPDATE policy (needed for upsert)
CREATE POLICY "kyc_update_policy" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'kyc-documents');

-- DELETE policy
CREATE POLICY "kyc_delete_policy" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'kyc-documents');
