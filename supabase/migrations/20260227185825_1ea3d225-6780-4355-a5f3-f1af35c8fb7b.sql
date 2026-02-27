
-- ============================================================
-- Harden profiles table: restrict SELECT to self, owner/admin, or platform_admin
-- ============================================================

-- 1. Helper function: check if user is owner/admin in a given tenant
CREATE OR REPLACE FUNCTION public.is_tenant_owner_or_admin(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin')
  );
$$;

-- 2. Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view profiles in same tenant" ON public.profiles;

-- 3. New strict SELECT policy:
--    - Own profile
--    - Owner/Admin of same tenant
--    - Platform admin (existing policy remains separate)
CREATE POLICY "profiles_select_restricted"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_tenant_owner_or_admin(tenant_id)
);

-- 4. Create a safe view that hides email/phone for non-privileged users
CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker = on)
AS
SELECT
  id,
  tenant_id,
  full_name,
  full_name_en,
  CASE
    WHEN id = auth.uid()
      OR public.is_tenant_owner_or_admin(tenant_id)
      OR public.is_platform_admin()
    THEN email
    ELSE NULL
  END AS email,
  CASE
    WHEN id = auth.uid()
      OR public.is_tenant_owner_or_admin(tenant_id)
      OR public.is_platform_admin()
    THEN phone
    ELSE NULL
  END AS phone,
  avatar_url,
  job_title,
  language,
  timezone,
  is_active,
  last_login_at,
  created_at,
  updated_at
FROM public.profiles;
