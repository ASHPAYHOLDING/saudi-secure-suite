
-- Performance indexes for enterprise scaling
-- Using IF NOT EXISTS to prevent duplicates

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON public.audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant_ref
  ON public.invoice_payments (tenant_id, reference_number);

CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_session
  ON public.payment_intents (provider_session_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_created
  ON public.journal_entries (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_status
  ON public.webhook_events (tenant_id, status);
