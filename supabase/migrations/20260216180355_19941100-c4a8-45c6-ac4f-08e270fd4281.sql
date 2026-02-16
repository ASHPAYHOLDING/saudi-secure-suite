
-- Expense categories
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view categories" ON public.expense_categories FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Finance can create categories" ON public.expense_categories FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));
CREATE POLICY "Finance can update categories" ON public.expense_categories FOR UPDATE USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));
CREATE POLICY "Admins can delete categories" ON public.expense_categories FOR DELETE USING (is_tenant_admin(tenant_id));

-- Expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  category_id uuid REFERENCES public.expense_categories(id),
  expense_number text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text,
  amount numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 15.00,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'cash',
  receipt_url text,
  receipt_filename text,
  status text NOT NULL DEFAULT 'draft',
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  notes text,
  currency varchar NOT NULL DEFAULT 'SAR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view expenses" ON public.expenses FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Finance can create expenses" ON public.expenses FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND created_by = auth.uid() AND is_authorized_finance(tenant_id));
CREATE POLICY "Finance can update non-approved expenses" ON public.expenses FOR UPDATE USING (tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id));
CREATE POLICY "Admins can delete draft expenses" ON public.expenses FOR DELETE USING (is_tenant_admin(tenant_id) AND status = 'draft');
CREATE POLICY "Platform admins can view all expenses" ON public.expenses FOR SELECT USING (is_platform_admin());

-- Updated_at trigger
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger
CREATE OR REPLACE FUNCTION public.audit_expense_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (NEW.tenant_id, NEW.created_by, 'create', 'expense', NEW.id, NEW.expense_number);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      NEW.tenant_id, COALESCE(auth.uid(), NEW.created_by),
      CASE
        WHEN OLD.status <> NEW.status AND NEW.status = 'approved' THEN 'approve'
        WHEN OLD.status <> NEW.status AND NEW.status = 'rejected' THEN 'reject'
        ELSE 'update'
      END,
      'expense', NEW.id, NEW.expense_number,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'old_total', OLD.total_amount, 'new_total', NEW.total_amount)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (OLD.tenant_id, COALESCE(auth.uid(), OLD.created_by), 'delete', 'expense', OLD.id, OLD.expense_number);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_expense_changes AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION audit_expense_changes();

-- Storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('expense-receipts', 'expense-receipts', false);

CREATE POLICY "Members can upload receipts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);
CREATE POLICY "Members can view own tenant receipts" ON storage.objects FOR SELECT USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);
CREATE POLICY "Members can delete own receipts" ON storage.objects FOR DELETE USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;

-- Indexes
CREATE INDEX idx_expenses_tenant_id ON public.expenses(tenant_id);
CREATE INDEX idx_expenses_status ON public.expenses(status);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX idx_expense_categories_tenant ON public.expense_categories(tenant_id);
