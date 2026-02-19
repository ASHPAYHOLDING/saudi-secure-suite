
-- Webhook events dedupe table
CREATE TABLE public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  payload JSONB,
  provider_response JSONB,
  status TEXT NOT NULL DEFAULT 'processing',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_provider_event_unique UNIQUE (provider, event_id)
);

-- Index for fast lookups
CREATE INDEX idx_webhook_events_provider_event ON public.webhook_events (provider, event_id);
CREATE INDEX idx_webhook_events_tenant ON public.webhook_events (tenant_id);
CREATE INDEX idx_webhook_events_created ON public.webhook_events (created_at DESC);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service_role can access (no user-facing access needed)
-- No policies = deny all for anon/authenticated, service_role bypasses RLS
