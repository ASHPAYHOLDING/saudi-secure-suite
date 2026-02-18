
-- ============================================
-- INVENTORY MANAGEMENT SYSTEM - FULL SCHEMA
-- ============================================

-- 1) WAREHOUSES
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id),
  name TEXT NOT NULL,
  name_en TEXT,
  code TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  manager_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.warehouses FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE INDEX idx_warehouses_tenant ON public.warehouses(tenant_id);

-- 2) PRODUCT VARIANTS
CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  sku TEXT,
  barcode TEXT,
  attributes JSONB DEFAULT '{}',
  unit_price NUMERIC(15,2) DEFAULT 0,
  cost_price NUMERIC(15,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.product_variants FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);

-- 3) INVENTORY BALANCES (per warehouse per product/variant)
CREATE TABLE public.inventory_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id),
  quantity_on_hand NUMERIC(15,4) NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC(15,4) NOT NULL DEFAULT 0,
  quantity_available NUMERIC(15,4) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  weighted_avg_cost NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_value NUMERIC(15,4) GENERATED ALWAYS AS (quantity_on_hand * weighted_avg_cost) STORED,
  last_movement_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, warehouse_id, product_id, variant_id)
);

ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.inventory_balances FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE INDEX idx_inv_bal_warehouse ON public.inventory_balances(warehouse_id);
CREATE INDEX idx_inv_bal_product ON public.inventory_balances(product_id);

-- 4) INVENTORY MOVEMENTS (enhanced, warehouse-aware)
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('goods_receipt','goods_issue','transfer_in','transfer_out','adjustment','stocktake','return_in','return_out','cogs')),
  quantity NUMERIC(15,4) NOT NULL,
  unit_cost NUMERIC(15,4) DEFAULT 0,
  total_cost NUMERIC(15,4) DEFAULT 0,
  previous_qty NUMERIC(15,4) DEFAULT 0,
  new_qty NUMERIC(15,4) DEFAULT 0,
  previous_avg_cost NUMERIC(15,4) DEFAULT 0,
  new_avg_cost NUMERIC(15,4) DEFAULT 0,
  reference_type TEXT,
  reference_id UUID,
  transfer_id UUID,
  notes TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.inventory_movements FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE INDEX idx_inv_mov_warehouse ON public.inventory_movements(warehouse_id);
CREATE INDEX idx_inv_mov_product ON public.inventory_movements(product_id);
CREATE INDEX idx_inv_mov_created ON public.inventory_movements(created_at DESC);
CREATE INDEX idx_inv_mov_ref ON public.inventory_movements(reference_type, reference_id);

-- 5) GOODS RECEIPTS
CREATE TABLE public.goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  receipt_number TEXT NOT NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES public.suppliers(id),
  purchase_order_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','cancelled')),
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.goods_receipts FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE TABLE public.goods_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  description TEXT,
  quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(15,4) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 15,
  vat_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.goods_receipt_items FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- 6) WAREHOUSE TRANSFERS
CREATE TABLE public.warehouse_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  from_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  to_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_transit','completed','cancelled')),
  notes TEXT,
  created_by UUID NOT NULL,
  completed_by UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouse_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.warehouse_transfers FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE TABLE public.warehouse_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transfer_id UUID NOT NULL REFERENCES public.warehouse_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.warehouse_transfer_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.warehouse_transfer_items FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- 7) STOCKTAKING
CREATE TABLE public.stocktakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  stocktake_number TEXT NOT NULL,
  stocktake_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','cancelled')),
  notes TEXT,
  created_by UUID NOT NULL,
  completed_by UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stocktakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.stocktakes FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE TABLE public.stocktake_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stocktake_id UUID NOT NULL REFERENCES public.stocktakes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  system_qty NUMERIC(15,4) NOT NULL DEFAULT 0,
  counted_qty NUMERIC(15,4),
  difference NUMERIC(15,4) GENERATED ALWAYS AS (COALESCE(counted_qty, 0) - system_qty) STORED,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.stocktake_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.stocktake_items FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- 8) SEQUENCE FUNCTIONS
CREATE OR REPLACE FUNCTION public.generate_inventory_number(p_tenant_id UUID, p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM (
    SELECT 1 FROM goods_receipts WHERE tenant_id = p_tenant_id
    UNION ALL SELECT 1 FROM warehouse_transfers WHERE tenant_id = p_tenant_id
    UNION ALL SELECT 1 FROM stocktakes WHERE tenant_id = p_tenant_id
  ) sub;
  v_number := p_prefix || '-' || LPAD(v_count::TEXT, 5, '0');
  RETURN v_number;
END;
$$;

-- 9) INVENTORY MOVEMENT PROCESSING FUNCTION (Weighted Average Cost)
CREATE OR REPLACE FUNCTION public.process_inventory_movement(
  p_tenant_id UUID,
  p_warehouse_id UUID,
  p_product_id UUID,
  p_variant_id UUID,
  p_movement_type TEXT,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_transfer_id UUID,
  p_notes TEXT,
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_prev_qty NUMERIC;
  v_prev_cost NUMERIC;
  v_new_qty NUMERIC;
  v_new_cost NUMERIC;
  v_total_cost NUMERIC;
  v_movement_id UUID;
BEGIN
  -- Get or create balance record
  SELECT * INTO v_balance FROM inventory_balances
  WHERE tenant_id = p_tenant_id AND warehouse_id = p_warehouse_id AND product_id = p_product_id
    AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL))
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO inventory_balances (tenant_id, warehouse_id, product_id, variant_id, quantity_on_hand, weighted_avg_cost)
    VALUES (p_tenant_id, p_warehouse_id, p_product_id, p_variant_id, 0, 0)
    RETURNING * INTO v_balance;
  END IF;

  v_prev_qty := v_balance.quantity_on_hand;
  v_prev_cost := v_balance.weighted_avg_cost;

  -- Calculate new quantity and weighted average cost
  IF p_movement_type IN ('goods_receipt', 'transfer_in', 'return_in') THEN
    v_new_qty := v_prev_qty + p_quantity;
    -- Weighted average: (old_qty * old_cost + new_qty * new_cost) / total_qty
    IF v_new_qty > 0 THEN
      v_new_cost := ((v_prev_qty * v_prev_cost) + (p_quantity * p_unit_cost)) / v_new_qty;
    ELSE
      v_new_cost := p_unit_cost;
    END IF;
  ELSIF p_movement_type IN ('goods_issue', 'transfer_out', 'return_out', 'cogs') THEN
    v_new_qty := v_prev_qty - p_quantity;
    v_new_cost := v_prev_cost; -- cost doesn't change on outbound
  ELSIF p_movement_type IN ('adjustment', 'stocktake') THEN
    -- p_quantity is the DIFFERENCE (can be negative)
    v_new_qty := v_prev_qty + p_quantity;
    v_new_cost := CASE WHEN p_unit_cost > 0 THEN p_unit_cost ELSE v_prev_cost END;
  ELSE
    RAISE EXCEPTION 'Unknown movement type: %', p_movement_type;
  END IF;

  v_total_cost := ABS(p_quantity) * COALESCE(CASE WHEN p_movement_type IN ('goods_issue','transfer_out','return_out','cogs') THEN v_prev_cost ELSE p_unit_cost END, 0);

  -- Insert movement record
  INSERT INTO inventory_movements (
    tenant_id, warehouse_id, product_id, variant_id, movement_type,
    quantity, unit_cost, total_cost, previous_qty, new_qty,
    previous_avg_cost, new_avg_cost, reference_type, reference_id,
    transfer_id, notes, created_by
  ) VALUES (
    p_tenant_id, p_warehouse_id, p_product_id, p_variant_id, p_movement_type,
    p_quantity, p_unit_cost, v_total_cost, v_prev_qty, v_new_qty,
    v_prev_cost, v_new_cost, p_reference_type, p_reference_id,
    p_transfer_id, p_notes, p_created_by
  ) RETURNING id INTO v_movement_id;

  -- Update balance
  UPDATE inventory_balances SET
    quantity_on_hand = v_new_qty,
    weighted_avg_cost = v_new_cost,
    last_movement_at = now(),
    updated_at = now()
  WHERE id = v_balance.id;

  -- Also update the legacy products.stock_quantity for backward compat
  UPDATE products SET stock_quantity = (
    SELECT COALESCE(SUM(quantity_on_hand), 0)::INT FROM inventory_balances
    WHERE product_id = p_product_id AND tenant_id = p_tenant_id
  ) WHERE id = p_product_id;

  RETURN v_movement_id;
END;
$$;

-- 10) Updated timestamp triggers
CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_goods_receipts_updated_at BEFORE UPDATE ON public.goods_receipts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_warehouse_transfers_updated_at BEFORE UPDATE ON public.warehouse_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stocktakes_updated_at BEFORE UPDATE ON public.stocktakes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
