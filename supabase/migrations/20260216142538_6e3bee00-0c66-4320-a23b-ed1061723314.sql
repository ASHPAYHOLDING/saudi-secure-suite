
-- Security events table for login attempts, suspicious behavior, device/IP tracking
CREATE TABLE public.security_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  ip_address text,
  user_agent text,
  device_info jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  description text NOT NULL DEFAULT '',
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  resolution_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for searchability
CREATE INDEX idx_security_events_user ON public.security_events(user_id);
CREATE INDEX idx_security_events_type ON public.security_events(event_type);
CREATE INDEX idx_security_events_severity ON public.security_events(severity);
CREATE INDEX idx_security_events_created ON public.security_events(created_at DESC);
CREATE INDEX idx_security_events_ip ON public.security_events(ip_address);

-- Account locks table
CREATE TABLE public.account_locks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  locked_by uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  locked_at timestamp with time zone NOT NULL DEFAULT now(),
  unlocked_at timestamp with time zone,
  unlocked_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(user_id, is_active)
);

CREATE INDEX idx_account_locks_user ON public.account_locks(user_id);
CREATE INDEX idx_account_locks_active ON public.account_locks(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_locks ENABLE ROW LEVEL SECURITY;

-- Security events policies (immutable - no UPDATE/DELETE for anyone)
CREATE POLICY "Platform admins can view all security events"
  ON public.security_events FOR SELECT USING (is_platform_admin());

CREATE POLICY "Platform admins can insert security events"
  ON public.security_events FOR INSERT WITH CHECK (is_platform_admin());

CREATE POLICY "Platform admins can resolve security events"
  ON public.security_events FOR UPDATE USING (is_platform_admin());

-- Account locks policies
CREATE POLICY "Platform admins can view all locks"
  ON public.account_locks FOR SELECT USING (is_platform_admin());

CREATE POLICY "Platform admins can create locks"
  ON public.account_locks FOR INSERT WITH CHECK (is_platform_admin());

CREATE POLICY "Platform admins can update locks"
  ON public.account_locks FOR UPDATE USING (is_platform_admin());

-- Also index audit_logs for better search
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type);
