
-- ============================================================
-- Performance: 29 Missing Indexes on Critical Columns
-- ============================================================

-- INVOICES (11% idx hit)
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices (customer_id);

-- EXPENSES
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON public.expenses (tenant_id, created_at DESC);

-- WALLET_TRANSACTIONS (6% idx hit — no tenant_id, uses wallet_id)
CREATE INDEX IF NOT EXISTS idx_wallet_txn_wallet ON public.wallet_transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_created ON public.wallet_transactions (wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_type ON public.wallet_transactions (wallet_id, type);

-- TENANT_WALLETS
CREATE INDEX IF NOT EXISTS idx_tenant_wallets_status ON public.tenant_wallets (tenant_id, status);

-- SUBSCRIPTIONS
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON public.subscriptions (plan_id);

-- JOURNAL_ENTRIES (0% idx hit)
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant ON public.journal_entries (tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries (tenant_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON public.journal_entries (tenant_id, status);

-- JOURNAL_ENTRY_LINES (0% idx hit)
CREATE INDEX IF NOT EXISTS idx_jel_tenant ON public.journal_entry_lines (tenant_id);
CREATE INDEX IF NOT EXISTS idx_jel_entry ON public.journal_entry_lines (journal_entry_id);

-- STOCK_MOVEMENTS (0% idx hit)
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements (tenant_id, movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements (product_id);

-- BUDGET_LINES
CREATE INDEX IF NOT EXISTS idx_budget_lines_tenant ON public.budget_lines (tenant_id);

-- BUDGET_ACTUALS_CACHE
CREATE INDEX IF NOT EXISTS idx_bac_budget ON public.budget_actuals_cache (budget_id);

-- CREDIT_NOTES (0% idx hit)
CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant ON public.credit_notes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON public.credit_notes (tenant_id, status);

-- DELIVERY_NOTES (0% idx hit)
CREATE INDEX IF NOT EXISTS idx_delivery_notes_tenant ON public.delivery_notes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_status ON public.delivery_notes (tenant_id, status);

-- PURCHASE_ORDERS (0% idx hit)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON public.purchase_orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders (tenant_id, status);

-- SALES_ORDERS (0% idx hit)
CREATE INDEX IF NOT EXISTS idx_sales_orders_tenant ON public.sales_orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders (tenant_id, status);

-- CONTRACTS
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts (tenant_id, status);

-- QUOTATIONS
CREATE INDEX IF NOT EXISTS idx_quotations_created ON public.quotations (tenant_id, created_at DESC);

-- CUSTOMERS (partial)
CREATE INDEX IF NOT EXISTS idx_customers_active ON public.customers (tenant_id, is_active) WHERE is_active = true;
