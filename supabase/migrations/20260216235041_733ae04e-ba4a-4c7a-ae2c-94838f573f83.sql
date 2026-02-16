
-- Product Batches table: tracks lot/batch info per product
CREATE TABLE public.product_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  production_date DATE,
  expiry_date DATE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  initial_quantity NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  supplier_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, product_id, batch_number)
);

-- Enable RLS
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can view batches" ON public.product_batches
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create batches" ON public.product_batches
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

CREATE POLICY "Finance can update batches" ON public.product_batches
  FOR UPDATE USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));

CREATE POLICY "Admins can delete batches" ON public.product_batches
  FOR DELETE USING (is_tenant_admin(tenant_id));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_batches;

-- Updated_at trigger
CREATE TRIGGER update_product_batches_updated_at
  BEFORE UPDATE ON public.product_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
