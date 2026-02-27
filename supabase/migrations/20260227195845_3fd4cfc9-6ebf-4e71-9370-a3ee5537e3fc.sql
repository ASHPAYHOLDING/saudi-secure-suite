
-- Remove remaining old insecure policies
DROP POLICY IF EXISTS "HR docs delete" ON storage.objects;
DROP POLICY IF EXISTS "HR docs upload" ON storage.objects;
DROP POLICY IF EXISTS "HR docs view" ON storage.objects;
DROP POLICY IF EXISTS "Members can delete own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Members can view own tenant receipts" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can view own OCR files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can view their receipts" ON storage.objects;

-- Also drop any other old permissive policies on these buckets
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, qual
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND qual LIKE '%auth.uid() IS NOT NULL%'
      AND (
        qual LIKE '%hr-documents%' OR qual LIKE '%expense-receipts%'
        OR qual LIKE '%wallet-receipts%' OR qual LIKE '%supplier-invoices%'
        OR qual LIKE '%ocr-uploads%' OR qual LIKE '%collaboration-attachments%'
        OR qual LIKE '%tenant-stamps%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END;
$$;
