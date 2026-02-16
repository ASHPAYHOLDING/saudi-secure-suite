
-- Allow tenant admins (not just owners) to update tenant stamp settings
-- This aligns RLS with the UI which allows admin role to edit stamps
CREATE POLICY "Admins can update own tenant"
  ON public.tenants
  FOR UPDATE
  USING (is_tenant_admin(id));

-- Drop the old owner-only policy since admin policy is more inclusive
DROP POLICY IF EXISTS "Owners can update own tenant" ON public.tenants;
