
-- Update handle_new_user_tenant to read tenant_type from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
  _full_name text;
  _tenant_type tenant_type;
BEGIN
  _full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'مستخدم جديد');
  
  -- Read tenant_type from signup metadata, default to 'company'
  _tenant_type := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'tenant_type', '')::tenant_type,
    'company'
  );

  -- Create a default tenant for the new user
  INSERT INTO public.tenants (name, slug, created_by, tenant_type, vat_registered, vat_percentage, zatca_phase1_enabled)
  VALUES (
    CASE _tenant_type
      WHEN 'company' THEN _full_name || ' - منشأة'
      WHEN 'freelancer' THEN _full_name || ' - مستقل'
      WHEN 'individual' THEN _full_name || ' - فرد'
    END,
    'tenant-' || substr(NEW.id::text, 1, 8),
    NEW.id,
    _tenant_type,
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
$function$;
