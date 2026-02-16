
-- =============================================
-- DELIVERY NOTES (Inbound GRN + Outbound DN)
-- =============================================
CREATE TABLE public.delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  branch_id UUID REFERENCES public.branches(id),
  note_number TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'outbound', -- 'outbound' (to customer) or 'inbound' (from supplier / GRN)
  source_type TEXT, -- 'sales_order' or 'purchase_order'
  source_id UUID,
  customer_id UUID REFERENCES public.customers(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  status TEXT NOT NULL DEFAULT 'draft', -- draft, confirmed, delivered, cancelled
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view delivery notes" ON public.delivery_notes
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create delivery notes" ON public.delivery_notes
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND created_by = auth.uid()
    AND is_authorized_finance(tenant_id)
  );

CREATE POLICY "Finance can update draft delivery notes" ON public.delivery_notes
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id()
    AND status = 'draft'
    AND is_authorized_finance(tenant_id)
  );

CREATE POLICY "Admins can delete draft delivery notes" ON public.delivery_notes
  FOR DELETE USING (
    is_tenant_admin(tenant_id) AND status = 'draft'
  );

-- Delivery note items
CREATE TABLE public.delivery_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id UUID NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit VARCHAR DEFAULT 'وحدة',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view delivery note items" ON public.delivery_note_items
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create delivery note items" ON public.delivery_note_items
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id)
  );

CREATE POLICY "Finance can update delivery note items" ON public.delivery_note_items
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id)
  );

CREATE POLICY "Finance can delete delivery note items" ON public.delivery_note_items
  FOR DELETE USING (
    tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id)
  );

-- =============================================
-- JOURNAL ENTRIES (Accounting Ledger)
-- =============================================
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  branch_id UUID REFERENCES public.branches(id),
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_type TEXT, -- 'invoice', 'expense', 'sales_order', 'purchase_order', 'delivery_note', 'manual'
  source_id UUID,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, posted, voided
  total_debit NUMERIC NOT NULL DEFAULT 0,
  total_credit NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  posted_by UUID,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view journal entries" ON public.journal_entries
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create journal entries" ON public.journal_entries
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND created_by = auth.uid()
    AND is_authorized_finance(tenant_id)
  );

CREATE POLICY "Finance can update draft journal entries" ON public.journal_entries
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id()
    AND status = 'draft'
    AND is_authorized_finance(tenant_id)
  );

CREATE POLICY "Deny deletes on journal entries" ON public.journal_entries
  FOR DELETE USING (false);

-- Journal entry lines
CREATE TABLE public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  account_name TEXT NOT NULL,
  description TEXT,
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view journal entry lines" ON public.journal_entry_lines
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create journal entry lines" ON public.journal_entry_lines
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id)
  );

CREATE POLICY "Finance can update journal entry lines" ON public.journal_entry_lines
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id)
  );

CREATE POLICY "Finance can delete journal entry lines" ON public.journal_entry_lines
  FOR DELETE USING (
    tenant_id = get_user_tenant_id() AND is_authorized_finance(tenant_id)
  );

-- =============================================
-- DOCUMENT LIFECYCLE TRACKING
-- =============================================
CREATE TABLE public.document_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  document_type TEXT NOT NULL, -- 'invoice', 'quotation', 'sales_order', 'purchase_order', 'delivery_note', 'expense'
  document_id UUID NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  change_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_lifecycle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view lifecycle" ON public.document_lifecycle
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can insert lifecycle" ON public.document_lifecycle
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Deny updates on lifecycle" ON public.document_lifecycle
  FOR UPDATE USING (false);

CREATE POLICY "Deny deletes on lifecycle" ON public.document_lifecycle
  FOR DELETE USING (false);

-- =============================================
-- IMMUTABILITY TRIGGERS (Block edits after approval)
-- =============================================

-- Generic immutability function
CREATE OR REPLACE FUNCTION public.enforce_immutability_after_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow status changes (for voiding/cancelling) but block content edits on approved docs
  IF OLD.status IN ('approved', 'signed', 'posted', 'confirmed', 'delivered') THEN
    -- Only allow status changes and specific metadata updates
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify document after approval. Status: %', OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply to invoices
CREATE TRIGGER enforce_invoice_immutability
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_immutability_after_approval();

-- Apply to purchase orders
CREATE TRIGGER enforce_po_immutability
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_immutability_after_approval();

-- Apply to sales orders
CREATE TRIGGER enforce_so_immutability
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_immutability_after_approval();

-- Apply to delivery notes
CREATE TRIGGER enforce_dn_immutability
  BEFORE UPDATE ON public.delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_immutability_after_approval();

-- Apply to journal entries (block after posted)
CREATE TRIGGER enforce_je_immutability
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_immutability_after_approval();

-- =============================================
-- AUTO JOURNAL ENTRY FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.auto_create_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_number TEXT;
  v_entry_id UUID;
  v_description TEXT;
  v_total NUMERIC;
  v_vat NUMERIC;
  v_source_type TEXT;
BEGIN
  -- Only trigger on status change to approved/posted
  IF NEW.status NOT IN ('approved', 'posted', 'confirmed') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Determine source type based on table
  v_source_type := TG_ARGV[0];

  -- Get totals based on document type
  IF v_source_type = 'invoice' THEN
    v_total := NEW.grand_total;
    v_vat := NEW.vat_total;
    v_description := 'قيد فاتورة رقم ' || NEW.invoice_number;
    v_entry_number := 'JE-INV-' || NEW.invoice_number;
  ELSIF v_source_type = 'expense' THEN
    v_total := NEW.total_amount;
    v_vat := NEW.vat_amount;
    v_description := 'قيد مصروف رقم ' || NEW.expense_number;
    v_entry_number := 'JE-EXP-' || NEW.expense_number;
  ELSIF v_source_type = 'purchase_order' THEN
    v_total := NEW.grand_total;
    v_vat := NEW.vat_total;
    v_description := 'قيد أمر شراء رقم ' || NEW.order_number;
    v_entry_number := 'JE-PO-' || NEW.order_number;
  ELSIF v_source_type = 'sales_order' THEN
    v_total := NEW.grand_total;
    v_vat := NEW.vat_total;
    v_description := 'قيد أمر بيع رقم ' || NEW.order_number;
    v_entry_number := 'JE-SO-' || NEW.order_number;
  ELSE
    RETURN NEW;
  END IF;

  -- Create journal entry
  INSERT INTO public.journal_entries (
    tenant_id, branch_id, entry_number, entry_date,
    source_type, source_id, description, status,
    total_debit, total_credit, created_by, posted_by, posted_at
  ) VALUES (
    NEW.tenant_id, NEW.branch_id, v_entry_number, CURRENT_DATE,
    v_source_type, NEW.id, v_description, 'posted',
    v_total, v_total, COALESCE(auth.uid(), NEW.created_by),
    COALESCE(auth.uid(), NEW.created_by), now()
  ) RETURNING id INTO v_entry_id;

  -- Create debit line (receivable/asset)
  INSERT INTO public.journal_entry_lines (
    journal_entry_id, tenant_id, account_name, description,
    debit, credit, sort_order
  ) VALUES (
    v_entry_id, NEW.tenant_id,
    CASE v_source_type
      WHEN 'invoice' THEN 'حسابات مدينة'
      WHEN 'expense' THEN 'مصروفات'
      WHEN 'purchase_order' THEN 'مشتريات'
      WHEN 'sales_order' THEN 'حسابات مدينة'
    END,
    v_description,
    v_total - COALESCE(v_vat, 0), 0, 1
  );

  -- Create VAT line if applicable
  IF COALESCE(v_vat, 0) > 0 THEN
    INSERT INTO public.journal_entry_lines (
      journal_entry_id, tenant_id, account_name, description,
      debit, credit, sort_order
    ) VALUES (
      v_entry_id, NEW.tenant_id,
      CASE v_source_type
        WHEN 'invoice' THEN 'ضريبة القيمة المضافة - مخرجات'
        WHEN 'expense' THEN 'ضريبة القيمة المضافة - مدخلات'
        WHEN 'purchase_order' THEN 'ضريبة القيمة المضافة - مدخلات'
        WHEN 'sales_order' THEN 'ضريبة القيمة المضافة - مخرجات'
      END,
      'ضريبة ' || v_description,
      CASE WHEN v_source_type IN ('expense', 'purchase_order') THEN v_vat ELSE 0 END,
      CASE WHEN v_source_type IN ('invoice', 'sales_order') THEN v_vat ELSE 0 END,
      2
    );
  END IF;

  -- Create credit line (revenue/payable)
  INSERT INTO public.journal_entry_lines (
    journal_entry_id, tenant_id, account_name, description,
    debit, credit, sort_order
  ) VALUES (
    v_entry_id, NEW.tenant_id,
    CASE v_source_type
      WHEN 'invoice' THEN 'إيرادات مبيعات'
      WHEN 'expense' THEN 'حسابات دائنة'
      WHEN 'purchase_order' THEN 'حسابات دائنة'
      WHEN 'sales_order' THEN 'إيرادات مبيعات'
    END,
    v_description,
    CASE WHEN v_source_type IN ('expense', 'purchase_order') THEN 0 ELSE v_total END,
    CASE WHEN v_source_type IN ('expense', 'purchase_order') THEN v_total ELSE 0 END,
    3
  );

  RETURN NEW;
END;
$$;

-- Apply auto journal triggers
CREATE TRIGGER auto_journal_invoice
  AFTER UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_journal_entry('invoice');

CREATE TRIGGER auto_journal_expense
  AFTER UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_journal_entry('expense');

CREATE TRIGGER auto_journal_purchase_order
  AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_journal_entry('purchase_order');

CREATE TRIGGER auto_journal_sales_order
  AFTER UPDATE ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_journal_entry('sales_order');

-- Add converted_delivery_note_id to sales_orders
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS converted_delivery_note_id UUID REFERENCES public.delivery_notes(id);

-- Add converted_grn_id to purchase_orders  
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS converted_grn_id UUID REFERENCES public.delivery_notes(id);

-- Updated_at trigger for new tables
CREATE TRIGGER update_delivery_notes_updated_at
  BEFORE UPDATE ON public.delivery_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
