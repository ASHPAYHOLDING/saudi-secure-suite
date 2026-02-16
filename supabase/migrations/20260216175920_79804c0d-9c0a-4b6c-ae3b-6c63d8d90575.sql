
-- Sales Orders table
CREATE TABLE public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  customer_id uuid REFERENCES public.customers(id),
  quotation_id uuid REFERENCES public.quotations(id),
  created_by uuid NOT NULL,
  order_number text NOT NULL,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',  -- pending, confirmed, partially_fulfilled, fulfilled, cancelled
  fulfillment_status text NOT NULL DEFAULT 'unfulfilled',  -- unfulfilled, partial, fulfilled
  currency varchar NOT NULL DEFAULT 'SAR',
  subtotal numeric NOT NULL DEFAULT 0,
  discount_total numeric NOT NULL DEFAULT 0,
  vat_total numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  notes text,
  converted_invoice_id uuid,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sales Order Items
CREATE TABLE public.sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  fulfilled_quantity numeric NOT NULL DEFAULT 0,
  reserved_quantity numeric NOT NULL DEFAULT 0,
  unit varchar DEFAULT 'وحدة',
  unit_price numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 15.00,
  vat_amount numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

-- RLS: sales_orders
CREATE POLICY "Members can view sales orders"
  ON public.sales_orders FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Platform admins can view all sales orders"
  ON public.sales_orders FOR SELECT
  USING (is_platform_admin());

CREATE POLICY "Finance can create sales orders"
  ON public.sales_orders FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND created_by = auth.uid() AND is_authorized_finance(tenant_id));

CREATE POLICY "Finance can update non-cancelled orders"
  ON public.sales_orders FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND status <> 'cancelled' AND is_authorized_finance(tenant_id));

CREATE POLICY "Admins can cancel orders"
  ON public.sales_orders FOR DELETE
  USING (is_tenant_admin(tenant_id) AND status = 'pending');

-- RLS: sales_order_items
CREATE POLICY "Members can view sales order items"
  ON public.sales_order_items FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create sales order items"
  ON public.sales_order_items FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

CREATE POLICY "Finance can update sales order items"
  ON public.sales_order_items FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

CREATE POLICY "Finance can delete sales order items"
  ON public.sales_order_items FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

-- Updated_at triggers
CREATE TRIGGER update_sales_orders_updated_at
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger
CREATE OR REPLACE FUNCTION public.audit_sales_order_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (NEW.tenant_id, NEW.created_by, 'create', 'sales_order', NEW.id, NEW.order_number);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      NEW.tenant_id,
      COALESCE(auth.uid(), NEW.created_by),
      CASE
        WHEN OLD.status <> NEW.status AND NEW.status = 'confirmed' THEN 'confirm'
        WHEN OLD.status <> NEW.status AND NEW.status = 'cancelled' THEN 'cancel'
        WHEN OLD.fulfillment_status <> NEW.fulfillment_status AND NEW.fulfillment_status = 'fulfilled' THEN 'fulfill'
        WHEN NEW.converted_invoice_id IS NOT NULL AND OLD.converted_invoice_id IS NULL THEN 'convert_to_invoice'
        ELSE 'update'
      END,
      'sales_order', NEW.id, NEW.order_number,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'old_fulfillment', OLD.fulfillment_status, 'new_fulfillment', NEW.fulfillment_status)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (OLD.tenant_id, COALESCE(auth.uid(), OLD.created_by), 'delete', 'sales_order', OLD.id, OLD.order_number);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_sales_order_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_sales_order_changes();

-- Stock reservation function
CREATE OR REPLACE FUNCTION public.reserve_stock_for_order(_sales_order_id uuid, _tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _item RECORD;
  _available numeric;
BEGIN
  FOR _item IN
    SELECT soi.id, soi.product_id, soi.quantity, soi.reserved_quantity
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = _sales_order_id AND soi.product_id IS NOT NULL
  LOOP
    SELECT stock_quantity INTO _available
    FROM public.products
    WHERE id = _item.product_id AND tenant_id = _tenant_id
    FOR UPDATE;

    IF _available >= _item.quantity THEN
      UPDATE public.products SET stock_quantity = stock_quantity - _item.quantity WHERE id = _item.product_id;
      UPDATE public.sales_order_items SET reserved_quantity = _item.quantity WHERE id = _item.id;
      
      INSERT INTO public.stock_movements (tenant_id, product_id, movement_type, quantity, previous_quantity, new_quantity, reference_type, reference_id, notes, created_by)
      VALUES (_tenant_id, _item.product_id, 'out', _item.quantity, _available, _available - _item.quantity, 'sales_order', _sales_order_id, 'حجز مخزون لأمر بيع', COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid));
    ELSE
      RAISE EXCEPTION 'المخزون غير كافٍ للمنتج %', _item.product_id;
    END IF;
  END LOOP;
END;
$$;

-- Release stock reservation on cancellation
CREATE OR REPLACE FUNCTION public.release_stock_reservation(_sales_order_id uuid, _tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _item RECORD;
  _current_qty numeric;
BEGIN
  FOR _item IN
    SELECT soi.id, soi.product_id, soi.reserved_quantity
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = _sales_order_id AND soi.product_id IS NOT NULL AND soi.reserved_quantity > 0
  LOOP
    SELECT stock_quantity INTO _current_qty FROM public.products WHERE id = _item.product_id FOR UPDATE;
    
    UPDATE public.products SET stock_quantity = stock_quantity + _item.reserved_quantity WHERE id = _item.product_id;
    UPDATE public.sales_order_items SET reserved_quantity = 0 WHERE id = _item.id;
    
    INSERT INTO public.stock_movements (tenant_id, product_id, movement_type, quantity, previous_quantity, new_quantity, reference_type, reference_id, notes, created_by)
    VALUES (_tenant_id, _item.product_id, 'in', _item.reserved_quantity, _current_qty, _current_qty + _item.reserved_quantity, 'sales_order', _sales_order_id, 'إلغاء حجز مخزون', COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid));
  END LOOP;
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_orders;
