
-- 1) Document types enum
DO $$ BEGIN
  CREATE TYPE public.employee_document_type AS ENUM (
    'national_id','passport','iqama','gosi_contract','work_contract',
    'medical_insurance','driving_license','degree_certificate',
    'training_certificate','bank_letter','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Employee documents table
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  document_type public.employee_document_type NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  title_en TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  issued_date DATE,
  expiry_date DATE,
  notes TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_tenant ON public.employee_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON public.employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_expiry ON public.employee_documents(expiry_date) WHERE expiry_date IS NOT NULL;

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_hr_doc_authorized(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = _tenant_id
      AND user_id = auth.uid()
  )
$$;

CREATE POLICY "Tenant members can view documents"
  ON public.employee_documents FOR SELECT
  USING (public.is_hr_doc_authorized(tenant_id));

CREATE POLICY "Tenant members can insert documents"
  ON public.employee_documents FOR INSERT
  WITH CHECK (public.is_hr_doc_authorized(tenant_id) AND uploaded_by = auth.uid());

CREATE POLICY "Tenant members can update documents"
  ON public.employee_documents FOR UPDATE
  USING (public.is_hr_doc_authorized(tenant_id));

CREATE POLICY "Tenant members can delete documents"
  ON public.employee_documents FOR DELETE
  USING (public.is_hr_doc_authorized(tenant_id));

CREATE TRIGGER update_employee_documents_updated_at
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-documents', 'hr-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "HR docs upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'hr-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "HR docs view"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hr-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "HR docs delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'hr-documents' AND auth.uid() IS NOT NULL);

-- Feature entitlements
INSERT INTO public.plan_entitlements (plan_id, feature_key, is_enabled, limit_value)
SELECT sp.id, 'hr_documents', true, 5
FROM public.subscription_plans sp WHERE sp.slug = 'business'
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key, is_enabled, limit_value)
SELECT sp.id, 'hr_documents', true, NULL
FROM public.subscription_plans sp WHERE sp.slug = 'enterprise'
ON CONFLICT DO NOTHING;
