
-- Transactional Email Logs table
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID,
  email_type TEXT NOT NULL, -- account_activation, security_alert, invoice, payment_receipt, service_purchase, integration_activation, financial_notification, admin_alert
  sender_address TEXT NOT NULL DEFAULT 'no-reply@numaxio.com',
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, retrying
  provider_id TEXT, -- Resend message ID
  provider_response JSONB,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_retry_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}',
  entity_type TEXT, -- invoice, expense, subscription, integration, etc.
  entity_id UUID,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by tenant
CREATE INDEX idx_email_logs_tenant ON public.email_logs(tenant_id);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_type ON public.email_logs(email_type);
CREATE INDEX idx_email_logs_entity ON public.email_logs(entity_type, entity_id);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins can see all logs
CREATE POLICY "Platform admins can view all email logs"
ON public.email_logs FOR SELECT
TO authenticated
USING (public.is_platform_admin());

-- Tenant admins can view their own logs
CREATE POLICY "Tenant admins can view tenant email logs"
ON public.email_logs FOR SELECT
TO authenticated
USING (public.is_tenant_admin(tenant_id));

-- Service role inserts (edge functions use service role)
CREATE POLICY "Service role can insert email logs"
ON public.email_logs FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update email logs"
ON public.email_logs FOR UPDATE
TO service_role
USING (true);
