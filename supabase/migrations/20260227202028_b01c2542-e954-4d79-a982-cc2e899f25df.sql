
-- P0 FIX: Revoke EXECUTE on all decryption functions from anon/authenticated
-- Only service_role and postgres should be able to decrypt ZATCA keys

-- 1) pgp_sym_decrypt variants
REVOKE EXECUTE ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) FROM anon, authenticated;

-- 2) pgp_pub_decrypt variants
REVOKE EXECUTE ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) FROM anon, authenticated;

-- 3) Raw decrypt/decrypt_iv
REVOKE EXECUTE ON FUNCTION extensions.decrypt(bytea, bytea, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) FROM anon, authenticated;

-- 4) get_zatca_private_key (safe if not exists)
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.get_zatca_private_key(uuid) FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'get_zatca_private_key(uuid) not found, skipping';
END $$;
