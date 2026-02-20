
-- Fix: Drop duplicate policies only if they exist, then create missing ones

-- 1) marketing_integrations (new unified table)
CREATE TABLE IF NOT EXISTS public.marketing_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  environment text NOT NULL DEFAULT 'live',
  config jsonb NOT NULL DEFAULT '{}',
  secrets_encrypted text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_integrations_tenant_provider_unique UNIQUE (tenant_id, provider)
);

ALTER TABLE public.marketing_integrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='marketing_integrations' AND policyname='marketing_integrations_select_own') THEN
    CREATE POLICY "marketing_integrations_select_own" ON public.marketing_integrations FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='marketing_integrations' AND policyname='marketing_integrations_insert_own') THEN
    CREATE POLICY "marketing_integrations_insert_own" ON public.marketing_integrations FOR INSERT
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='marketing_integrations' AND policyname='marketing_integrations_update_own') THEN
    CREATE POLICY "marketing_integrations_update_own" ON public.marketing_integrations FOR UPDATE
    USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='marketing_integrations' AND policyname='marketing_integrations_delete_own') THEN
    CREATE POLICY "marketing_integrations_delete_own" ON public.marketing_integrations FOR DELETE
    USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='marketing_integrations' AND policyname='marketing_integrations_service_role') THEN
    CREATE POLICY "marketing_integrations_service_role" ON public.marketing_integrations
    USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 2) marketing_events_logs — add missing columns if needed
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='marketing_events_logs' AND column_name='action') THEN
    ALTER TABLE public.marketing_events_logs ADD COLUMN action text DEFAULT 'send_event';
  END IF;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='marketing_events_logs' AND column_name='request_body') THEN
    ALTER TABLE public.marketing_events_logs ADD COLUMN request_body jsonb;
  END IF;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='marketing_events_logs' AND column_name='idempotency_key') THEN
    ALTER TABLE public.marketing_events_logs ADD COLUMN idempotency_key text;
  END IF;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='marketing_events_logs' AND column_name='environment') THEN
    ALTER TABLE public.marketing_events_logs ADD COLUMN environment text DEFAULT 'live';
  END IF;
END $$;

-- Fix policies on marketing_events_logs (drop old service_role if broken)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='marketing_events_logs' AND policyname='marketing_events_logs_select_own') THEN
    CREATE POLICY "marketing_events_logs_select_own" ON public.marketing_events_logs FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='marketing_events_logs' AND policyname='marketing_events_logs_insert_own') THEN
    CREATE POLICY "marketing_events_logs_insert_own" ON public.marketing_events_logs FOR INSERT
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
  END IF;
END $$;

-- 3) marketing_idempotency
CREATE TABLE IF NOT EXISTS public.marketing_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_idempotency_unique UNIQUE (tenant_id, provider, idempotency_key)
);

ALTER TABLE public.marketing_idempotency ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='marketing_idempotency' AND policyname='marketing_idempotency_select_own') THEN
    CREATE POLICY "marketing_idempotency_select_own" ON public.marketing_idempotency FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='marketing_idempotency' AND policyname='marketing_idempotency_insert_own') THEN
    CREATE POLICY "marketing_idempotency_insert_own" ON public.marketing_idempotency FOR INSERT
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='marketing_idempotency' AND policyname='marketing_idempotency_service_role') THEN
    CREATE POLICY "marketing_idempotency_service_role" ON public.marketing_idempotency
    USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 4) Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_marketing_integrations_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trigger_marketing_integrations_updated_at ON public.marketing_integrations;
CREATE TRIGGER trigger_marketing_integrations_updated_at
  BEFORE UPDATE ON public.marketing_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_marketing_integrations_updated_at();

-- 5) Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_idempotency_created ON public.marketing_idempotency(created_at);
CREATE INDEX IF NOT EXISTS idx_marketing_events_logs_tenant_provider ON public.marketing_events_logs(tenant_id, provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_integrations_tenant_provider ON public.marketing_integrations(tenant_id, provider);
