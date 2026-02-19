
-- Drop the old single-arg overload that conflicts with the new one
DROP FUNCTION IF EXISTS public.assert_tenant_member(uuid);
