
-- ═══════════════════════════════════════════
-- CUSTOMERS — العملاء
-- ═══════════════════════════════════════════
CREATE TABLE public.customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    name_en         TEXT,
    customer_type   TEXT NOT NULL DEFAULT 'business'
                    CHECK (customer_type IN ('business','individual')),
    vat_number      VARCHAR(15),
    cr_number       VARCHAR(20),
    email           TEXT,
    phone           VARCHAR(20),
    address_city    TEXT,
    address_street  TEXT,
    address_zip     VARCHAR(10),
    notes           TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_name ON customers(tenant_id, name);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view customers"
  ON public.customers FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Members can create customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Members can update customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can delete customers"
  ON public.customers FOR DELETE TO authenticated
  USING (public.is_tenant_admin(tenant_id));

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════
-- INVOICES — الفواتير
-- ═══════════════════════════════════════════
CREATE TABLE public.invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_number      TEXT NOT NULL,
    invoice_type        TEXT NOT NULL DEFAULT 'tax'
                        CHECK (invoice_type IN ('tax','simplified')),
    customer_id         UUID NOT NULL REFERENCES customers(id),
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN (
                            'draft','issued','sent','partially_paid','paid','overdue','cancelled'
                        )),
    invoice_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    supply_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date            DATE NOT NULL DEFAULT (CURRENT_DATE + interval '30 days'),
    subtotal            DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_total      DECIMAL(12,2) NOT NULL DEFAULT 0,
    vat_total           DECIMAL(12,2) NOT NULL DEFAULT 0,
    grand_total         DECIMAL(12,2) NOT NULL DEFAULT 0,
    amount_paid         DECIMAL(12,2) NOT NULL DEFAULT 0,
    amount_due          DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency            VARCHAR(3) NOT NULL DEFAULT 'SAR',
    notes               TEXT,
    created_by          UUID NOT NULL REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_inv_number ON invoices(tenant_id, invoice_number);
CREATE INDEX idx_inv_tenant ON invoices(tenant_id);
CREATE INDEX idx_inv_customer ON invoices(tenant_id, customer_id);
CREATE INDEX idx_inv_status ON invoices(tenant_id, status);
CREATE INDEX idx_inv_date ON invoices(tenant_id, invoice_date);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Members can create invoices"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND created_by = auth.uid());

CREATE POLICY "Members can update invoices"
  ON public.invoices FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can delete invoices"
  ON public.invoices FOR DELETE TO authenticated
  USING (public.is_tenant_admin(tenant_id));

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════
-- INVOICE_ITEMS — بنود الفاتورة
-- ═══════════════════════════════════════════
CREATE TABLE public.invoice_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sort_order      INT NOT NULL DEFAULT 0,
    description     TEXT NOT NULL,
    quantity        DECIMAL(10,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit            VARCHAR(20) DEFAULT 'وحدة',
    unit_price      DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    discount        DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    vat_rate        DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    vat_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
    line_total      DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inv_items ON invoice_items(invoice_id);
CREATE INDEX idx_inv_items_tenant ON invoice_items(tenant_id);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view invoice items"
  ON public.invoice_items FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Members can create invoice items"
  ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Members can update invoice items"
  ON public.invoice_items FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Members can delete invoice items"
  ON public.invoice_items FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
