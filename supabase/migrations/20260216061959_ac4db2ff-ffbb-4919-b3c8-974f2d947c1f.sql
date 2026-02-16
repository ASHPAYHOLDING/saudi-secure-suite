
-- Platform admins table for super admin access
CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view this table
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  )
$$;

CREATE POLICY "Platform admins can view" ON public.platform_admins
  FOR SELECT USING (is_platform_admin());

CREATE POLICY "Platform admins can manage" ON public.platform_admins
  FOR ALL USING (is_platform_admin());

-- Allow platform admins to read all tenants
CREATE POLICY "Platform admins can view all tenants" ON public.tenants
  FOR SELECT USING (is_platform_admin());

-- Allow platform admins to read all profiles
CREATE POLICY "Platform admins can view all profiles" ON public.profiles
  FOR SELECT USING (is_platform_admin());

-- Allow platform admins to read all subscriptions
CREATE POLICY "Platform admins can view all subscriptions" ON public.subscriptions
  FOR SELECT USING (is_platform_admin());

-- Allow platform admins to update subscriptions
CREATE POLICY "Platform admins can update subscriptions" ON public.subscriptions
  FOR UPDATE USING (is_platform_admin());

-- Allow platform admins to read all tenant_members
CREATE POLICY "Platform admins can view all members" ON public.tenant_members
  FOR SELECT USING (is_platform_admin());

-- Allow platform admins to update tenants (e.g. suspend)
CREATE POLICY "Platform admins can update all tenants" ON public.tenants
  FOR UPDATE USING (is_platform_admin());
