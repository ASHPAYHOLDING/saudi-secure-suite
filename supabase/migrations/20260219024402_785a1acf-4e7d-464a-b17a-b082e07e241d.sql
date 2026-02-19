
-- ═══════════════════════════════════════════════════════════
-- SECURITY HARDENING: Revoke client-callable WRITE functions
-- Move all INSERT/UPDATE/DELETE functions to service_role only
-- ═══════════════════════════════════════════════════════════

-- ── Group 1: Inventory WRITE functions ──
REVOKE EXECUTE ON FUNCTION public.process_inventory_movement(uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, uuid, text, uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.process_inventory_movement(uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, uuid, text, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_stock_movement(uuid, uuid, text, numeric, text, uuid, text, uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(uuid, uuid, text, numeric, text, uuid, text, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.generate_inventory_number(uuid, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.generate_inventory_number(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reserve_stock_for_order(uuid, uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reserve_stock_for_order(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_stock_reservation(uuid, uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.release_stock_reservation(uuid, uuid) TO service_role;

-- ── Group 2: Financial / Budget WRITE functions ──
REVOKE EXECUTE ON FUNCTION public.activate_budget(uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.activate_budget(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.sync_budget_actuals_for_tenant(uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.sync_budget_actuals_for_tenant(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.apply_subscription_discount(text, uuid, uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.apply_subscription_discount(text, uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_document_access_token(uuid, text, uuid, integer, integer) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_document_access_token(uuid, text, uuid, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.encrypt_zatca_private_key(uuid, text, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.encrypt_zatca_private_key(uuid, text, text) TO service_role;

-- ── Group 3: Subscription / System WRITE functions ──
REVOKE EXECUTE ON FUNCTION public.check_subscription_integrity(uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_subscription_integrity(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.auto_activate_enterprise_integrations(uuid, uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auto_activate_enterprise_integrations(uuid, uuid) TO service_role;

-- ── Group 4: Affiliate WRITE functions ──
REVOKE EXECUTE ON FUNCTION public.request_affiliate_payout(uuid, text, uuid[]) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.request_affiliate_payout(uuid, text, uuid[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_affiliate_payout(uuid, text, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.process_affiliate_payout(uuid, text, text) TO service_role;

-- ── Group 5: Admin Wallet WRITE functions ──
REVOKE EXECUTE ON FUNCTION public.admin_review_topup_request(uuid, text, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_topup_request(uuid, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_set_wallet_status(uuid, text, uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_wallet_status(uuid, text, uuid) TO service_role;

-- ── Group 6: Reconciliation WRITE functions ──
REVOKE EXECUTE ON FUNCTION public.reconcile_invoices_vs_payments(uuid, date, date) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_invoices_vs_payments(uuid, date, date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reconcile_invoices_without_journals(uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_invoices_without_journals(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reconcile_subscription_revenue(uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_subscription_revenue(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reconcile_unbalanced_journals(uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_unbalanced_journals(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reconcile_vat_totals(uuid, date, date) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_vat_totals(uuid, date, date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reconcile_wallet_vs_journal(uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_wallet_vs_journal(uuid) TO service_role;

-- ── Group 7: Wallet transaction (internal - should only be called by other functions/edge) ──
REVOKE EXECUTE ON FUNCTION public.process_wallet_transaction(uuid, text, numeric, text, text, text, uuid, uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.process_wallet_transaction(uuid, text, numeric, text, text, text, uuid, uuid) TO service_role;
