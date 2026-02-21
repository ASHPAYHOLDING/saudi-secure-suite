
-- Login attempts tracking table
CREATE TABLE public.login_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT
);

CREATE INDEX idx_login_attempts_email ON public.login_attempts (email, attempted_at DESC);
CREATE INDEX idx_login_attempts_ip ON public.login_attempts (ip_address, attempted_at DESC);

-- Auto-cleanup old attempts (> 24h)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.login_attempts WHERE attempted_at < now() - interval '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_cleanup_login_attempts
  AFTER INSERT ON public.login_attempts
  FOR EACH STATEMENT EXECUTE FUNCTION public.cleanup_old_login_attempts();

-- RLS: service_role only (edge function writes, no direct client access)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on login_attempts"
  ON public.login_attempts FOR ALL
  USING (true) WITH CHECK (true);

-- Function to check if an account is locked (5 failed in 10 min)
CREATE OR REPLACE FUNCTION public.check_account_locked(p_email TEXT)
RETURNS BOOLEAN AS $$
  SELECT COUNT(*) >= 5
  FROM public.login_attempts
  WHERE email = p_email
    AND success = false
    AND attempted_at > now() - interval '10 minutes';
$$ LANGUAGE sql STABLE SET search_path = public;

-- Revoke from public, grant to service_role
REVOKE EXECUTE ON FUNCTION public.check_account_locked FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_account_locked TO service_role;
