
-- Quotations table
CREATE TABLE public.quotations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id),
  quotation_number text NOT NULL,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'converted')),
  currency varchar NOT NULL DEFAULT 'SAR',
  subtotal numeric NOT NULL DEFAULT 0,
  discount_total numeric NOT NULL DEFAULT 0,
  vat_total numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  notes text,
  valid_until date,
  approved_at timestamptz,
  approved_by uuid,
  converted_invoice_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Quotation items
CREATE TABLE public.quotation_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text NOT NULL,
  unit varchar DEFAULT 'وحدة',
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 15.00,
  vat_amount numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_quotations_tenant ON public.quotations(tenant_id);
CREATE INDEX idx_quotations_customer ON public.quotations(customer_id);
CREATE INDEX idx_quotations_status ON public.quotations(tenant_id, status);
CREATE INDEX idx_quotation_items_quotation ON public.quotation_items(quotation_id);

-- Enable RLS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

-- Quotations RLS
CREATE POLICY "Members can view quotations"
  ON public.quotations FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create quotations"
  ON public.quotations FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND created_by = auth.uid() AND is_authorized_finance(tenant_id));

CREATE POLICY "Finance can update draft/sent quotations"
  ON public.quotations FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND status IN ('draft', 'sent') AND is_authorized_finance(tenant_id));

CREATE POLICY "Admins can update any quotation status"
  ON public.quotations FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND is_tenant_admin(tenant_id));

CREATE POLICY "Admins can delete draft quotations"
  ON public.quotations FOR DELETE
  USING (is_tenant_admin(tenant_id) AND status = 'draft');

CREATE POLICY "Platform admins can view all quotations"
  ON public.quotations FOR SELECT
  USING (is_platform_admin());

-- Quotation items RLS
CREATE POLICY "Members can view quotation items"
  ON public.quotation_items FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create quotation items"
  ON public.quotation_items FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

CREATE POLICY "Finance can update quotation items"
  ON public.quotation_items FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

CREATE POLICY "Finance can delete quotation items"
  ON public.quotation_items FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

-- Updated_at trigger
CREATE TRIGGER update_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Audit quotation changes
CREATE OR REPLACE FUNCTION public.audit_quotation_changes()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (NEW.tenant_id, NEW.created_by, 'create', 'quotation', NEW.id, NEW.quotation_number);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      NEW.tenant_id,
      COALESCE(auth.uid(), NEW.created_by),
      CASE
        WHEN OLD.status <> NEW.status AND NEW.status = 'approved' THEN 'approve'
        WHEN OLD.status <> NEW.status AND NEW.status = 'rejected' THEN 'reject'
        WHEN OLD.status <> NEW.status AND NEW.status = 'converted' THEN 'convert_to_invoice'
        WHEN OLD.status <> NEW.status AND NEW.status = 'sent' THEN 'send'
        ELSE 'update'
      END,
      'quotation', NEW.id, NEW.quotation_number,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'old_total', OLD.grand_total, 'new_total', NEW.grand_total)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (OLD.tenant_id, COALESCE(auth.uid(), OLD.created_by), 'delete', 'quotation', OLD.id, OLD.quotation_number);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_quotation_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_quotation_changes();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.quotations;
