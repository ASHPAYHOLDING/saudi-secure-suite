
-- 1. Enforce NOT NULL on reference_number
ALTER TABLE invoice_payments
ALTER COLUMN reference_number SET NOT NULL;

-- 2. Prevent duplicate payments per tenant
CREATE UNIQUE INDEX idx_invoice_payments_tenant_ref
ON invoice_payments (tenant_id, reference_number);

-- 3. Speed up payment_intents lookup by provider_session_id
CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_session_id
ON payment_intents (provider_session_id);
