
-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Event-Driven Core Engine: Infrastructure & Auto-Emitters    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── 1. Enhance domain_events with retry tracking ────────────────
ALTER TABLE public.domain_events
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_events_idempotency
  ON public.domain_events(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_domain_events_retry
  ON public.domain_events(next_retry_at) WHERE NOT processed AND next_retry_at IS NOT NULL;

-- ── 2. Dead Letter Queue ────────────────────────────────────────
CREATE TABLE public.dead_letter_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_event_id uuid NOT NULL REFERENCES public.domain_events(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  domain text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  failed_at timestamptz NOT NULL DEFAULT now(),
  reprocessed boolean NOT NULL DEFAULT false,
  reprocessed_at timestamptz
);

ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation on dlq"
  ON public.dead_letter_queue FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX idx_dlq_tenant ON public.dead_letter_queue(tenant_id, failed_at DESC);
CREATE INDEX idx_dlq_unprocessed ON public.dead_letter_queue(reprocessed, failed_at) WHERE NOT reprocessed;

-- ── 3. Event Subscriber Registry ────────────────────────────────
CREATE TABLE public.event_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  event_type text NOT NULL,
  handler_name text NOT NULL,
  handler_config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain, event_type, handler_name)
);

ALTER TABLE public.event_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role access on subscribers"
  ON public.event_subscribers FOR ALL
  USING (true) WITH CHECK (true);

-- Seed core subscribers (decoupling invoice→wallet, payment→journal, workflow→approval)
INSERT INTO event_subscribers (domain, event_type, handler_name, handler_config, priority) VALUES
  ('billing',     'invoice_created',    'notify_crm',            '{"action":"log_activity"}',  100),
  ('billing',     'invoice_approved',   'create_journal_entry',  '{"auto_post":false}',         10),
  ('billing',     'invoice_approved',   'update_wallet_balance', '{"direction":"inflow"}',       20),
  ('billing',     'invoice_approved',   'send_notification',     '{"channel":"in_app"}',        100),
  ('accounting',  'journal_posted',     'update_trial_balance',  '{}',                           10),
  ('accounting',  'journal_posted',     'check_budget_alerts',   '{}',                           50),
  ('accounting',  'period_closed',      'generate_closing_report','{}',                          10),
  ('crm',         'customer_created',   'send_welcome',          '{"channel":"email"}',         100),
  ('inventory',   'stock_adjusted',     'check_reorder_level',   '{}',                           10),
  ('inventory',   'stock_adjusted',     'log_stock_movement',    '{}',                           50),
  ('governance',  'violation_logged',   'notify_admins',         '{"severity_threshold":"high"}', 10),
  ('governance',  'workflow_approved',  'execute_post_approval', '{}',                           10),
  ('governance',  'workflow_rejected',  'notify_requester',      '{}',                           10),
  ('hr',          'member_invited',     'send_invite_email',     '{}',                           10)
ON CONFLICT DO NOTHING;

-- ── 4. Move-to-DLQ function ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.move_to_dead_letter(p_event_id uuid, p_error text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO dead_letter_queue (original_event_id, tenant_id, domain, event_type, payload, error_message, retry_count)
  SELECT id, tenant_id, domain, event_type, payload, p_error, retry_count
  FROM domain_events WHERE id = p_event_id;

  UPDATE domain_events
  SET processed = true, processed_at = now(), last_error = p_error
  WHERE id = p_event_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.move_to_dead_letter FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_to_dead_letter TO service_role;

-- ── 5. Claim events for processing (atomic, skip-locked) ───────
CREATE OR REPLACE FUNCTION public.claim_pending_events(p_batch_size integer DEFAULT 20)
RETURNS SETOF domain_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE domain_events
  SET retry_count = retry_count + 1,
      next_retry_at = NULL
  WHERE id IN (
    SELECT id FROM domain_events
    WHERE NOT processed
      AND (next_retry_at IS NULL OR next_retry_at <= now())
      AND retry_count < max_retries
    ORDER BY created_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_pending_events FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_events TO service_role;

-- ── 6. Mark event processed or schedule retry ──────────────────
CREATE OR REPLACE FUNCTION public.resolve_event(
  p_event_id uuid,
  p_success boolean,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_retry_count integer;
  v_max_retries integer;
BEGIN
  SELECT retry_count, max_retries INTO v_retry_count, v_max_retries
  FROM domain_events WHERE id = p_event_id;

  IF p_success THEN
    UPDATE domain_events SET processed = true, processed_at = now() WHERE id = p_event_id;
  ELSIF v_retry_count >= v_max_retries THEN
    PERFORM move_to_dead_letter(p_event_id, COALESCE(p_error, 'Max retries exceeded'));
  ELSE
    -- Exponential backoff: 2^retry * 10 seconds
    UPDATE domain_events
    SET last_error = p_error,
        next_retry_at = now() + (power(2, v_retry_count) * interval '10 seconds')
    WHERE id = p_event_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_event FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_event TO service_role;

-- ── 7. Get subscribers for an event ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_event_subscribers(p_domain text, p_event_type text)
RETURNS SETOF event_subscribers
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM event_subscribers
  WHERE domain = p_domain AND event_type = p_event_type AND is_active
  ORDER BY priority;
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_subscribers FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_subscribers TO service_role;

-- ── 8. Auto-emit triggers on critical tables ───────────────────

-- 8a. Invoice status changes → billing domain events
CREATE OR REPLACE FUNCTION public.trg_invoice_domain_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM publish_domain_event(
      NEW.tenant_id, 'billing', 'invoice_created',
      jsonb_build_object('invoice_id', NEW.id, 'number', NEW.invoice_number, 'total', NEW.total, 'status', NEW.status),
      NEW.id::text, 'invoice',
      NULL
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM publish_domain_event(
      NEW.tenant_id, 'billing', 'invoice_' || NEW.status,
      jsonb_build_object('invoice_id', NEW.id, 'number', NEW.invoice_number, 'total', NEW.total, 'old_status', OLD.status, 'new_status', NEW.status),
      NEW.id::text, 'invoice',
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_domain_event ON public.invoices;
CREATE TRIGGER trg_invoice_domain_event
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_domain_event();

-- 8b. Payments → billing.payment_completed
CREATE OR REPLACE FUNCTION public.trg_payment_domain_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM publish_domain_event(
      NEW.tenant_id, 'billing', 'payment_' || COALESCE(NEW.status, 'completed'),
      jsonb_build_object('payment_id', NEW.id, 'invoice_id', NEW.invoice_id, 'amount', NEW.amount, 'method', NEW.payment_method),
      NEW.id::text, 'payment',
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_domain_event ON public.invoice_payments;
CREATE TRIGGER trg_payment_domain_event
  AFTER INSERT OR UPDATE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_payment_domain_event();

-- 8c. Journal entries posted → accounting.journal_posted
CREATE OR REPLACE FUNCTION public.trg_journal_domain_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'posted' THEN
    PERFORM publish_domain_event(
      NEW.tenant_id, 'accounting', 'journal_posted',
      jsonb_build_object('journal_id', NEW.id, 'entry_number', NEW.entry_number, 'total_debit', NEW.total_debit),
      NEW.id::text, 'journal_entry',
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_domain_event ON public.journal_entries;
CREATE TRIGGER trg_journal_domain_event
  AFTER UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.trg_journal_domain_event();

-- 8d. Approval actions → governance.workflow_approved / rejected
CREATE OR REPLACE FUNCTION public.trg_approval_domain_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req record;
BEGIN
  IF NEW.action IN ('approved', 'rejected') THEN
    SELECT document_type, document_id, document_number, document_amount, tenant_id
    INTO v_req FROM approval_requests WHERE id = NEW.request_id;

    IF FOUND THEN
      PERFORM publish_domain_event(
        NEW.tenant_id, 'governance', 'workflow_' || NEW.action,
        jsonb_build_object(
          'request_id', NEW.request_id, 'action_id', NEW.id,
          'document_type', v_req.document_type, 'document_id', v_req.document_id,
          'document_number', v_req.document_number, 'amount', v_req.document_amount,
          'acted_by', NEW.acted_by
        ),
        NEW.request_id::text, 'approval_request',
        NULL
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approval_domain_event ON public.approval_actions;
CREATE TRIGGER trg_approval_domain_event
  AFTER INSERT OR UPDATE ON public.approval_actions
  FOR EACH ROW EXECUTE FUNCTION public.trg_approval_domain_event();

-- ── 9. DLQ query function ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_dead_letter_events(
  p_tenant_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS SETOF dead_letter_queue
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM dead_letter_queue
  WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    AND NOT reprocessed
  ORDER BY failed_at DESC
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dead_letter_events FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dead_letter_events TO service_role;

-- ── 10. Reprocess DLQ event ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reprocess_dead_letter(p_dlq_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dlq record;
  v_new_event_id uuid;
BEGIN
  SELECT * INTO v_dlq FROM dead_letter_queue WHERE id = p_dlq_id AND NOT reprocessed;
  IF NOT FOUND THEN RAISE EXCEPTION 'DLQ entry not found or already reprocessed'; END IF;

  -- Re-publish as new domain event
  v_new_event_id := publish_domain_event(
    v_dlq.tenant_id, v_dlq.domain, v_dlq.event_type, v_dlq.payload
  );

  UPDATE dead_letter_queue SET reprocessed = true, reprocessed_at = now() WHERE id = p_dlq_id;
  RETURN v_new_event_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reprocess_dead_letter FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reprocess_dead_letter TO service_role;
