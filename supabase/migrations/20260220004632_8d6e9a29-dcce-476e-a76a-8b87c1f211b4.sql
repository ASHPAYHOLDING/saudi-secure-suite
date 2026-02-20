
-- Update RPCs to accept the master key as a parameter
-- (ALTER DATABASE is not allowed on Supabase Cloud)

CREATE OR REPLACE FUNCTION public.set_integration_secrets(
  p_tenant_id      uuid,
  p_integration_id uuid,
  p_secrets_json   text,
  p_actor_id       uuid,
  p_master_key     text   -- injected by edge function from INTEGRATION_SECRET_KEY env var
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted bytea;
BEGIN
  IF current_role NOT IN ('service_role') THEN
    RAISE EXCEPTION 'Access denied: service_role only' USING ERRCODE = '42501';
  END IF;

  IF p_master_key IS NULL OR p_master_key = '' THEN
    RAISE EXCEPTION 'Master encryption key not provided' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tenant_paid_integrations
     WHERE tenant_id = p_tenant_id AND integration_id = p_integration_id
  ) THEN
    RAISE EXCEPTION 'Integration record not found for tenant' USING ERRCODE = 'P0002';
  END IF;

  v_encrypted := pgp_sym_encrypt(p_secrets_json, p_master_key);

  UPDATE public.tenant_paid_integrations
     SET api_secret_encrypted = v_encrypted,
         api_secret_kid       = 'v1',
         api_key_encrypted    = NULL,
         updated_at           = now()
   WHERE tenant_id      = p_tenant_id
     AND integration_id = p_integration_id;

  INSERT INTO public.audit_logs (
    tenant_id, user_id, entity_type, entity_id,
    action, changes, created_at
  ) VALUES (
    p_tenant_id, p_actor_id,
    'tenant_paid_integrations', p_integration_id,
    'set_secret',
    jsonb_build_object('integration_id', p_integration_id, 'kid', 'v1', 'note', 'Secret encrypted and stored'),
    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_integration_secrets(uuid, uuid, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_integration_secrets(uuid, uuid, text, uuid, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.set_integration_secrets(uuid, uuid, text, uuid, text) FROM anon;

-- Drop old 4-param version
DROP FUNCTION IF EXISTS public.set_integration_secrets(uuid, uuid, text, uuid);

-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_integration_secrets_for_edge_only(
  p_tenant_id      uuid,
  p_integration_id uuid,
  p_master_key     text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted bytea;
  v_decrypted text;
BEGIN
  IF current_role NOT IN ('service_role') THEN
    RAISE EXCEPTION 'Access denied: service_role only' USING ERRCODE = '42501';
  END IF;

  IF p_master_key IS NULL OR p_master_key = '' THEN
    RAISE EXCEPTION 'Master encryption key not provided' USING ERRCODE = 'P0001';
  END IF;

  SELECT api_secret_encrypted
    INTO v_encrypted
    FROM public.tenant_paid_integrations
   WHERE tenant_id      = p_tenant_id
     AND integration_id = p_integration_id
   LIMIT 1;

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  v_decrypted := pgp_sym_decrypt(v_encrypted, p_master_key);
  RETURN v_decrypted;
END;
$$;

REVOKE ALL ON FUNCTION public.get_integration_secrets_for_edge_only(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_integration_secrets_for_edge_only(uuid, uuid, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.get_integration_secrets_for_edge_only(uuid, uuid, text) FROM anon;

-- Drop old 2-param version
DROP FUNCTION IF EXISTS public.get_integration_secrets_for_edge_only(uuid, uuid);

-- ─────────────────────────────────────────────────────────────
-- Same for tenant_integrations secrets
CREATE OR REPLACE FUNCTION public.set_tenant_integration_secrets(
  p_tenant_id        uuid,
  p_integration_type text,
  p_config_public    jsonb,
  p_secrets_json     text,
  p_actor_id         uuid,
  p_master_key       text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted bytea;
BEGIN
  IF current_role NOT IN ('service_role') THEN
    RAISE EXCEPTION 'Access denied: service_role only' USING ERRCODE = '42501';
  END IF;

  IF p_master_key IS NULL OR p_master_key = '' THEN
    RAISE EXCEPTION 'Master encryption key not provided' USING ERRCODE = 'P0001';
  END IF;

  v_encrypted := pgp_sym_encrypt(p_secrets_json, p_master_key);

  UPDATE public.tenant_integrations
     SET config_public      = p_config_public,
         secrets_encrypted  = v_encrypted,
         config             = (config - 'api_key' - 'secret_key' - 'access_token'
                                       - 'secret' - 'password' - 'api_secret'),
         updated_at         = now()
   WHERE tenant_id        = p_tenant_id
     AND integration_type = p_integration_type;

  INSERT INTO public.audit_logs (
    tenant_id, user_id, entity_type, entity_id,
    action, changes, created_at
  )
  SELECT
    p_tenant_id, p_actor_id,
    'tenant_integrations', id,
    'set_secret',
    jsonb_build_object('integration_type', p_integration_type, 'note', 'Secret encrypted'),
    now()
  FROM public.tenant_integrations
  WHERE tenant_id = p_tenant_id AND integration_type = p_integration_type;
END;
$$;

REVOKE ALL ON FUNCTION public.set_tenant_integration_secrets(uuid, text, jsonb, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_tenant_integration_secrets(uuid, text, jsonb, text, uuid, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.set_tenant_integration_secrets(uuid, text, jsonb, text, uuid, text) FROM anon;

-- Drop old 5-param version
DROP FUNCTION IF EXISTS public.set_tenant_integration_secrets(uuid, text, jsonb, text, uuid);
