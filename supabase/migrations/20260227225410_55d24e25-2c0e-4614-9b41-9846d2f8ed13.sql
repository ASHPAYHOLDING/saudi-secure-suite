DROP FUNCTION public.generate_api_key(uuid, text, text[]);

CREATE OR REPLACE FUNCTION public.generate_api_key(_tenant_id uuid, _name text DEFAULT 'Default Key'::text, _scopes text[] DEFAULT ARRAY['read:invoices'::text, 'read:customers'::text])
RETURNS json
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
  -- Defense-in-depth: block anon/public even if GRANT is misconfigured
  IF current_setting('role', true) NOT IN ('service_role', 'postgres', 'authenticated') THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  PERFORM assert_tenant_admin(auth.uid(), _tenant_id);
  
  _raw_key := 'nmx_live_' || encode(gen_random_bytes(24), 'hex');
  _key_prefix := substring(_raw_key from 1 for 12);
  _key_hash := encode(digest(_raw_key, 'sha256'), 'hex');
  
  INSERT INTO api_keys (tenant_id, name, key_hash, key_prefix, scopes, created_by)
  VALUES (_tenant_id, _name, _key_hash, _key_prefix, _scopes, auth.uid())
  RETURNING id INTO _key_id;
  
  RETURN json_build_object(
    'id', _key_id,
    'key', _raw_key,
    'prefix', _key_prefix,
    'name', _name,
    'scopes', _scopes
  );
END;
$$;

-- Re-apply REVOKE/GRANT after recreation
REVOKE EXECUTE ON FUNCTION public.generate_api_key FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_api_key TO service_role, authenticated;