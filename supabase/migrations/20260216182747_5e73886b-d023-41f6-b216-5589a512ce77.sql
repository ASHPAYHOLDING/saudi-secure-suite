
-- ===========================
-- SUPPLIERS TABLE
-- ===========================
CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  name_en text,
  contact_name text,
  email text,
  phone character varying,
  address_street text,
  address_city text,
  address_zip character varying,
  cr_number character varying,
  vat_number character varying,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view suppliers" ON public.suppliers FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Finance can create suppliers" ON public.suppliers FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));
CREATE POLICY "Finance can update suppliers" ON public.suppliers FOR UPDATE USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));
CREATE POLICY "Admins can delete suppliers" ON public.suppliers FOR DELETE USING (is_tenant_admin(tenant_id));
CREATE POLICY "Platform admins can view all suppliers" ON public.suppliers FOR SELECT USING (is_platform_admin());

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================
-- PURCHASE ORDERS TABLE
-- ===========================
CREATE TABLE public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  order_number text NOT NULL,
  title text NOT NULL DEFAULT '',
  supplier_id uuid REFERENCES public.suppliers(id),
  status text NOT NULL DEFAULT 'draft',
  delivery_status text NOT NULL DEFAULT 'pending',
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  delivered_at timestamp with time zone,
  currency character varying NOT NULL DEFAULT 'SAR',
  subtotal numeric NOT NULL DEFAULT 0,
  discount_total numeric NOT NULL DEFAULT 0,
  vat_total numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  notes text,
  approved_by uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view purchase orders" ON public.purchase_orders FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Finance can create purchase orders" ON public.purchase_orders FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND created_by = auth.uid() AND is_authorized_finance(tenant_id));
CREATE POLICY "Finance can update purchase orders" ON public.purchase_orders FOR UPDATE USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));
CREATE POLICY "Admins can delete draft purchase orders" ON public.purchase_orders FOR DELETE USING (is_tenant_admin(tenant_id) AND status = 'draft');
CREATE POLICY "Platform admins can view all purchase orders" ON public.purchase_orders FOR SELECT USING (is_platform_admin());

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================
-- PURCHASE ORDER ITEMS TABLE
-- ===========================
CREATE TABLE public.purchase_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  received_quantity numeric NOT NULL DEFAULT 0,
  unit character varying DEFAULT 'وحدة',
  unit_price numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 15.00,
  vat_amount numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view purchase order items" ON public.purchase_order_items FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Finance can create purchase order items" ON public.purchase_order_items FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));
CREATE POLICY "Finance can update purchase order items" ON public.purchase_order_items FOR UPDATE USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));
CREATE POLICY "Finance can delete purchase order items" ON public.purchase_order_items FOR DELETE USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

-- ===========================
-- AUDIT TRIGGER FOR PURCHASE ORDERS
-- ===========================
CREATE OR REPLACE FUNCTION public.audit_purchase_order_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (NEW.tenant_id, NEW.created_by, 'create', 'purchase_order', NEW.id, NEW.order_number);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      NEW.tenant_id,
      COALESCE(auth.uid(), NEW.created_by),
      CASE
        WHEN OLD.status <> NEW.status AND NEW.status = 'approved' THEN 'approve'
        WHEN OLD.status <> NEW.status AND NEW.status = 'rejected' THEN 'reject'
        WHEN OLD.delivery_status <> NEW.delivery_status AND NEW.delivery_status = 'delivered' THEN 'receive'
        ELSE 'update'
      END,
      'purchase_order', NEW.id, NEW.order_number,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'old_delivery', OLD.delivery_status, 'new_delivery', NEW.delivery_status)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (OLD.tenant_id, COALESCE(auth.uid(), OLD.created_by), 'delete', 'purchase_order', OLD.id, OLD.order_number);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_purchase_order_changes
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.audit_purchase_order_changes();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
