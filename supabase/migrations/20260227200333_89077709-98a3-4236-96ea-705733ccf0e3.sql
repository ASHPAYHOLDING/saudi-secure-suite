
-- Remove 7 remaining insecure old policies
DROP POLICY IF EXISTS "Admins can delete stamps" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update stamps" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload stamps" ON storage.objects;
DROP POLICY IF EXISTS "Members can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can upload OCR files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can upload receipts" ON storage.objects;
-- Also remove old user-scoped DELETE policies (superseded by tenant-aware ones)
DROP POLICY IF EXISTS "Tenant members can delete own OCR files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;
