
-- ============================================================
-- SECURITY HARDENING: Add RESTRICTIVE authentication gate
-- to ALL tenant-scoped tables. This ensures that even if 
-- permissive policies use {public} role, anonymous users
-- are completely blocked.
-- ============================================================

-- Helper: Create restrictive auth policy on a table
-- We'll add it to every table that has public-role policies

-- 1. Core Business Tables
CREATE POLICY "require_auth" ON public.profiles AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.tenants AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.branches AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.customers AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.suppliers AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Financial Documents
CREATE POLICY "require_auth" ON public.invoices AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.invoice_items AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.expenses AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.quotations AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.quotation_items AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.purchase_orders AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.purchase_order_items AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.sales_orders AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.sales_order_items AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.credit_notes AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.credit_note_items AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.journal_entries AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.journal_entry_lines AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Inventory & Products
CREATE POLICY "require_auth" ON public.products AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.inventory_balances AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Contracts
CREATE POLICY "require_auth" ON public.contracts AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Payments & Wallet
CREATE POLICY "require_auth" ON public.paylink_transactions AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.wallet_transactions AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.tenant_wallets AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 6. KYC & Sensitive
CREATE POLICY "require_auth" ON public.paylink_kyc_requests AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.paylink_kyc_documents AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.zatca_certificates AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Support & Subscriptions
CREATE POLICY "require_auth" ON public.support_tickets AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.subscription_upgrade_requests AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 8. Affiliates
CREATE POLICY "require_auth" ON public.affiliates AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.affiliate_commissions AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.affiliate_payouts AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.affiliate_referrals AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.affiliate_fraud_attempts AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 9. Delivery Notes
CREATE POLICY "require_auth" ON public.delivery_notes AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.delivery_note_items AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 10. Other sensitive tables
CREATE POLICY "require_auth" ON public.contract_templates AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.contract_versions AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.invoice_payments AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.invoice_delivery_log AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.invoice_templates AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.invoice_message_templates AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.payment_links AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.departments AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.custom_roles AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.role_permissions AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.audit_logs AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.document_lifecycle AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.document_access_tokens AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.currency_rates AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.customer_activities AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.entity_comments AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.collaboration_notifications AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.chat_channels AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.chat_messages AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.approval_workflows AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.approval_workflow_steps AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.approval_requests AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.approval_actions AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.budgets AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.budget_lines AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.budget_alert_rules AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.budget_alert_events AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.budget_actuals_cache AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.security_events AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.email_logs AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.branch_members AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.notification_preferences AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.period_locks AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.stock_movements AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.goods_receipts AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.goods_receipt_items AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.product_batches AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.product_variants AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.inventory_movements AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.payment_reminder_schedules AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.payment_reminder_logs AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.custom_report_configs AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.report_presets AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.report_versions AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.reconciliation_runs AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.reconciliation_issues AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.paid_integrations AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.paid_gateway_transactions AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.integration_sync_logs AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.ocr_usage_logs AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.paylink_fee_configs AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.paylink_fee_logs AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.paylink_payout_settings AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.paylink_payouts AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.account_locks AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.expense_categories AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.analytics_definitions AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.intercompany_links AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "require_auth" ON public.group_admins AS RESTRICTIVE FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Note: Keeping these tables WITHOUT restrictive policy as they need anon access:
-- plan_entitlements (public read for pricing page)
-- feature_flags (public read for feature checks)
-- email_template_definitions (already has authenticated-only policies)
-- email_template_versions (already has authenticated-only policies)
-- platform_admins (system table)
-- platform_notifications (system table)
-- platform_templates (system table)
-- permission_definitions (reference data)
-- permission_templates (reference data)
-- subscriptions (may need service role access)
-- tenant_members (handled separately)
-- stocktake_items / stocktakes (check separately)
