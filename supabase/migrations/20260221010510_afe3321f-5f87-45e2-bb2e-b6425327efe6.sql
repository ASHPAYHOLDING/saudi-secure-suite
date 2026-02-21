
-- Finance Events table (append-only event store)
CREATE TABLE public.finance_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  aggregate_type TEXT NOT NULL CHECK (aggregate_type IN ('invoice','wallet','journal')),
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hash_prev TEXT NOT NULL DEFAULT '',
  hash_current TEXT NOT NULL DEFAULT ''
);

-- Prevent UPDATE/DELETE on finance_events (immutable ledger)
CREATE OR REPLACE FUNCTION public.deny_finance_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'finance_events is immutable – updates and deletes are forbidden';
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_deny_update_finance_events
  BEFORE UPDATE ON public.finance_events
  FOR EACH ROW EXECUTE FUNCTION public.deny_finance_event_mutation();

CREATE TRIGGER trg_deny_delete_finance_events
  BEFORE DELETE ON public.finance_events
  FOR EACH ROW EXECUTE FUNCTION public.deny_finance_event_mutation();

-- Auto-compute hash chain on INSERT
CREATE OR REPLACE FUNCTION public.compute_finance_event_hash()
RETURNS TRIGGER AS $$
DECLARE
  v_prev_hash TEXT;
BEGIN
  -- Get the hash of the previous event for this aggregate
  SELECT hash_current INTO v_prev_hash
  FROM public.finance_events
  WHERE tenant_id = NEW.tenant_id
    AND aggregate_type = NEW.aggregate_type
    AND aggregate_id = NEW.aggregate_id
  ORDER BY created_at DESC
  LIMIT 1;

  NEW.hash_prev := COALESCE(v_prev_hash, '');
  NEW.hash_current := encode(
    sha256(
      convert_to(
        NEW.hash_prev || NEW.payload_json::text || NEW.created_at::text,
        'UTF8'
      )
    ),
    'hex'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_compute_finance_event_hash
  BEFORE INSERT ON public.finance_events
  FOR EACH ROW EXECUTE FUNCTION public.compute_finance_event_hash();

-- RLS
ALTER TABLE public.finance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view finance events"
  ON public.finance_events FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can insert finance events"
  ON public.finance_events FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_fe_aggregate ON public.finance_events (tenant_id, aggregate_type, aggregate_id, created_at);
CREATE INDEX idx_fe_tenant_time ON public.finance_events (tenant_id, created_at DESC);

-- Trigger: auto-emit event on invoice_payments insert
CREATE OR REPLACE FUNCTION public.emit_payment_finance_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.finance_events (tenant_id, aggregate_type, aggregate_id, event_type, payload_json, created_by)
  VALUES (
    NEW.tenant_id,
    'invoice',
    NEW.invoice_id,
    'payment_recorded',
    jsonb_build_object(
      'payment_id', NEW.id,
      'amount', NEW.amount,
      'method', NEW.payment_method,
      'reference', NEW.reference_number,
      'payment_date', NEW.payment_date
    ),
    COALESCE(auth.uid(), NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_payment_finance_event
  AFTER INSERT ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.emit_payment_finance_event();

-- Trigger: auto-emit event on wallet_transactions insert
CREATE OR REPLACE FUNCTION public.emit_wallet_finance_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.finance_events (tenant_id, aggregate_type, aggregate_id, event_type, payload_json, created_by)
  VALUES (
    NEW.tenant_id,
    'wallet',
    NEW.wallet_id,
    NEW.type || '_recorded',
    jsonb_build_object(
      'transaction_id', NEW.id,
      'amount', NEW.amount,
      'type', NEW.type,
      'balance_before', NEW.balance_before,
      'balance_after', NEW.balance_after,
      'description', NEW.description
    ),
    COALESCE(auth.uid(), NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_wallet_finance_event
  AFTER INSERT ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.emit_wallet_finance_event();

-- Trigger: auto-emit event on journal_entries insert
CREATE OR REPLACE FUNCTION public.emit_journal_finance_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.finance_events (tenant_id, aggregate_type, aggregate_id, event_type, payload_json, created_by)
  VALUES (
    NEW.tenant_id,
    'journal',
    NEW.id,
    'journal_' || NEW.status,
    jsonb_build_object(
      'entry_number', NEW.entry_number,
      'description', NEW.description,
      'total_debit', NEW.total_debit,
      'total_credit', NEW.total_credit,
      'reference_type', NEW.reference_type,
      'reference_id', NEW.reference_id
    ),
    COALESCE(auth.uid(), NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_journal_finance_event
  AFTER INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.emit_journal_finance_event();

-- Verification function: check hash chain integrity for an aggregate
CREATE OR REPLACE FUNCTION public.verify_finance_event_chain(
  p_tenant_id UUID,
  p_aggregate_type TEXT,
  p_aggregate_id UUID
)
RETURNS TABLE(event_id UUID, is_valid BOOLEAN, expected_hash TEXT, actual_hash TEXT) AS $$
DECLARE
  r RECORD;
  v_prev_hash TEXT := '';
  v_expected TEXT;
BEGIN
  FOR r IN
    SELECT id, payload_json, created_at, hash_prev, hash_current
    FROM public.finance_events
    WHERE tenant_id = p_tenant_id
      AND aggregate_type = p_aggregate_type
      AND aggregate_id = p_aggregate_id
    ORDER BY created_at ASC
  LOOP
    v_expected := encode(sha256(convert_to(v_prev_hash || r.payload_json::text || r.created_at::text, 'UTF8')), 'hex');

    event_id := r.id;
    actual_hash := r.hash_current;
    expected_hash := v_expected;
    is_valid := (r.hash_prev = v_prev_hash AND r.hash_current = v_expected);

    RETURN NEXT;

    v_prev_hash := r.hash_current;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;
