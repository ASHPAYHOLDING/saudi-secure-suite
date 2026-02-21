
-- ============================================================
-- RULE-BASED WORKFLOW ENGINE UPGRADE
-- ============================================================

-- 1. Add rules_json column to approval_workflows
ALTER TABLE public.approval_workflows
  ADD COLUMN IF NOT EXISTS rules_json jsonb DEFAULT NULL;

COMMENT ON COLUMN public.approval_workflows.rules_json IS 
'Rule-based conditions: {"conditions":[{"field":"amount","operator":">","value":10000}],"logic":"AND"|"OR"}';

-- 2. Add rules_json to workflow_steps for condition steps
-- (auto_condition already exists as jsonb, we'll use it with the new format)

-- 3. Create the rule evaluation function
CREATE OR REPLACE FUNCTION public.evaluate_workflow_rules(
  p_rules jsonb,
  p_context jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_conditions jsonb;
  v_logic text;
  v_cond jsonb;
  v_field text;
  v_operator text;
  v_rule_value text;
  v_context_value text;
  v_num_rule numeric;
  v_num_ctx numeric;
  v_result boolean;
  v_any_true boolean := false;
  v_all_true boolean := true;
BEGIN
  -- Null or empty rules = pass
  IF p_rules IS NULL OR p_rules = '{}'::jsonb OR p_rules = 'null'::jsonb THEN
    RETURN true;
  END IF;

  -- Legacy format: {"pass": true/false}
  IF p_rules ? 'pass' THEN
    RETURN COALESCE((p_rules->>'pass')::boolean, true);
  END IF;

  v_conditions := p_rules->'conditions';
  v_logic := COALESCE(UPPER(p_rules->>'logic'), 'AND');

  -- No conditions array = pass
  IF v_conditions IS NULL OR jsonb_array_length(v_conditions) = 0 THEN
    RETURN true;
  END IF;

  FOR v_cond IN SELECT * FROM jsonb_array_elements(v_conditions) LOOP
    v_field := v_cond->>'field';
    v_operator := v_cond->>'operator';
    v_rule_value := v_cond->>'value';
    v_context_value := p_context->>v_field;

    -- If context doesn't have the field, condition fails
    IF v_context_value IS NULL THEN
      v_result := false;
    ELSE
      -- Try numeric comparison first
      BEGIN
        v_num_rule := v_rule_value::numeric;
        v_num_ctx := v_context_value::numeric;
        
        v_result := CASE v_operator
          WHEN '>' THEN v_num_ctx > v_num_rule
          WHEN '<' THEN v_num_ctx < v_num_rule
          WHEN '>=' THEN v_num_ctx >= v_num_rule
          WHEN '<=' THEN v_num_ctx <= v_num_rule
          WHEN '==' THEN v_num_ctx = v_num_rule
          WHEN '=' THEN v_num_ctx = v_num_rule
          WHEN '!=' THEN v_num_ctx != v_num_rule
          ELSE false
        END;
      EXCEPTION WHEN OTHERS THEN
        -- String comparison
        v_result := CASE v_operator
          WHEN '==' THEN LOWER(v_context_value) = LOWER(v_rule_value)
          WHEN '=' THEN LOWER(v_context_value) = LOWER(v_rule_value)
          WHEN '!=' THEN LOWER(v_context_value) != LOWER(v_rule_value)
          ELSE false
        END;
      END;
    END IF;

    IF v_result THEN
      v_any_true := true;
    ELSE
      v_all_true := false;
    END IF;

    -- Short-circuit
    IF v_logic = 'AND' AND NOT v_result THEN RETURN false; END IF;
    IF v_logic = 'OR' AND v_result THEN RETURN true; END IF;
  END LOOP;

  IF v_logic = 'AND' THEN RETURN v_all_true; END IF;
  IF v_logic = 'OR' THEN RETURN v_any_true; END IF;

  RETURN true;
END;
$$;

-- 4. Update atomic_start_workflow to use rule evaluation
-- The condition step evaluation (lines 79-85 in the current function)
-- needs to call evaluate_workflow_rules instead of simple pass check
CREATE OR REPLACE FUNCTION public.atomic_start_workflow(
  p_tenant_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_workflow RECORD;
  v_instance_id UUID;
  v_current_order INT := 1;
  v_step RECORD;
  v_step_status TEXT;
  v_final_status TEXT := 'in_progress';
  v_rule_result boolean;
BEGIN
  -- 1) Caller identity
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول أولاً';
  END IF;

  -- 2) Tenant membership check
  IF NOT EXISTS (
    SELECT 1 FROM tenant_members WHERE user_id = v_user_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية الوصول لهذه المنشأة';
  END IF;

  -- 3) Find active workflow
  SELECT id, name INTO v_workflow
  FROM workflows
  WHERE tenant_id = p_tenant_id
    AND entity_type = p_entity_type
    AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'لا يوجد سير عمل مفعّل لنوع "%"', p_entity_type;
  END IF;

  -- 4) Verify steps exist
  IF NOT EXISTS (
    SELECT 1 FROM workflow_steps WHERE workflow_id = v_workflow.id
  ) THEN
    RAISE EXCEPTION 'سير العمل لا يحتوي على خطوات';
  END IF;

  -- 5) Create instance
  INSERT INTO workflow_instances (workflow_id, tenant_id, entity_id, entity_type, status, current_step_order, started_by)
  VALUES (v_workflow.id, p_tenant_id, p_entity_id, p_entity_type, 'in_progress', 1, v_user_id)
  RETURNING id INTO v_instance_id;

  -- 6) Create all instance steps
  INSERT INTO workflow_instance_steps (instance_id, step_id, tenant_id, step_order, status)
  SELECT v_instance_id, ws.id, p_tenant_id, ws.step_order, 'pending'
  FROM workflow_steps ws
  WHERE ws.workflow_id = v_workflow.id
  ORDER BY ws.step_order;

  -- 7) Advance auto/condition steps from the start
  LOOP
    SELECT ws.id AS step_id, ws.step_order, ws.type, ws.auto_condition, ws.is_required
    INTO v_step
    FROM workflow_steps ws
    WHERE ws.workflow_id = v_workflow.id AND ws.step_order = v_current_order;

    IF NOT FOUND THEN
      UPDATE workflow_instances SET status = 'approved', completed_at = now() WHERE id = v_instance_id;
      v_final_status := 'approved';
      EXIT;
    END IF;

    IF v_step.type = 'approval' THEN
      v_final_status := 'in_progress';
      EXIT;
    END IF;

    -- Condition step: evaluate with rule engine
    IF v_step.type = 'condition' THEN
      v_rule_result := evaluate_workflow_rules(v_step.auto_condition, p_context);
      IF v_rule_result THEN
        v_step_status := 'auto_passed';
      ELSE
        v_step_status := 'skipped';
      END IF;
    ELSE
      v_step_status := 'auto_passed';
    END IF;

    UPDATE workflow_instance_steps
    SET status = v_step_status, acted_at = now()
    WHERE instance_id = v_instance_id AND step_order = v_current_order;

    IF v_step_status = 'skipped' AND v_step.is_required THEN
      UPDATE workflow_instances SET status = 'rejected', completed_at = now() WHERE id = v_instance_id;
      v_final_status := 'rejected';
      EXIT;
    END IF;

    v_current_order := v_current_order + 1;
    UPDATE workflow_instances SET current_step_order = v_current_order WHERE id = v_instance_id;
  END LOOP;

  -- 8) Audit log
  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (
    p_tenant_id, v_user_id, 'workflow_started', 'workflow_instance', v_instance_id::TEXT,
    v_workflow.name,
    jsonb_build_object(
      'workflow_id', v_workflow.id,
      'entity_type', p_entity_type,
      'entity_id', p_entity_id,
      'context', p_context,
      'final_status', v_final_status,
      'advanced_to_step', v_current_order
    )
  );

  RETURN jsonb_build_object('instance_id', v_instance_id, 'status', v_final_status);
END;
$$;

REVOKE ALL ON FUNCTION public.atomic_start_workflow(uuid, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_start_workflow(uuid, text, uuid, jsonb) TO service_role;

-- 5. Update secure_workflow_action to also use rule engine for auto-advance
CREATE OR REPLACE FUNCTION public.secure_workflow_action(
  p_instance_id uuid,
  p_action text,
  p_comment text DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_instance RECORD;
  v_current_step RECORD;
  v_step_def RECORD;
  v_user_role TEXT;
  v_has_permission BOOLEAN := FALSE;
  v_next_order INT;
  v_final_status TEXT;
  v_auto_step RECORD;
  v_auto_status TEXT;
  v_rule_result boolean;
BEGIN
  -- 1) Get caller identity
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول أولاً';
  END IF;

  -- 2) Validate action
  IF p_action NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'إجراء غير صالح: يجب أن يكون approved أو rejected';
  END IF;

  -- 3) Fetch workflow instance
  SELECT wi.id, wi.tenant_id, wi.workflow_id, wi.current_step_order, wi.status, wi.started_by
  INTO v_instance
  FROM workflow_instances wi
  WHERE wi.id = p_instance_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'مثيل سير العمل غير موجود'; END IF;
  IF v_instance.status != 'in_progress' THEN
    RAISE EXCEPTION 'المثيل بحالة "%" ولا يمكن التعديل عليه', v_instance.status;
  END IF;

  -- 4) Tenant membership
  IF NOT EXISTS (
    SELECT 1 FROM tenant_members WHERE user_id = v_user_id AND tenant_id = v_instance.tenant_id
  ) THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (v_instance.tenant_id, v_user_id, 'workflow_approval_denied', 'workflow_instance', p_instance_id::TEXT, 'ليس عضواً في المنشأة');
    RAISE EXCEPTION 'ليس لديك صلاحية الوصول لهذه المنشأة';
  END IF;

  -- 5) Get current instance step
  SELECT wis.id, wis.step_id, wis.step_order, wis.status
  INTO v_current_step
  FROM workflow_instance_steps wis
  WHERE wis.instance_id = p_instance_id AND wis.step_order = v_instance.current_step_order;

  IF NOT FOUND OR v_current_step.status != 'pending' THEN
    RAISE EXCEPTION 'الخطوة الحالية ليست في حالة انتظار';
  END IF;

  -- 6) Get step definition
  SELECT ws.role_required, ws.permission_required, ws.name
  INTO v_step_def
  FROM workflow_steps ws
  WHERE ws.id = v_current_step.step_id;

  -- 7) RBAC check
  SELECT tm.role INTO v_user_role
  FROM tenant_members tm
  WHERE tm.user_id = v_user_id AND tm.tenant_id = v_instance.tenant_id;

  IF v_user_role = 'owner' THEN
    v_has_permission := TRUE;
  ELSE
    IF v_step_def.role_required IS NOT NULL THEN
      IF v_user_role = v_step_def.role_required THEN v_has_permission := TRUE; END IF;
      IF v_user_role = 'admin' THEN v_has_permission := TRUE; END IF;
    END IF;

    IF v_step_def.permission_required IS NOT NULL AND NOT v_has_permission THEN
      IF EXISTS (
        SELECT 1 FROM role_permissions rp
        JOIN custom_roles cr ON cr.id = rp.role_id
        JOIN tenant_members tm ON tm.role = cr.role_key AND tm.tenant_id = cr.tenant_id
        WHERE tm.user_id = v_user_id
          AND tm.tenant_id = v_instance.tenant_id
          AND rp.permission_key = v_step_def.permission_required
      ) THEN
        v_has_permission := TRUE;
      END IF;
    END IF;

    IF v_step_def.role_required IS NULL AND v_step_def.permission_required IS NULL THEN
      v_has_permission := TRUE;
    END IF;
  END IF;

  IF NOT v_has_permission THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (v_instance.tenant_id, v_user_id, 'workflow_approval_denied', 'workflow_instance', p_instance_id::TEXT,
            'صلاحيات غير كافية', jsonb_build_object('required_role', v_step_def.role_required, 'required_permission', v_step_def.permission_required, 'user_role', v_user_role));
    RAISE EXCEPTION 'ليس لديك الصلاحيات اللازمة لتنفيذ هذا الإجراء. مطلوب: %', COALESCE(v_step_def.role_required, v_step_def.permission_required, 'غير محدد');
  END IF;

  -- 8) STRICT Self-approval prevention (no exceptions, not even owner)
  IF p_action = 'approved' AND v_instance.started_by = v_user_id THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (v_instance.tenant_id, v_user_id, 'workflow_self_approval_blocked', 'workflow_instance', p_instance_id::TEXT, 'محاولة موافقة ذاتية محظورة');
    RAISE EXCEPTION 'لا يمكنك الموافقة على سير العمل الذي أنشأته بنفسك (سياسة صارمة)';
  END IF;

  -- 9) Execute the action on current step
  UPDATE workflow_instance_steps
  SET status = p_action, acted_by = v_user_id, acted_at = now(), comment = p_comment
  WHERE id = v_current_step.id;

  IF p_action = 'rejected' THEN
    UPDATE workflow_instances SET status = 'rejected', completed_at = now() WHERE id = p_instance_id;
    v_final_status := 'rejected';
  ELSE
    v_next_order := v_instance.current_step_order + 1;

    -- Auto-advance loop with rule evaluation
    LOOP
      SELECT ws.id AS step_id, ws.step_order, ws.type, ws.auto_condition, ws.is_required
      INTO v_auto_step
      FROM workflow_steps ws
      WHERE ws.workflow_id = v_instance.workflow_id AND ws.step_order = v_next_order;

      IF NOT FOUND THEN
        UPDATE workflow_instances SET status = 'approved', completed_at = now(), current_step_order = v_next_order WHERE id = p_instance_id;
        v_final_status := 'approved';
        EXIT;
      END IF;

      IF v_auto_step.type = 'approval' THEN
        UPDATE workflow_instances SET current_step_order = v_next_order WHERE id = p_instance_id;
        v_final_status := 'in_progress';
        EXIT;
      END IF;

      -- Condition step: evaluate with rule engine
      IF v_auto_step.type = 'condition' THEN
        v_rule_result := evaluate_workflow_rules(v_auto_step.auto_condition, p_context);
        IF v_rule_result THEN
          v_auto_status := 'auto_passed';
        ELSE
          v_auto_status := 'skipped';
        END IF;
      ELSE
        v_auto_status := 'auto_passed';
      END IF;

      UPDATE workflow_instance_steps
      SET status = v_auto_status, acted_at = now()
      WHERE instance_id = p_instance_id AND step_order = v_next_order;

      IF v_auto_status = 'skipped' AND v_auto_step.is_required THEN
        UPDATE workflow_instances SET status = 'rejected', completed_at = now(), current_step_order = v_next_order WHERE id = p_instance_id;
        v_final_status := 'rejected';
        EXIT;
      END IF;

      v_next_order := v_next_order + 1;
    END LOOP;
  END IF;

  -- 10) Audit log
  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (
    v_instance.tenant_id, v_user_id,
    CASE p_action WHEN 'approved' THEN 'workflow_approved' ELSE 'workflow_rejected' END,
    'workflow_instance', p_instance_id::TEXT,
    COALESCE(v_step_def.name, 'خطوة'),
    jsonb_build_object(
      'step_order', v_instance.current_step_order,
      'comment', p_comment,
      'context', p_context,
      'final_status', v_final_status,
      'auto_advanced_to', v_next_order
    )
  );

  RETURN jsonb_build_object('status', v_final_status, 'step_order', v_instance.current_step_order);
END;
$$;

REVOKE ALL ON FUNCTION public.secure_workflow_action(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.secure_workflow_action(uuid, text, text, jsonb) TO service_role;

-- 6. Update secure_approval_action with STRICT self-approval prevention
CREATE OR REPLACE FUNCTION public.secure_approval_action(
  p_action_id uuid,
  p_request_id uuid,
  p_decision text,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_request RECORD;
  v_step RECORD;
  v_user_role TEXT;
  v_final_status TEXT;
  v_rules_match boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول أولاً';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'إجراء غير صالح';
  END IF;

  -- Fetch request
  SELECT ar.* INTO v_request
  FROM approval_requests ar WHERE ar.id = p_request_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'طلب الموافقة غير موجود'; END IF;
  IF v_request.status != 'pending' THEN RAISE EXCEPTION 'الطلب ليس في حالة انتظار'; END IF;

  -- Tenant membership
  IF NOT EXISTS (SELECT 1 FROM tenant_members WHERE user_id = v_user_id AND tenant_id = v_request.tenant_id) THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (v_request.tenant_id, v_user_id, 'workflow_approval_denied', 'approval_request', p_request_id::TEXT, 'ليس عضواً في المنشأة');
    RAISE EXCEPTION 'ليس لديك صلاحية الوصول لهذه المنشأة';
  END IF;

  -- Get user role
  SELECT tm.role INTO v_user_role FROM tenant_members tm WHERE tm.user_id = v_user_id AND tm.tenant_id = v_request.tenant_id;

  -- Get the step
  SELECT aws.* INTO v_step
  FROM approval_workflow_steps aws
  JOIN approval_actions aa ON aa.step_id = aws.id
  WHERE aa.id = p_action_id;

  -- RBAC check (owner bypasses role check but NOT self-approval)
  IF v_user_role != 'owner' THEN
    IF v_step.approver_role IS NOT NULL AND v_user_role != v_step.approver_role AND v_user_role != 'admin' THEN
      INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
      VALUES (v_request.tenant_id, v_user_id, 'workflow_approval_denied', 'approval_request', p_request_id::TEXT, 'صلاحيات غير كافية',
              jsonb_build_object('required_role', v_step.approver_role, 'user_role', v_user_role));
      RAISE EXCEPTION 'ليس لديك الصلاحيات اللازمة. مطلوب دور: %', v_step.approver_role;
    END IF;
  END IF;

  -- STRICT Self-approval prevention (applies to ALL roles including owner)
  IF p_decision = 'approved' AND v_request.requested_by = v_user_id THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (v_request.tenant_id, v_user_id, 'workflow_self_approval_blocked', 'approval_request', p_request_id::TEXT, 'محاولة موافقة ذاتية محظورة (سياسة صارمة)');
    RAISE EXCEPTION 'لا يمكنك الموافقة على طلبك بنفسك — سياسة فصل المهام الصارمة';
  END IF;

  -- Execute
  UPDATE approval_actions
  SET action = p_decision, acted_by = v_user_id, acted_at = now(), comment = p_comment
  WHERE id = p_action_id;

  IF p_decision = 'rejected' THEN
    UPDATE approval_requests SET status = 'rejected', completed_at = now(), updated_at = now() WHERE id = p_request_id;
    v_final_status := 'rejected';
  ELSIF v_request.current_step >= v_request.total_steps THEN
    UPDATE approval_requests SET status = 'approved', completed_at = now(), updated_at = now() WHERE id = p_request_id;
    v_final_status := 'approved';
  ELSE
    UPDATE approval_requests SET current_step = v_request.current_step + 1, updated_at = now() WHERE id = p_request_id;
    v_final_status := 'pending';
  END IF;

  -- Audit
  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (
    v_request.tenant_id, v_user_id,
    CASE p_decision WHEN 'approved' THEN 'workflow_approved' ELSE 'workflow_rejected' END,
    'approval_request', p_request_id::TEXT,
    v_request.document_type || ' ' || COALESCE(v_request.document_number, ''),
    jsonb_build_object('step', v_request.current_step, 'final_status', v_final_status, 'comment', p_comment)
  );

  RETURN jsonb_build_object('status', v_final_status, 'step', v_request.current_step);
END;
$$;

REVOKE ALL ON FUNCTION public.secure_approval_action(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.secure_approval_action(uuid, uuid, text, text) TO service_role;
