
-- ══════════════════════════════════════════════
-- Enterprise: API Keys + Data Export Requests
-- ══════════════════════════════════════════════

-- 1. API Keys table for Public API access
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Key',
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- first 8 chars for display "nmx_abc1..."
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read:invoices','read:customers'],
  rate_limit_per_minute INT NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Only tenant admins can manage API keys
CREATE POLICY "Tenant members can view own api_keys"
  ON public.api_keys FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant admins can insert api_keys"
  ON public.api_keys FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant admins can update api_keys"
  ON public.api_keys FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant admins can delete api_keys"
  ON public.api_keys FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Auth gate
CREATE POLICY "api_keys_auth_gate" ON public.api_keys
  AS RESTRICTIVE FOR ALL TO anon USING (false);

-- 2. API request logs
CREATE TABLE public.api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  api_key_id UUID REFERENCES public.api_keys(id),
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INT NOT NULL,
  response_time_ms INT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view own api_request_logs"
  ON public.api_request_logs FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "api_request_logs_auth_gate" ON public.api_request_logs
  AS RESTRICTIVE FOR ALL TO anon USING (false);

-- Service role can insert logs
CREATE POLICY "service_role_insert_api_logs"
  ON public.api_request_logs FOR INSERT TO service_role
  WITH CHECK (true);

-- 3. Data export requests
CREATE TABLE public.data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  requested_by UUID NOT NULL,
  export_type TEXT NOT NULL DEFAULT 'full', -- 'full', 'audit', 'invoices', 'customers', 'expenses'
  format TEXT NOT NULL DEFAULT 'excel', -- 'excel', 'pdf', 'csv'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  filters JSONB DEFAULT '{}',
  file_url TEXT,
  file_size_bytes BIGINT,
  row_count INT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view own exports"
  ON public.data_export_requests FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant members can create exports"
  ON public.data_export_requests FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "data_export_auth_gate" ON public.data_export_requests
  AS RESTRICTIVE FOR ALL TO anon USING (false);

-- Index for API key lookups
CREATE INDEX idx_api_keys_prefix ON public.api_keys(key_prefix) WHERE is_active = true;
CREATE INDEX idx_api_request_logs_tenant ON public.api_request_logs(tenant_id, created_at DESC);
CREATE INDEX idx_data_export_tenant ON public.data_export_requests(tenant_id, created_at DESC);

-- Function to generate API key securely
CREATE OR REPLACE FUNCTION public.generate_api_key(
  _tenant_id UUID,
  _name TEXT DEFAULT 'Default Key',
  _scopes TEXT[] DEFAULT ARRAY['read:invoices','read:customers']
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _raw_key TEXT;
  _key_hash TEXT;
  _key_prefix TEXT;
  _key_id UUID;
BEGIN
  PERFORM assert_tenant_admin(auth.uid(), _tenant_id);
  
  -- Generate a secure random key: nmx_live_<32 random chars>
  _raw_key := 'nmx_live_' || encode(gen_random_bytes(24), 'hex');
  _key_prefix := substring(_raw_key from 1 for 12);
  _key_hash := encode(digest(_raw_key, 'sha256'), 'hex');
  
  INSERT INTO api_keys (tenant_id, name, key_hash, key_prefix, scopes, created_by)
  VALUES (_tenant_id, _name, _key_hash, _key_prefix, _scopes, auth.uid())
  RETURNING id INTO _key_id;
  
  -- Return the raw key ONLY ONCE (never stored in plain text)
  RETURN json_build_object(
    'id', _key_id,
    'key', _raw_key,
    'prefix', _key_prefix,
    'name', _name,
    'scopes', _scopes
  );
END;
$$;

-- Revoke from public, only via secure-rpc
REVOKE EXECUTE ON FUNCTION public.generate_api_key FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_api_key TO service_role;

-- Function to validate API key (used by edge function)
CREATE OR REPLACE FUNCTION public.validate_api_key(_key_hash TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result RECORD;
BEGIN
  SELECT id, tenant_id, scopes, rate_limit_per_minute, is_active, expires_at
  INTO _result
  FROM api_keys
  WHERE key_hash = _key_hash AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid API key');
  END IF;
  
  IF _result.expires_at IS NOT NULL AND _result.expires_at < now() THEN
    RETURN json_build_object('valid', false, 'error', 'API key expired');
  END IF;
  
  -- Update last_used_at
  UPDATE api_keys SET last_used_at = now(), updated_at = now() WHERE id = _result.id;
  
  RETURN json_build_object(
    'valid', true,
    'key_id', _result.id,
    'tenant_id', _result.tenant_id,
    'scopes', _result.scopes,
    'rate_limit', _result.rate_limit_per_minute
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_api_key FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_api_key TO service_role;
