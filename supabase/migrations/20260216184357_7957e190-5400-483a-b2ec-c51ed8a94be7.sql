
-- Add ZATCA Phase 2 fields to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_uuid uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS invoice_hash text,
  ADD COLUMN IF NOT EXISTS previous_invoice_hash text,
  ADD COLUMN IF NOT EXISTS zatca_xml text,
  ADD COLUMN IF NOT EXISTS zatca_signed_xml text,
  ADD COLUMN IF NOT EXISTS zatca_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS zatca_clearance_status text,
  ADD COLUMN IF NOT EXISTS zatca_reporting_status text,
  ADD COLUMN IF NOT EXISTS zatca_warnings jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS zatca_errors jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS zatca_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS zatca_response jsonb;

-- Add ZATCA credential fields to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS zatca_environment text DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS zatca_otp text,
  ADD COLUMN IF NOT EXISTS zatca_compliance_csid text,
  ADD COLUMN IF NOT EXISTS zatca_production_csid text,
  ADD COLUMN IF NOT EXISTS zatca_request_id text;

-- Index for ZATCA status queries
CREATE INDEX IF NOT EXISTS idx_invoices_zatca_status ON public.invoices(zatca_status) WHERE zatca_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_uuid ON public.invoices(invoice_uuid);

-- Ensure all existing invoices have a UUID
UPDATE public.invoices SET invoice_uuid = gen_random_uuid() WHERE invoice_uuid IS NULL;
