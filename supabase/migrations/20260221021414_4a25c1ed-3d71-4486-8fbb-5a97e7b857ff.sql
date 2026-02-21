
-- Active sessions table
CREATE TABLE public.active_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ip_address TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_active_sessions_tenant ON public.active_sessions(tenant_id);
CREATE INDEX idx_active_sessions_user ON public.active_sessions(user_id);
CREATE INDEX idx_active_sessions_active ON public.active_sessions(tenant_id, revoked) WHERE revoked = false;

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Tenant members can view sessions in their org
CREATE POLICY "Tenant members can view sessions"
  ON public.active_sessions FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- Users can insert their own session
CREATE POLICY "Users can insert own session"
  ON public.active_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Owners can update (revoke) any session in tenant
CREATE POLICY "Owners can revoke sessions"
  ON public.active_sessions FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions"
  ON public.active_sessions FOR UPDATE
  USING (user_id = auth.uid());

-- Auth gate: block anon
CREATE POLICY "auth_gate_active_sessions"
  ON public.active_sessions AS RESTRICTIVE
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Audit trigger for revocations
CREATE OR REPLACE FUNCTION public.audit_session_revocation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.revoked = true AND (OLD.revoked IS DISTINCT FROM true) THEN
    INSERT INTO public.audit_logs (
      tenant_id, user_id, entity_type, entity_id, action, before_value, after_value, entity_label
    ) VALUES (
      NEW.tenant_id,
      COALESCE(auth.uid(), NEW.user_id),
      'active_sessions',
      NEW.id,
      'enterprise_session_revoked',
      jsonb_build_object('user_id', NEW.user_id, 'ip_address', NEW.ip_address, 'revoked', OLD.revoked),
      jsonb_build_object('user_id', NEW.user_id, 'ip_address', NEW.ip_address, 'revoked', true),
      'إلغاء جلسة مستخدم'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_session_revocation
  AFTER UPDATE ON public.active_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_session_revocation();

-- Function to auto-revoke timed-out sessions
CREATE OR REPLACE FUNCTION public.revoke_expired_sessions(p_tenant_id UUID)
RETURNS INTEGER AS $$
DECLARE
  timeout_min INT;
  revoked_count INT;
BEGIN
  SELECT session_timeout_minutes INTO timeout_min
  FROM public.enterprise_security_policies
  WHERE tenant_id = p_tenant_id;

  IF timeout_min IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.active_sessions
  SET revoked = true
  WHERE tenant_id = p_tenant_id
    AND revoked = false
    AND last_activity_at < now() - (timeout_min || ' minutes')::interval;

  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  RETURN revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.revoke_expired_sessions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_expired_sessions(UUID) TO service_role;
