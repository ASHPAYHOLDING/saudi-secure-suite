
-- Enterprise security policies table
CREATE TABLE public.enterprise_security_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  password_min_length integer NOT NULL DEFAULT 12,
  require_uppercase boolean NOT NULL DEFAULT true,
  require_numbers boolean NOT NULL DEFAULT true,
  require_symbols boolean NOT NULL DEFAULT true,
  session_timeout_minutes integer NOT NULL DEFAULT 60,
  audit_retention_days integer NOT NULL DEFAULT 365,
  webhook_retention_days integer NOT NULL DEFAULT 90,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_security_policies ENABLE ROW LEVEL SECURITY;

-- Restrictive auth gate
CREATE POLICY "auth_gate_enterprise_security_policies"
  ON public.enterprise_security_policies
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Tenant members can read
CREATE POLICY "tenant_read_enterprise_security_policies"
  ON public.enterprise_security_policies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = enterprise_security_policies.tenant_id
        AND tm.user_id = auth.uid()
    )
  );

-- Tenant owner can insert
CREATE POLICY "tenant_owner_insert_enterprise_security_policies"
  ON public.enterprise_security_policies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = enterprise_security_policies.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );

-- Tenant owner can update
CREATE POLICY "tenant_owner_update_enterprise_security_policies"
  ON public.enterprise_security_policies
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = enterprise_security_policies.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = enterprise_security_policies.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );

-- Service role full access
CREATE POLICY "service_role_enterprise_security_policies"
  ON public.enterprise_security_policies
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Auto-update timestamp
CREATE TRIGGER update_enterprise_security_policies_updated_at
  BEFORE UPDATE ON public.enterprise_security_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger for tracking changes
CREATE OR REPLACE FUNCTION public.audit_enterprise_security_policies()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tenant_id, user_id, entity_type, entity_id,
    action, before_value, after_value, entity_label
  ) VALUES (
    NEW.tenant_id,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'enterprise_security_policies',
    NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW),
    'سياسات الأمان المؤسسية'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_enterprise_security_policies_trigger
  AFTER INSERT OR UPDATE ON public.enterprise_security_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_enterprise_security_policies();
