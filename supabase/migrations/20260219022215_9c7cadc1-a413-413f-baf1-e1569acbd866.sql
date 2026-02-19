
-- P0: Lock down dangerous SECURITY DEFINER functions so only service_role can execute them
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS proc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'approve_matured_commissions',
        'generate_smart_notifications',
        'process_subscription_expiry',
        'cleanup_expired_tokens',
        'cleanup_rate_limits',
        'check_subscription_integrity',
        'get_zatca_private_key',
        'encrypt_zatca_private_key'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated;', r.proc);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', r.proc);
  END LOOP;
END $$;
