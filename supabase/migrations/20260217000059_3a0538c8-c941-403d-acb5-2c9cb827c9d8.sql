
-- ==========================================
-- 1. Invoice Payments (Partial Payments)
-- ==========================================
CREATE TABLE public.invoice_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  reference_number TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view payments" ON public.invoice_payments
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create payments" ON public.invoice_payments
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND created_by = auth.uid() AND is_authorized_finance(tenant_id));

CREATE POLICY "Admins can delete payments" ON public.invoice_payments
  FOR DELETE USING (is_tenant_admin(tenant_id));

-- Trigger to auto-update invoice amount_paid and status
CREATE OR REPLACE FUNCTION public.update_invoice_payment_totals()
RETURNS TRIGGER AS $$
DECLARE
  total_paid NUMERIC;
  inv_grand_total NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM public.invoice_payments WHERE invoice_id = OLD.invoice_id;
    SELECT grand_total INTO inv_grand_total FROM public.invoices WHERE id = OLD.invoice_id;
    
    UPDATE public.invoices SET
      amount_paid = total_paid,
      amount_due = inv_grand_total - total_paid,
      status = CASE
        WHEN total_paid >= inv_grand_total THEN 'paid'
        WHEN total_paid > 0 THEN 'partially_paid'
        ELSE 'issued'
      END,
      updated_at = now()
    WHERE id = OLD.invoice_id;
    RETURN OLD;
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM public.invoice_payments WHERE invoice_id = NEW.invoice_id;
    SELECT grand_total INTO inv_grand_total FROM public.invoices WHERE id = NEW.invoice_id;
    
    UPDATE public.invoices SET
      amount_paid = total_paid,
      amount_due = inv_grand_total - total_paid,
      status = CASE
        WHEN total_paid >= inv_grand_total THEN 'paid'
        WHEN total_paid > 0 THEN 'partially_paid'
        ELSE 'issued'
      END,
      updated_at = now()
    WHERE id = NEW.invoice_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_update_invoice_payment_totals
AFTER INSERT OR DELETE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.update_invoice_payment_totals();

-- ==========================================
-- 2. Credit Notes / Refunds
-- ==========================================
CREATE TABLE public.credit_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  credit_note_number TEXT NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  branch_id UUID REFERENCES public.branches(id),
  credit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL DEFAULT '',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat_total NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  currency VARCHAR NOT NULL DEFAULT 'SAR',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view credit notes" ON public.credit_notes
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create credit notes" ON public.credit_notes
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND created_by = auth.uid() AND is_authorized_finance(tenant_id));

CREATE POLICY "Finance can update credit notes" ON public.credit_notes
  FOR UPDATE USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

CREATE POLICY "Admins can delete draft credit notes" ON public.credit_notes
  FOR DELETE USING (is_tenant_admin(tenant_id) AND status = 'draft');

CREATE TABLE public.credit_note_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit VARCHAR DEFAULT 'وحدة',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 15.00,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view credit note items" ON public.credit_note_items
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create credit note items" ON public.credit_note_items
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

CREATE POLICY "Finance can update credit note items" ON public.credit_note_items
  FOR UPDATE USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

CREATE POLICY "Finance can delete credit note items" ON public.credit_note_items
  FOR DELETE USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

-- ==========================================
-- 3. Payment Gateway Links
-- ==========================================
CREATE TABLE public.payment_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  currency VARCHAR NOT NULL DEFAULT 'SAR',
  gateway TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_url TEXT,
  gateway_reference TEXT,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view payment links" ON public.payment_links
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create payment links" ON public.payment_links
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND created_by = auth.uid() AND is_authorized_finance(tenant_id));

CREATE POLICY "Finance can update payment links" ON public.payment_links
  FOR UPDATE USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

-- ==========================================
-- 4. Currency Exchange Rates
-- ==========================================
CREATE TABLE public.currency_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  from_currency VARCHAR NOT NULL DEFAULT 'SAR',
  to_currency VARCHAR NOT NULL,
  rate NUMERIC NOT NULL DEFAULT 1,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view currency rates" ON public.currency_rates
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage currency rates" ON public.currency_rates
  FOR INSERT WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can update currency rates" ON public.currency_rates
  FOR UPDATE USING (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can delete currency rates" ON public.currency_rates
  FOR DELETE USING (is_tenant_admin(tenant_id));

-- Enable realtime for payment-related tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_links;
