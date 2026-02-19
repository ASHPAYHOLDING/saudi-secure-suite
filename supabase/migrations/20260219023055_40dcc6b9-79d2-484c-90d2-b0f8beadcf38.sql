
DROP FUNCTION IF EXISTS public.assert_tenant_member(uuid);

CREATE OR REPLACE FUNCTION public.assert_platform_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: platform admin required';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.assert_tenant_member(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not a tenant member';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.assert_tenant_admin(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
      AND role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: tenant admin required';
  END IF;
END $$;
