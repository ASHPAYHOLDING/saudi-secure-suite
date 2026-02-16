
-- Products & Services table
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text,
  sku text,
  description text,
  product_type text NOT NULL DEFAULT 'product' CHECK (product_type IN ('product', 'service')),
  unit text DEFAULT 'وحدة',
  unit_price numeric NOT NULL DEFAULT 0,
  cost_price numeric DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 15.00,
  stock_quantity numeric NOT NULL DEFAULT 0,
  low_stock_threshold numeric DEFAULT 10,
  track_stock boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  category text,
  barcode text,
  image_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Stock movement history
CREATE TABLE public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'return')),
  quantity numeric NOT NULL,
  previous_quantity numeric NOT NULL DEFAULT 0,
  new_quantity numeric NOT NULL DEFAULT 0,
  reference_type text, -- 'invoice', 'manual', 'return', 'adjustment'
  reference_id uuid,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_products_tenant ON public.products(tenant_id);
CREATE INDEX idx_products_sku ON public.products(tenant_id, sku);
CREATE INDEX idx_products_active ON public.products(tenant_id, is_active);
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_tenant ON public.stock_movements(tenant_id);
CREATE UNIQUE INDEX idx_products_sku_unique ON public.products(tenant_id, sku) WHERE sku IS NOT NULL AND sku <> '';

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Products RLS
CREATE POLICY "Members can view products"
  ON public.products FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create products"
  ON public.products FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

CREATE POLICY "Finance can update products"
  ON public.products FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

CREATE POLICY "Admins can delete products"
  ON public.products FOR DELETE
  USING (is_tenant_admin(tenant_id));

CREATE POLICY "Platform admins can view all products"
  ON public.products FOR SELECT
  USING (is_platform_admin());

-- Stock movements RLS
CREATE POLICY "Members can view stock movements"
  ON public.stock_movements FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create stock movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

CREATE POLICY "Platform admins can view all movements"
  ON public.stock_movements FOR SELECT
  USING (is_platform_admin());

-- Updated_at trigger for products
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Audit stock changes via trigger
CREATE OR REPLACE FUNCTION public.audit_stock_movement()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _product_name text;
BEGIN
  SELECT name INTO _product_name FROM public.products WHERE id = NEW.product_id;
  
  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (
    NEW.tenant_id,
    NEW.created_by,
    NEW.movement_type,
    'stock_movement',
    NEW.product_id,
    _product_name,
    jsonb_build_object(
      'quantity', NEW.quantity,
      'previous', NEW.previous_quantity,
      'new', NEW.new_quantity,
      'type', NEW.movement_type,
      'reference_type', NEW.reference_type
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_stock_movement_trigger
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_stock_movement();

-- Function to record stock movement and update product quantity
CREATE OR REPLACE FUNCTION public.record_stock_movement(
  _product_id uuid,
  _tenant_id uuid,
  _movement_type text,
  _quantity numeric,
  _reference_type text DEFAULT 'manual',
  _reference_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL,
  _created_by uuid DEFAULT NULL
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _prev_qty numeric;
  _new_qty numeric;
BEGIN
  SELECT stock_quantity INTO _prev_qty
  FROM public.products
  WHERE id = _product_id AND tenant_id = _tenant_id
  FOR UPDATE;

  IF _movement_type IN ('in', 'return') THEN
    _new_qty := _prev_qty + _quantity;
  ELSIF _movement_type = 'out' THEN
    _new_qty := _prev_qty - _quantity;
  ELSIF _movement_type = 'adjustment' THEN
    _new_qty := _quantity; -- absolute set
  END IF;

  UPDATE public.products
  SET stock_quantity = _new_qty
  WHERE id = _product_id AND tenant_id = _tenant_id;

  INSERT INTO public.stock_movements (tenant_id, product_id, movement_type, quantity, previous_quantity, new_quantity, reference_type, reference_id, notes, created_by)
  VALUES (_tenant_id, _product_id, _movement_type, _quantity, _prev_qty, _new_qty, _reference_type, _reference_id, _notes, COALESCE(_created_by, auth.uid()));
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
