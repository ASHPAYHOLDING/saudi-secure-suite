
-- P0 FIX: encrypt_zatca_private_key is SECURITY DEFINER and callable by anon/authenticated
-- An attacker could overwrite a tenant's ZATCA private key (key substitution attack)

-- 1) Revoke EXECUTE from PUBLIC, re-grant to service_role/postgres only
REVOKE EXECUTE ON FUNCTION public.encrypt_zatca_private_key(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encrypt_zatca_private_key(uuid, text, text) TO service_role, postgres;

-- 2) Add defense-in-depth: role check inside the function body
CREATE OR REPLACE FUNCTION public.encrypt_zatca_private_key(p_cert_id uuid, p_private_key text, p_master_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Defense-in-depth: only service_role can call this
  IF current_setting('role', true) NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Access denied: service_role only' USING ERRCODE = '42501';
  END IF;

  UPDATE zatca_certificates
  SET
    private_key_encrypted = extensions.pgp_sym_encrypt(p_private_key, p_master_key),
    private_key_kid = 'v1',
    private_key = NULL
  WHERE id = p_cert_id;

  INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action)
  SELECT tenant_id, created_by, 'zatca_certificate', p_cert_id::text, 'private_key_encrypted'
  FROM zatca_certificates WHERE id = p_cert_id;
END;
$function$;

-- 3) Also add defense-in-depth to get_zatca_private_key (already REVOKE'd but add role check)
CREATE OR REPLACE FUNCTION public.get_zatca_private_key(p_cert_id uuid, p_master_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
  v_tenant_id uuid;
  v_user_id uuid;
BEGIN
  -- Defense-in-depth: only service_role can call this
  IF current_setting('role', true) NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Access denied: service_role only' USING ERRCODE = '42501';
  END IF;

  SELECT
    extensions.pgp_sym_decrypt(private_key_encrypted, p_master_key),
    tenant_id,
    created_by
  INTO v_key, v_tenant_id, v_user_id
  FROM zatca_certificates
  WHERE id = p_cert_id AND is_active = true;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Certificate not found or decryption failed';
  END IF;

  INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action)
  VALUES (v_tenant_id, COALESCE(auth.uid(), v_user_id), 'zatca_certificate', p_cert_id::text, 'private_key_accessed');

  RETURN v_key;
END;
$function$;

-- 4) Re-apply REVOKE on get_zatca_private_key after CREATE OR REPLACE (resets grants)
REVOKE EXECUTE ON FUNCTION public.get_zatca_private_key(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_zatca_private_key(uuid, text) TO service_role, postgres;

-- 5) Re-apply REVOKE on encrypt_zatca_private_key after CREATE OR REPLACE
REVOKE EXECUTE ON FUNCTION public.encrypt_zatca_private_key(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encrypt_zatca_private_key(uuid, text, text) TO service_role, postgres;
