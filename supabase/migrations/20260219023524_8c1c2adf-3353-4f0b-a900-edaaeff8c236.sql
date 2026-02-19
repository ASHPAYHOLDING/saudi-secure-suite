
-- Fix: process_affiliate_commission has different signature
REVOKE EXECUTE ON FUNCTION public.process_affiliate_commission(uuid, uuid, uuid, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_affiliate_commission(uuid, uuid, uuid, numeric) TO service_role;
