
-- Rate limiting table for sliding window tracking
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count int NOT NULL DEFAULT 1,
  blocked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on key for upsert
CREATE UNIQUE INDEX idx_rate_limits_key ON public.rate_limits (key);

-- Index for cleanup
CREATE INDEX idx_rate_limits_window ON public.rate_limits (window_start);

-- Enable RLS but allow service role only
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No public policies - only service_role can access
CREATE POLICY "service_role_only" ON public.rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Restrictive policy to block anon/authenticated
CREATE POLICY "deny_all_public" ON public.rate_limits
  AS RESTRICTIVE FOR ALL TO public USING (false);

-- RPC function for atomic rate limit check
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max_requests int,
  p_window_seconds int DEFAULT 60,
  p_block_seconds int DEFAULT 900
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record rate_limits%ROWTYPE;
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_is_blocked boolean := false;
  v_remaining int;
BEGIN
  -- Calculate window start
  v_window_start := v_now - (p_window_seconds || ' seconds')::interval;

  -- Try to get existing record
  SELECT * INTO v_record FROM rate_limits WHERE key = p_key FOR UPDATE;

  IF v_record IS NULL THEN
    -- First request - insert new record
    INSERT INTO rate_limits (key, window_start, request_count, blocked_until)
    VALUES (p_key, v_now, 1, NULL);
    
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max_requests - 1,
      'blocked', false,
      'retry_after', 0
    );
  END IF;

  -- Check if currently blocked
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'blocked', true,
      'retry_after', EXTRACT(EPOCH FROM (v_record.blocked_until - v_now))::int
    );
  END IF;

  -- If blocked period expired, reset
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until <= v_now THEN
    UPDATE rate_limits 
    SET window_start = v_now, request_count = 1, blocked_until = NULL, updated_at = v_now
    WHERE key = p_key;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max_requests - 1,
      'blocked', false,
      'retry_after', 0
    );
  END IF;

  -- Check if window expired - reset counter
  IF v_record.window_start < v_window_start THEN
    UPDATE rate_limits 
    SET window_start = v_now, request_count = 1, updated_at = v_now
    WHERE key = p_key;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max_requests - 1,
      'blocked', false,
      'retry_after', 0
    );
  END IF;

  -- Within window - check count
  IF v_record.request_count >= p_max_requests THEN
    -- Block the key
    UPDATE rate_limits 
    SET blocked_until = v_now + (p_block_seconds || ' seconds')::interval, updated_at = v_now
    WHERE key = p_key;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'blocked', true,
      'retry_after', p_block_seconds
    );
  END IF;

  -- Increment counter
  v_remaining := p_max_requests - v_record.request_count - 1;
  UPDATE rate_limits 
  SET request_count = request_count + 1, updated_at = v_now
  WHERE key = p_key;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', v_remaining,
    'blocked', false,
    'retry_after', 0
  );
END;
$$;

-- Cleanup function to remove stale records (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limits 
  WHERE updated_at < now() - interval '1 hour'
    AND (blocked_until IS NULL OR blocked_until < now());
END;
$$;
