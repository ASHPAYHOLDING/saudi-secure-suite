
-- P0 FIX v2: Revoke from PUBLIC (which grants to all roles including anon/authenticated)
-- Then re-grant explicitly to service_role and postgres only

-- 1) pgp_sym_decrypt
REVOKE EXECUTE ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO service_role, postgres;

-- 2) pgp_sym_decrypt_bytea
REVOKE EXECUTE ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO service_role, postgres;

-- 3) pgp_pub_decrypt
REVOKE EXECUTE ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO service_role, postgres;

-- 4) pgp_pub_decrypt_bytea
REVOKE EXECUTE ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO service_role, postgres;

-- 5) Raw decrypt/decrypt_iv
REVOKE EXECUTE ON FUNCTION extensions.decrypt(bytea, bytea, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION extensions.decrypt(bytea, bytea, text) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO service_role, postgres;

-- 6) get_zatca_private_key (correct signature: uuid, text)
REVOKE EXECUTE ON FUNCTION public.get_zatca_private_key(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_zatca_private_key(uuid, text) TO service_role, postgres;
