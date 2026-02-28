
-- Add missing columns for payment links feature
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  ADD COLUMN IF NOT EXISTS signature TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Make invoice_id nullable
ALTER TABLE public.payment_links ALTER COLUMN invoice_id DROP NOT NULL;

-- Update default status from 'pending' to 'created'
ALTER TABLE public.payment_links ALTER COLUMN status SET DEFAULT 'created';

-- Generate tokens for existing rows that have NULL tokens
UPDATE public.payment_links SET public_token = encode(gen_random_bytes(24), 'hex') WHERE public_token IS NULL;
UPDATE public.payment_links SET signature = encode(gen_random_bytes(16), 'hex') WHERE signature IS NULL;

-- Make public_token NOT NULL after populating
ALTER TABLE public.payment_links ALTER COLUMN public_token SET NOT NULL;
ALTER TABLE public.payment_links ALTER COLUMN signature SET NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_links_tenant ON public.payment_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON public.payment_links(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_links_token ON public.payment_links(public_token);

-- RLS policies
DROP POLICY IF EXISTS "Tenant members can view payment links" ON public.payment_links;
DROP POLICY IF EXISTS "Tenant members can create payment links" ON public.payment_links;
DROP POLICY IF EXISTS "Tenant members can update payment links" ON public.payment_links;
DROP POLICY IF EXISTS "Owner can delete payment links" ON public.payment_links;

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view payment links"
  ON public.payment_links FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can create payment links"
  ON public.payment_links FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can update payment links"
  ON public.payment_links FOR UPDATE
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Owner can delete payment links"
  ON public.payment_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = payment_links.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );
