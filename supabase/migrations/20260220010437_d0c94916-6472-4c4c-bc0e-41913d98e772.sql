
-- ============================================================
-- Harden webhook_events table for BYO-Gateway security
-- ============================================================

-- 1. Add missing columns (idempotent)
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS provider_event_id text,
  ADD COLUMN IF NOT EXISTS signature_valid boolean,
  ADD COLUMN IF NOT EXISTS payload_hash text,
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS raw_headers jsonb;

-- 2. Rename event_id -> provider_event_id data migration
--    (event_id already exists; populate provider_event_id from it)
UPDATE public.webhook_events
SET provider_event_id = event_id
WHERE provider_event_id IS NULL AND event_id IS NOT NULL;

-- 3. Make provider_event_id NOT NULL after backfill
ALTER TABLE public.webhook_events
  ALTER COLUMN provider_event_id SET DEFAULT '';

-- 4. Update status check to include new statuses (drop old, add new)
ALTER TABLE public.webhook_events DROP CONSTRAINT IF EXISTS webhook_events_status_check;
ALTER TABLE public.webhook_events
  ADD CONSTRAINT webhook_events_status_check
  CHECK (status IN ('received','processing','processed','rejected','failed','duplicate'));

-- 5. Migrate old statuses to new ones
UPDATE public.webhook_events SET status = 'processed' WHERE status = 'completed';

-- 6. Add unique constraint on (provider, provider_event_id) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'webhook_events_provider_event_id_unique'
  ) THEN
    -- Remove duplicates first
    DELETE FROM public.webhook_events a
    USING public.webhook_events b
    WHERE a.id < b.id
      AND a.provider = b.provider
      AND a.provider_event_id = b.provider_event_id
      AND a.provider_event_id IS NOT NULL
      AND a.provider_event_id != '';

    ALTER TABLE public.webhook_events
      ADD CONSTRAINT webhook_events_provider_event_id_unique
      UNIQUE (provider, provider_event_id);
  END IF;
END $$;

-- 7. Index for tenant timeline
CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_timeline
  ON public.webhook_events (tenant_id, received_at DESC);

-- 8. Index for status filtering
CREATE INDEX IF NOT EXISTS idx_webhook_events_status
  ON public.webhook_events (status, received_at DESC);

-- 9. Index for provider filtering
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider
  ON public.webhook_events (provider, received_at DESC);

-- 10. RLS: enable and restrict to service_role (webhooks written by edge functions only)
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Platform admins can read all webhook events
DROP POLICY IF EXISTS "webhook_events_admin_read" ON public.webhook_events;
CREATE POLICY "webhook_events_admin_read" ON public.webhook_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
    )
  );

-- Tenant members can read their own tenant's events
DROP POLICY IF EXISTS "webhook_events_tenant_read" ON public.webhook_events;
CREATE POLICY "webhook_events_tenant_read" ON public.webhook_events
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

-- Service role bypass handled automatically by Supabase (service_role bypasses RLS)

-- 11. processed_at: make nullable (it starts as null until actually processed)
ALTER TABLE public.webhook_events ALTER COLUMN processed_at DROP NOT NULL;
ALTER TABLE public.webhook_events ALTER COLUMN processed_at DROP DEFAULT;
