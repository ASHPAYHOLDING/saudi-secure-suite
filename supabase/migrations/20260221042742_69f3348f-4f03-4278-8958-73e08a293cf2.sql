
-- Drop and recreate validate_api_key with updated return type
DROP FUNCTION IF EXISTS public.validate_api_key(text);

CREATE FUNCTION public.validate_api_key(_key_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key record;
  v_tier text;
  v_rpm integer;
BEGIN
  SELECT ak.id, ak.tenant_id, ak.scopes, ak.rate_limit_per_minute,
         ak.is_active, ak.expires_at, ak.api_version,
         t.api_rate_limit_tier
    INTO v_key
    FROM api_keys ak
    JOIN tenants t ON t.id = ak.tenant_id
   WHERE ak.key_hash = _key_hash;

  IF v_key IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid API key');
  END IF;

  IF NOT v_key.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'API key is inactive');
  END IF;

  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'API key has expired');
  END IF;

  v_tier := COALESCE(v_key.api_rate_limit_tier, 'basic');
  v_rpm := CASE v_tier
    WHEN 'enterprise' THEN 1000
    WHEN 'pro' THEN 300
    ELSE 60
  END;
  IF v_key.rate_limit_per_minute < v_rpm THEN
    v_rpm := v_key.rate_limit_per_minute;
  END IF;

  UPDATE api_keys SET last_used_at = now() WHERE id = v_key.id;

  RETURN jsonb_build_object(
    'valid', true,
    'key_id', v_key.id,
    'tenant_id', v_key.tenant_id,
    'scopes', v_key.scopes,
    'rate_limit', v_rpm,
    'api_version', v_key.api_version,
    'tier', v_tier
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_api_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_api_key(text) TO service_role;
