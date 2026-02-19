
-- حذف الدالة القديمة بتوقيعها الفعلي
DROP FUNCTION IF EXISTS get_zatca_private_key(_tenant_id uuid, _certificate_type text);

-- إضافة الأعمدة
ALTER TABLE zatca_certificates
  ADD COLUMN IF NOT EXISTS private_key_encrypted bytea,
  ADD COLUMN IF NOT EXISTS private_key_kid text DEFAULT 'v1';

-- دالة التشفير
CREATE OR REPLACE FUNCTION encrypt_zatca_private_key(
  p_cert_id uuid,
  p_private_key text,
  p_master_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE zatca_certificates
  SET
    private_key_encrypted = pgp_sym_encrypt(p_private_key, p_master_key),
    private_key_kid = 'v1',
    private_key = NULL
  WHERE id = p_cert_id;

  INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action)
  SELECT tenant_id, created_by, 'zatca_certificate', p_cert_id::text, 'private_key_encrypted'
  FROM zatca_certificates WHERE id = p_cert_id;
END;
$$;

-- دالة فك التشفير (توقيع جديد)
CREATE FUNCTION get_zatca_private_key(
  p_cert_id uuid,
  p_master_key text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_tenant_id uuid;
  v_user_id uuid;
BEGIN
  SELECT
    pgp_sym_decrypt(private_key_encrypted, p_master_key),
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
$$;

-- تحديث الـ View
DROP VIEW IF EXISTS zatca_certificates_safe;
CREATE VIEW zatca_certificates_safe AS
SELECT
  id, tenant_id, certificate_type, csid, certificate, request_id,
  environment, issued_at, expires_at, is_active, created_by, created_at, updated_at,
  (private_key_encrypted IS NOT NULL) AS is_key_encrypted,
  private_key_kid
FROM zatca_certificates;

-- صلاحيات service_role فقط
REVOKE ALL ON FUNCTION get_zatca_private_key(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION get_zatca_private_key(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION encrypt_zatca_private_key(uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION encrypt_zatca_private_key(uuid, text, text) TO service_role;
