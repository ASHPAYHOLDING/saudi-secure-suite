
-- Fix remaining 2 functions + fix cron functions that got re-granted to authenticated

-- Remaining audit/enforce functions
REVOKE EXECUTE ON FUNCTION public.audit_rls_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_rls_status() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.enforce_feature_entitlement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_feature_entitlement(uuid, text) TO authenticated, service_role;

-- Fix cron functions: REVOKE from authenticated (they should be service_role ONLY)
REVOKE EXECUTE ON FUNCTION public.claim_outbox_batch(integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_usage_events() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_next_month_partitions() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.drop_old_partitions(integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.maintain_partitions(integer) FROM authenticated;
