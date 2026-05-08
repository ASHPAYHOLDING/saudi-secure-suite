CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status_idate
  ON public.invoices (tenant_id, status, invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_created
  ON public.invoices (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_status_edate
  ON public.expenses (tenant_id, status, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_created
  ON public.expenses (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_created
  ON public.customers (tenant_id, created_at DESC);

ANALYZE public.invoices;
ANALYZE public.expenses;
ANALYZE public.customers;