
-- =============================================
-- Enhance notification_event_outbox with idempotency + retry fields
-- =============================================

-- Add new columns
ALTER TABLE public.notification_event_outbox
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Add unique constraint for idempotency
ALTER TABLE public.notification_event_outbox
  ADD CONSTRAINT uq_outbox_idempotency UNIQUE (tenant_id, idempotency_key, channel);

-- Add indexes for worker processing
CREATE INDEX IF NOT EXISTS idx_outbox_worker_queue
  ON public.notification_event_outbox (status, next_attempt_at)
  WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_outbox_tenant_created
  ON public.notification_event_outbox (tenant_id, created_at DESC);

-- =============================================
-- RPC: claim_outbox_batch — atomic row locking for worker
-- =============================================
CREATE OR REPLACE FUNCTION public.claim_outbox_batch(p_limit INT DEFAULT 50)
RETURNS SETOF public.notification_event_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE notification_event_outbox
  SET status = 'running'::text
  WHERE id IN (
    SELECT id FROM notification_event_outbox
    WHERE (status = 'queued' OR (status = 'failed' AND (next_attempt_at IS NULL OR next_attempt_at <= now())))
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING *;
END;
$$;
