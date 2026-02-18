
-- 1) Sequential ICV counter per tenant
CREATE TABLE IF NOT EXISTS public.zatca_icv_counter (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  last_icv BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id)
);

ALTER TABLE public.zatca_icv_counter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read their ICV counter"
ON public.zatca_icv_counter FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant members can update their ICV counter"
ON public.zatca_icv_counter FOR ALL
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Function to get next ICV atomically
CREATE OR REPLACE FUNCTION public.get_next_icv(_tenant_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next_icv BIGINT;
BEGIN
  INSERT INTO zatca_icv_counter (tenant_id, last_icv, updated_at)
  VALUES (_tenant_id, 1, now())
  ON CONFLICT (tenant_id)
  DO UPDATE SET last_icv = zatca_icv_counter.last_icv + 1, updated_at = now()
  RETURNING last_icv INTO _next_icv;
  
  RETURN _next_icv;
END;
$$;

-- 2) Compliance enforcement trigger: prevent posting invoices without active ZATCA cert
CREATE OR REPLACE FUNCTION public.enforce_zatca_compliance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_zatca_phase2 BOOLEAN;
  _has_active_cert BOOLEAN;
BEGIN
  -- Only enforce on status change to 'posted' or 'approved'
  IF NEW.status NOT IN ('posted', 'approved') THEN
    RETURN NEW;
  END IF;
  
  -- Check if tenant has ZATCA Phase 2 enabled
  SELECT zatca_phase2_ready INTO _tenant_zatca_phase2
  FROM tenants WHERE id = NEW.tenant_id;
  
  -- If ZATCA not enabled, skip enforcement
  IF NOT COALESCE(_tenant_zatca_phase2, FALSE) THEN
    RETURN NEW;
  END IF;
  
  -- Check for active compliance or production certificate
  SELECT EXISTS(
    SELECT 1 FROM zatca_certificates
    WHERE tenant_id = NEW.tenant_id
    AND is_active = TRUE
    AND certificate_type IN ('compliance', 'production')
  ) INTO _has_active_cert;
  
  IF NOT _has_active_cert THEN
    RAISE EXCEPTION 'لا يمكن اعتماد الفاتورة بدون شهادة ZATCA فعّالة. يرجى إعداد شهادة الامتثال أولاً من صفحة الإعدادات.';
  END IF;
  
  -- Auto-assign UUID if missing
  IF NEW.invoice_uuid IS NULL THEN
    NEW.invoice_uuid := gen_random_uuid()::TEXT;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop if exists to avoid conflicts
DROP TRIGGER IF EXISTS enforce_zatca_compliance_trigger ON public.invoices;

CREATE TRIGGER enforce_zatca_compliance_trigger
BEFORE UPDATE ON public.invoices
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.enforce_zatca_compliance();

-- 3) Add digital_signature column to zatca_submission_log for audit
ALTER TABLE public.zatca_submission_log 
ADD COLUMN IF NOT EXISTS signed_xml TEXT,
ADD COLUMN IF NOT EXISTS digital_signature TEXT,
ADD COLUMN IF NOT EXISTS certificate_used TEXT;
