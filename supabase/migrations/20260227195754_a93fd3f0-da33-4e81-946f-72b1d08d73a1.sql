
-- ============================================================
-- Storage Cross-Tenant Isolation Hardening Migration
-- Idempotent: safe to run multiple times
-- ============================================================

-- A) Helper function: is_tenant_member_by_path
CREATE OR REPLACE FUNCTION public.is_tenant_member_by_path(file_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  folder_part text;
  tenant_uuid uuid;
BEGIN
  folder_part := split_part(file_path, '/', 1);
  IF folder_part IS NULL OR folder_part = '' THEN RETURN false; END IF;
  BEGIN
    tenant_uuid := folder_part::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_uuid AND tm.user_id = auth.uid()
  );
END;
$$;

-- Helper: is_tenant_owner_or_admin_by_path
CREATE OR REPLACE FUNCTION public.is_tenant_owner_or_admin_by_path(file_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  folder_part text;
  tenant_uuid uuid;
BEGIN
  folder_part := split_part(file_path, '/', 1);
  IF folder_part IS NULL OR folder_part = '' THEN RETURN false; END IF;
  BEGIN
    tenant_uuid := folder_part::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_uuid
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
  );
END;
$$;

-- Helper: is_hr_or_owner_admin_by_path
CREATE OR REPLACE FUNCTION public.is_hr_or_owner_admin_by_path(file_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  folder_part text;
  tenant_uuid uuid;
BEGIN
  folder_part := split_part(file_path, '/', 1);
  IF folder_part IS NULL OR folder_part = '' THEN RETURN false; END IF;
  BEGIN
    tenant_uuid := folder_part::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_uuid
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin', 'hr')
  );
END;
$$;

-- Helper: has_finance_permission_by_path
CREATE OR REPLACE FUNCTION public.has_finance_permission_by_path(file_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  folder_part text;
  tenant_uuid uuid;
BEGIN
  folder_part := split_part(file_path, '/', 1);
  IF folder_part IS NULL OR folder_part = '' THEN RETURN false; END IF;
  BEGIN
    tenant_uuid := folder_part::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN (
    public.has_permission(tenant_uuid, 'wallet.view')
    OR public.has_permission(tenant_uuid, 'finance.view_overview')
  );
END;
$$;

-- Helper: has_supplier_permission_by_path
CREATE OR REPLACE FUNCTION public.has_supplier_permission_by_path(file_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  folder_part text;
  tenant_uuid uuid;
BEGIN
  folder_part := split_part(file_path, '/', 1);
  IF folder_part IS NULL OR folder_part = '' THEN RETURN false; END IF;
  BEGIN
    tenant_uuid := folder_part::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN (
    public.has_permission(tenant_uuid, 'suppliers.view')
    OR public.has_permission(tenant_uuid, 'invoices.view')
  );
END;
$$;

-- ============================================================
-- DROP ALL existing policies on target buckets
-- ============================================================
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        policyname ILIKE '%hr-documents%'
        OR policyname ILIKE '%hr_documents%'
        OR policyname ILIKE '%expense-receipts%'
        OR policyname ILIKE '%expense_receipts%'
        OR policyname ILIKE '%wallet-receipts%'
        OR policyname ILIKE '%wallet_receipts%'
        OR policyname ILIKE '%supplier-invoices%'
        OR policyname ILIKE '%supplier_invoices%'
        OR policyname ILIKE '%ocr-uploads%'
        OR policyname ILIKE '%ocr_uploads%'
        OR policyname ILIKE '%collaboration-attachments%'
        OR policyname ILIKE '%collaboration_attachments%'
        OR policyname ILIKE '%tenant-stamps%'
        OR policyname ILIKE '%tenant_stamps%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END;
$$;

-- ============================================================
-- 1) hr-documents (Private) — HR/Owner/Admin only
-- ============================================================
CREATE POLICY "hr_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'hr-documents' AND public.is_hr_or_owner_admin_by_path(name));

CREATE POLICY "hr_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hr-documents' AND public.is_hr_or_owner_admin_by_path(name));

CREATE POLICY "hr_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'hr-documents' AND public.is_hr_or_owner_admin_by_path(name))
  WITH CHECK (bucket_id = 'hr-documents' AND public.is_hr_or_owner_admin_by_path(name));

CREATE POLICY "hr_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'hr-documents' AND public.is_tenant_owner_or_admin_by_path(name));

-- ============================================================
-- 2) expense-receipts (Private) — tenant member
-- ============================================================
CREATE POLICY "expense_receipts_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'expense-receipts' AND public.is_tenant_member_by_path(name));

CREATE POLICY "expense_receipts_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-receipts' AND public.is_tenant_member_by_path(name));

CREATE POLICY "expense_receipts_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'expense-receipts' AND public.is_tenant_member_by_path(name))
  WITH CHECK (bucket_id = 'expense-receipts' AND public.is_tenant_member_by_path(name));

CREATE POLICY "expense_receipts_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'expense-receipts' AND public.is_tenant_owner_or_admin_by_path(name));

-- ============================================================
-- 3) wallet-receipts (Private) — finance permission
-- ============================================================
CREATE POLICY "wallet_receipts_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'wallet-receipts' AND public.has_finance_permission_by_path(name));

CREATE POLICY "wallet_receipts_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wallet-receipts' AND public.has_finance_permission_by_path(name));

CREATE POLICY "wallet_receipts_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'wallet-receipts' AND public.has_finance_permission_by_path(name))
  WITH CHECK (bucket_id = 'wallet-receipts' AND public.has_finance_permission_by_path(name));

CREATE POLICY "wallet_receipts_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'wallet-receipts' AND public.is_tenant_owner_or_admin_by_path(name));

-- ============================================================
-- 4) supplier-invoices (Private) — supplier/invoice permission
-- ============================================================
CREATE POLICY "supplier_invoices_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'supplier-invoices' AND public.has_supplier_permission_by_path(name));

CREATE POLICY "supplier_invoices_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'supplier-invoices' AND public.has_supplier_permission_by_path(name));

CREATE POLICY "supplier_invoices_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'supplier-invoices' AND public.has_supplier_permission_by_path(name))
  WITH CHECK (bucket_id = 'supplier-invoices' AND public.has_supplier_permission_by_path(name));

CREATE POLICY "supplier_invoices_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'supplier-invoices' AND public.is_tenant_owner_or_admin_by_path(name));

-- ============================================================
-- 5) ocr-uploads (Private) — tenant member + Owner/Admin delete
-- ============================================================
CREATE POLICY "ocr_uploads_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ocr-uploads' AND public.is_tenant_member_by_path(name));

CREATE POLICY "ocr_uploads_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ocr-uploads' AND public.is_tenant_member_by_path(name));

CREATE POLICY "ocr_uploads_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ocr-uploads' AND public.is_tenant_member_by_path(name))
  WITH CHECK (bucket_id = 'ocr-uploads' AND public.is_tenant_member_by_path(name));

CREATE POLICY "ocr_uploads_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ocr-uploads' AND public.is_tenant_owner_or_admin_by_path(name));

-- ============================================================
-- 6) collaboration-attachments (Private) — tenant member + Owner/Admin delete
-- ============================================================
CREATE POLICY "collab_attach_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'collaboration-attachments' AND public.is_tenant_member_by_path(name));

CREATE POLICY "collab_attach_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'collaboration-attachments' AND public.is_tenant_member_by_path(name));

CREATE POLICY "collab_attach_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'collaboration-attachments' AND public.is_tenant_member_by_path(name))
  WITH CHECK (bucket_id = 'collaboration-attachments' AND public.is_tenant_member_by_path(name));

CREATE POLICY "collab_attach_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'collaboration-attachments' AND public.is_tenant_owner_or_admin_by_path(name));

-- ============================================================
-- 7) tenant-stamps (Public READ, restricted WRITE)
-- ============================================================
CREATE POLICY "tenant_stamps_select_public" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'tenant-stamps');

CREATE POLICY "tenant_stamps_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenant-stamps' AND public.is_tenant_owner_or_admin_by_path(name));

CREATE POLICY "tenant_stamps_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tenant-stamps' AND public.is_tenant_owner_or_admin_by_path(name))
  WITH CHECK (bucket_id = 'tenant-stamps' AND public.is_tenant_owner_or_admin_by_path(name));

CREATE POLICY "tenant_stamps_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tenant-stamps' AND public.is_tenant_owner_or_admin_by_path(name));
