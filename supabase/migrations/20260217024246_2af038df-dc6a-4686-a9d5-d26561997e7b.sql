
-- KYC verification requests for Numaxio Pay activation
CREATE TABLE public.paylink_kyc_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Applicant info
  applicant_type TEXT NOT NULL DEFAULT 'company' CHECK (applicant_type IN ('company', 'freelancer', 'individual')),
  business_name TEXT NOT NULL,
  business_name_en TEXT,
  cr_number TEXT, -- Commercial Registration (for company/freelancer)
  vat_number TEXT,
  national_id TEXT, -- For individuals
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  iban TEXT NOT NULL,
  bank_name TEXT,
  
  -- Agreement
  agreement_html TEXT NOT NULL, -- Snapshot of the signed agreement
  agreement_version TEXT NOT NULL DEFAULT '1.0',
  
  -- E-Signature (subscriber)
  subscriber_signature_data TEXT, -- Base64 signature image
  subscriber_signed_at TIMESTAMPTZ,
  subscriber_signed_ip TEXT,
  subscriber_user_id UUID NOT NULL,
  subscriber_full_name TEXT NOT NULL,
  
  -- E-Signature (admin)
  admin_signature_data TEXT,
  admin_signed_at TIMESTAMPTZ,
  admin_signed_ip TEXT,
  admin_user_id UUID,
  admin_full_name TEXT,
  
  -- Verification
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'requires_update')),
  rejection_reason TEXT,
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  
  -- Unique contract reference
  contract_number TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KYC documents (attachments)
CREATE TABLE public.paylink_kyc_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kyc_request_id UUID NOT NULL REFERENCES public.paylink_kyc_requests(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('cr_certificate', 'vat_certificate', 'national_id', 'bank_letter', 'freelancer_certificate', 'authorization_letter', 'other')),
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.paylink_kyc_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paylink_kyc_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kyc_requests
CREATE POLICY "Tenant members can view own KYC" ON public.paylink_kyc_requests
  FOR SELECT USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can insert KYC" ON public.paylink_kyc_requests
  FOR INSERT WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "Platform admins can view all KYC" ON public.paylink_kyc_requests
  FOR SELECT USING (public.is_platform_admin());

CREATE POLICY "Platform admins can update KYC" ON public.paylink_kyc_requests
  FOR UPDATE USING (public.is_platform_admin());

-- RLS Policies for kyc_documents
CREATE POLICY "Tenant members can view own docs" ON public.paylink_kyc_documents
  FOR SELECT USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can insert docs" ON public.paylink_kyc_documents
  FOR INSERT WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "Platform admins can view all docs" ON public.paylink_kyc_documents
  FOR SELECT USING (public.is_platform_admin());

-- Storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false);

CREATE POLICY "Tenant members can upload KYC docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant members can view own KYC docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'kyc-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Platform admins can view all KYC docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'kyc-documents' AND public.is_platform_admin());

-- Triggers
CREATE TRIGGER update_paylink_kyc_updated_at
  BEFORE UPDATE ON public.paylink_kyc_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-activate paylink on admin approval
CREATE OR REPLACE FUNCTION public.handle_kyc_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    UPDATE public.tenants
    SET paylink_enabled = true,
        paylink_enabled_at = now()
    WHERE id = NEW.tenant_id;
    
    -- Create platform notification
    INSERT INTO public.platform_notifications (type, title, message, entity_id)
    VALUES ('kyc_approved', 'تم اعتماد طلب KYC', 'تم اعتماد طلب تفعيل بوابة الدفع للمنشأة: ' || NEW.business_name, NEW.tenant_id);
  END IF;
  
  IF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
    INSERT INTO public.platform_notifications (type, title, message, entity_id)
    VALUES ('kyc_rejected', 'تم رفض طلب KYC', 'تم رفض طلب تفعيل بوابة الدفع: ' || NEW.business_name || ' - السبب: ' || COALESCE(NEW.rejection_reason, 'غير محدد'), NEW.tenant_id);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_kyc_approval
  AFTER UPDATE ON public.paylink_kyc_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_kyc_approval();
