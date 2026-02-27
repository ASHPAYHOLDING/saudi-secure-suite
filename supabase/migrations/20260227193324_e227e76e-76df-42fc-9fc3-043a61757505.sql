
-- Allow same-tenant members to read profiles (basic access needed for chat, team, etc.)
-- But email/phone are protected via the profiles_safe view for non-owner/admin users
DROP POLICY IF EXISTS "profiles_select_restricted" ON public.profiles;

CREATE POLICY "profiles_select_self_or_same_tenant"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR tenant_id = public.get_user_tenant_id()
);
