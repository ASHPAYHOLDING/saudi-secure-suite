-- Fix: Add SELECT policy on storage.buckets so authenticated users can access the kyc-documents bucket
CREATE POLICY "Allow authenticated to read kyc bucket" ON storage.buckets
FOR SELECT TO authenticated
USING (id = 'kyc-documents');
