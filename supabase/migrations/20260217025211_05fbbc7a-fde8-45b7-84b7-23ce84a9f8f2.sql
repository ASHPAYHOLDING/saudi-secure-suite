
-- Create kyc-documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('kyc-documents', 'kyc-documents', false, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their tenant folder
CREATE POLICY "Tenant users can upload KYC docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT t.id::text FROM public.tenant_members tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.user_id = auth.uid()
  )
);

-- Allow authenticated users to read their tenant's KYC docs
CREATE POLICY "Tenant users can read KYC docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT t.id::text FROM public.tenant_members tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.user_id = auth.uid()
  )
);

-- Allow platform admins to read all KYC docs
CREATE POLICY "Platform admins can read all KYC docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);
