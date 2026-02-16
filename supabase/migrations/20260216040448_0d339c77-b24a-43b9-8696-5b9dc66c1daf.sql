
-- Function to auto-create tenant and membership on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _full_name text;
BEGIN
  _full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'مستخدم جديد');

  -- Create a default tenant for the new user
  INSERT INTO public.tenants (name, slug, created_by, vat_registered, vat_percentage, zatca_phase1_enabled)
  VALUES (
    _full_name || ' - منشأة',
    'tenant-' || substr(NEW.id::text, 1, 8),
    NEW.id,
    false,
    15.00,
    false
  )
  RETURNING id INTO _tenant_id;

  -- Add user as owner of the new tenant
  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (_tenant_id, NEW.id, 'owner');

  -- Link profile to tenant
  UPDATE public.profiles
  SET tenant_id = _tenant_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Trigger: runs AFTER the profile trigger so profile exists
CREATE TRIGGER on_auth_user_created_tenant
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_tenant();
