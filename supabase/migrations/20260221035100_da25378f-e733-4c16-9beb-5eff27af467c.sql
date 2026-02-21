
-- Governance policy types enum
CREATE TYPE public.governance_policy_type AS ENUM (
  'approval_limit',
  'segregation_of_duties',
  'transaction_limit',
  'restricted_access'
);

-- Governance policies table
CREATE TABLE public.governance_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  policy_type public.governance_policy_type NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  name_en TEXT,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Policy violations table
CREATE TABLE public.policy_violations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  policy_id UUID NOT NULL REFERENCES public.governance_policies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  violation_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  details JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.governance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_violations ENABLE ROW LEVEL SECURITY;

-- RLS: Auth gate (restrictive)
CREATE POLICY "governance_policies_auth_gate" ON public.governance_policies
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "policy_violations_auth_gate" ON public.policy_violations
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL);

-- RLS: Tenant members can read governance policies
CREATE POLICY "Tenant members can view governance policies"
  ON public.governance_policies FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- RLS: Admins/owners can manage governance policies
CREATE POLICY "Tenant admins can manage governance policies"
  ON public.governance_policies FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- RLS: Tenant members can view violations
CREATE POLICY "Tenant members can view policy violations"
  ON public.policy_violations FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- RLS: Service role can insert violations (from RPCs)
CREATE POLICY "Service role can manage violations"
  ON public.policy_violations FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- Indexes
CREATE INDEX idx_governance_policies_tenant ON public.governance_policies(tenant_id);
CREATE INDEX idx_governance_policies_type ON public.governance_policies(policy_type);
CREATE INDEX idx_policy_violations_tenant ON public.policy_violations(tenant_id);
CREATE INDEX idx_policy_violations_policy ON public.policy_violations(policy_id);
CREATE INDEX idx_policy_violations_user ON public.policy_violations(user_id);
CREATE INDEX idx_policy_violations_entity ON public.policy_violations(entity_type, entity_id);

-- Trigger for updated_at
CREATE TRIGGER update_governance_policies_updated_at
  BEFORE UPDATE ON public.governance_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer function: check governance policies before transaction
CREATE OR REPLACE FUNCTION public.check_governance_policy(
  p_tenant_id UUID,
  p_user_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_amount NUMERIC DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy RECORD;
  v_violation_found BOOLEAN := false;
  v_violations JSONB := '[]'::jsonb;
  v_violation_detail JSONB;
  v_member_role TEXT;
BEGIN
  -- Get user role in tenant
  SELECT role INTO v_member_role
  FROM public.tenant_members
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id;

  IF v_member_role IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'User is not a member of this tenant');
  END IF;

  FOR v_policy IN
    SELECT * FROM public.governance_policies
    WHERE tenant_id = p_tenant_id AND is_active = true
    ORDER BY policy_type
  LOOP
    v_violation_detail := NULL;

    -- Check approval_limit: amount exceeds max for role
    IF v_policy.policy_type = 'approval_limit' AND p_amount IS NOT NULL THEN
      IF (v_policy.config->>'applies_to_entity') IS NULL OR (v_policy.config->>'applies_to_entity') = p_entity_type THEN
        IF p_amount > COALESCE((v_policy.config->>('max_amount_' || v_member_role))::numeric,
                               (v_policy.config->>'max_amount_default')::numeric, 999999999) THEN
          v_violation_detail := jsonb_build_object(
            'policy_name', v_policy.name,
            'policy_type', v_policy.policy_type::text,
            'reason', 'Amount ' || p_amount || ' exceeds limit for role ' || v_member_role,
            'limit', COALESCE((v_policy.config->>('max_amount_' || v_member_role))::numeric,
                              (v_policy.config->>'max_amount_default')::numeric)
          );
        END IF;
      END IF;
    END IF;

    -- Check transaction_limit: max transactions per day
    IF v_policy.policy_type = 'transaction_limit' THEN
      IF (v_policy.config->>'applies_to_entity') IS NULL OR (v_policy.config->>'applies_to_entity') = p_entity_type THEN
        DECLARE
          v_today_count INT;
          v_max_count INT := COALESCE((v_policy.config->>'max_per_day')::int, 9999);
        BEGIN
          SELECT count(*) INTO v_today_count
          FROM public.audit_logs
          WHERE tenant_id = p_tenant_id
            AND user_id = p_user_id
            AND entity_type = p_entity_type
            AND action = p_action
            AND created_at >= CURRENT_DATE;

          IF v_today_count >= v_max_count THEN
            v_violation_detail := jsonb_build_object(
              'policy_name', v_policy.name,
              'policy_type', v_policy.policy_type::text,
              'reason', 'Daily transaction limit reached: ' || v_today_count || '/' || v_max_count,
              'current_count', v_today_count,
              'max_count', v_max_count
            );
          END IF;
        END;
      END IF;
    END IF;

    -- Check segregation_of_duties: same user cannot perform conflicting actions
    IF v_policy.policy_type = 'segregation_of_duties' THEN
      IF (v_policy.config->>'entity_type') IS NULL OR (v_policy.config->>'entity_type') = p_entity_type THEN
        DECLARE
          v_conflicting_action TEXT := v_policy.config->>'conflicting_action';
          v_has_conflict BOOLEAN;
        BEGIN
          IF v_conflicting_action IS NOT NULL AND p_action != v_conflicting_action THEN
            SELECT EXISTS(
              SELECT 1 FROM public.audit_logs
              WHERE tenant_id = p_tenant_id
                AND user_id = p_user_id
                AND entity_type = p_entity_type
                AND entity_id = p_entity_id::text
                AND action = v_conflicting_action
            ) INTO v_has_conflict;

            IF v_has_conflict THEN
              v_violation_detail := jsonb_build_object(
                'policy_name', v_policy.name,
                'policy_type', v_policy.policy_type::text,
                'reason', 'Segregation of duties violation: user already performed ' || v_conflicting_action || ' on this entity',
                'conflicting_action', v_conflicting_action
              );
            END IF;
          END IF;
        END;
      END IF;
    END IF;

    -- Check restricted_access: certain roles blocked from action
    IF v_policy.policy_type = 'restricted_access' THEN
      IF (v_policy.config->>'applies_to_entity') IS NULL OR (v_policy.config->>'applies_to_entity') = p_entity_type THEN
        DECLARE
          v_blocked_roles TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_policy.config->'blocked_roles', '[]'::jsonb)));
          v_blocked_action TEXT := v_policy.config->>'blocked_action';
        BEGIN
          IF v_member_role = ANY(v_blocked_roles) AND (v_blocked_action IS NULL OR v_blocked_action = p_action) THEN
            v_violation_detail := jsonb_build_object(
              'policy_name', v_policy.name,
              'policy_type', v_policy.policy_type::text,
              'reason', 'Role ' || v_member_role || ' is restricted from performing ' || p_action || ' on ' || p_entity_type
            );
          END IF;
        END;
      END IF;
    END IF;

    -- If violation found, record it
    IF v_violation_detail IS NOT NULL THEN
      v_violation_found := true;
      v_violations := v_violations || v_violation_detail;

      -- Insert violation record
      INSERT INTO public.policy_violations (tenant_id, user_id, policy_id, entity_type, entity_id, violation_type, details)
      VALUES (p_tenant_id, p_user_id, v_policy.id, p_entity_type, p_entity_id, v_policy.policy_type::text, v_violation_detail);

      -- Insert audit log
      INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
      VALUES (p_tenant_id, p_user_id, 'governance_violation', p_entity_type, p_entity_id::text, v_policy.name,
              jsonb_build_object('violation', v_violation_detail));
    END IF;
  END LOOP;

  IF v_violation_found THEN
    RETURN jsonb_build_object('allowed', false, 'violations', v_violations);
  ELSE
    RETURN jsonb_build_object('allowed', true, 'violations', '[]'::jsonb);
  END IF;
END;
$$;

-- Revoke public access, grant to service_role
REVOKE EXECUTE ON FUNCTION public.check_governance_policy FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_governance_policy TO service_role;
