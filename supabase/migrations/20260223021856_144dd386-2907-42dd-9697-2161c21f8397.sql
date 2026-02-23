
-- Add missing columns to whatsapp_message_log for interactive buttons + better tracking
ALTER TABLE public.whatsapp_message_log
  ADD COLUMN IF NOT EXISTS event_key text,
  ADD COLUMN IF NOT EXISTS recipient_type text DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS recipient_id uuid,
  ADD COLUMN IF NOT EXISTS buttons_payload jsonb,
  ADD COLUMN IF NOT EXISTS provider_status_payload jsonb;

-- Create status history table for granular tracking
CREATE TABLE IF NOT EXISTS public.notification_message_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  message_id uuid NOT NULL REFERENCES public.whatsapp_message_log(id) ON DELETE CASCADE,
  status text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  provider_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nmsh_message_id ON public.notification_message_status_history(message_id);
CREATE INDEX IF NOT EXISTS idx_nmsh_tenant_created ON public.notification_message_status_history(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wml_event_key ON public.whatsapp_message_log(event_key);
CREATE INDEX IF NOT EXISTS idx_wml_tenant_status ON public.whatsapp_message_log(tenant_id, status);

-- Enable RLS
ALTER TABLE public.notification_message_status_history ENABLE ROW LEVEL SECURITY;

-- RLS: tenant isolation for status history
CREATE POLICY "Tenant members can view own status history"
  ON public.notification_message_status_history
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
    )
  );

-- Platform admins can see all (for admin dashboard)
CREATE POLICY "Platform admins can view all status history"
  ON public.notification_message_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid())
  );

-- Service role insert only (from edge functions)
CREATE POLICY "Service role can insert status history"
  ON public.notification_message_status_history
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Enable realtime for status history
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_message_status_history;
