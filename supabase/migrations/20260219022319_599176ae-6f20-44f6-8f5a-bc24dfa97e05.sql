
-- Create assert_tenant_member guard function
CREATE OR REPLACE FUNCTION public.assert_tenant_member(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
  ) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: user % is not a member of tenant %', auth.uid(), _tenant_id;
  END IF;
END;
$$;

-- Only authenticated users should call this
REVOKE EXECUTE ON FUNCTION public.assert_tenant_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.assert_tenant_member(uuid) TO authenticated, service_role;
