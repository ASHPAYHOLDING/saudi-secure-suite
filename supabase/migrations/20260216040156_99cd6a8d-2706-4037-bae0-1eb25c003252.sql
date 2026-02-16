
-- Add ZATCA/VAT compliance flags to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS vat_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_percentage numeric NOT NULL DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS zatca_phase1_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS zatca_phase2_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS zatca_integration_id text,
  ADD COLUMN IF NOT EXISTS compliance_verified_at timestamptz;

-- Ensure invoices cannot have 0% VAT when tenant is VAT-registered
-- We use a trigger instead of CHECK constraint for flexibility
CREATE OR REPLACE FUNCTION public.enforce_vat_compliance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _vat_registered boolean;
  _vat_percentage numeric;
BEGIN
  SELECT vat_registered, vat_percentage
  INTO _vat_registered, _vat_percentage
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  -- If tenant is VAT registered, invoices must have correct VAT
  IF _vat_registered AND NEW.vat_total <= 0 AND NEW.subtotal > 0 THEN
    RAISE EXCEPTION 'VAT-registered tenants must include VAT on invoices (هيئة الزكاة: يجب تضمين ضريبة القيمة المضافة)';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_vat_compliance
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_vat_compliance();

-- Enforce CR number requirement for ZATCA Phase 1
CREATE OR REPLACE FUNCTION public.enforce_zatca_phase1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _zatca boolean;
  _cr text;
  _vat_num text;
BEGIN
  SELECT zatca_phase1_enabled, cr_number, vat_number
  INTO _zatca, _cr, _vat_num
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  IF _zatca THEN
    IF _cr IS NULL OR _cr = '' THEN
      RAISE EXCEPTION 'ZATCA Phase 1 requires a Commercial Registration number (يتطلب رقم السجل التجاري)';
    END IF;
    IF _vat_num IS NULL OR _vat_num = '' THEN
      RAISE EXCEPTION 'ZATCA Phase 1 requires a VAT number (يتطلب الرقم الضريبي)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_zatca_phase1
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_zatca_phase1();
