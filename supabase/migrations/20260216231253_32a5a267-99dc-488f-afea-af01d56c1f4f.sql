
-- Storage bucket for supplier invoice files
INSERT INTO storage.buckets (id, name, public) VALUES ('supplier-invoices', 'supplier-invoices', false);

-- Storage policies
CREATE POLICY "Tenant members can upload supplier invoices"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'supplier-invoices'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Tenant members can view supplier invoices"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'supplier-invoices'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Tenant members can delete supplier invoices"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'supplier-invoices'
  AND auth.uid() IS NOT NULL
);

-- Supplier invoice inbox table
CREATE TABLE public.supplier_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  uploaded_by UUID NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER DEFAULT 0,
  
  -- OCR extracted data
  ocr_status TEXT NOT NULL DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
  ocr_data JSONB,
  ocr_error TEXT,
  
  -- Invoice data (from OCR or manual entry)
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  subtotal NUMERIC DEFAULT 0,
  vat_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'SAR',
  supplier_name TEXT,
  supplier_vat_number TEXT,
  description TEXT,
  
  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'reviewed', 'approved', 'rejected', 'converted')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  converted_expense_id UUID REFERENCES public.expenses(id),
  
  -- Spam protection
  is_spam BOOLEAN DEFAULT false,
  spam_score NUMERIC DEFAULT 0,
  
  branch_id UUID REFERENCES public.branches(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant members can view supplier invoices"
ON public.supplier_invoices FOR SELECT
USING (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can insert supplier invoices"
ON public.supplier_invoices FOR INSERT
WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY "Finance authorized can update supplier invoices"
ON public.supplier_invoices FOR UPDATE
USING (is_authorized_finance(tenant_id));

CREATE POLICY "Admins can delete supplier invoices"
ON public.supplier_invoices FOR DELETE
USING (is_tenant_admin(tenant_id));

-- Indexes
CREATE INDEX idx_supplier_invoices_tenant ON public.supplier_invoices(tenant_id);
CREATE INDEX idx_supplier_invoices_status ON public.supplier_invoices(tenant_id, status);
CREATE INDEX idx_supplier_invoices_ocr ON public.supplier_invoices(tenant_id, ocr_status);

-- Update trigger
CREATE TRIGGER update_supplier_invoices_updated_at
BEFORE UPDATE ON public.supplier_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger
CREATE OR REPLACE FUNCTION public.audit_supplier_invoice_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (NEW.tenant_id, NEW.uploaded_by, 'create', 'supplier_invoice', NEW.id, NEW.file_name);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      NEW.tenant_id, COALESCE(auth.uid(), NEW.uploaded_by),
      CASE
        WHEN OLD.status <> NEW.status AND NEW.status = 'approved' THEN 'approve'
        WHEN OLD.status <> NEW.status AND NEW.status = 'rejected' THEN 'reject'
        WHEN OLD.ocr_status <> NEW.ocr_status THEN 'ocr_process'
        ELSE 'update'
      END,
      'supplier_invoice', NEW.id, COALESCE(NEW.invoice_number, NEW.file_name),
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_supplier_invoice_trigger
AFTER INSERT OR UPDATE ON public.supplier_invoices
FOR EACH ROW EXECUTE FUNCTION public.audit_supplier_invoice_changes();
