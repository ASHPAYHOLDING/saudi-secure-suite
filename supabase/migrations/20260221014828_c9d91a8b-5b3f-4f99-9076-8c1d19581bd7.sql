
-- ============================================================
-- atomic_start_workflow: Creates instance + steps + advances auto steps in one transaction
-- ============================================================
CREATE OR REPLACE FUNCTION public.atomic_start_workflow(
  p_tenant_id UUID,
  p_entity_type TEXT,
  p_entity_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_workflow RECORD;
  v_steps RECORD;
  v_instance_id UUID;
  v_current_order INT := 1;
  v_step RECORD;
  v_step_status TEXT;
  v_final_status TEXT := 'in_progress';
  v_steps_arr JSONB := '[]'::JSONB;
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

    -- No more steps → workflow approved
    IF NOT FOUND THEN
      UPDATE workflow_instances SET status = 'approved', completed_at = now() WHERE id = v_instance_id;
      v_final_status := 'approved';
      EXIT;
    END IF;

    -- Approval step → stop advancing
    IF v_step.type = 'approval' THEN
      v_final_status := 'in_progress';
      EXIT;
    END IF;

    -- Auto or condition step
    IF v_step.type = 'condition' THEN
      -- Simple condition: check if auto_condition->>'pass' = 'true'
      IF v_step.auto_condition IS NOT NULL AND (v_step.auto_condition->>'pass')::BOOLEAN IS DISTINCT FROM TRUE THEN
        v_step_status := 'skipped';
      ELSE
        v_step_status := 'auto_passed';
      END IF;
    ELSE
      v_step_status := 'auto_passed';
    END IF;

    UPDATE workflow_instance_steps
    SET status = v_step_status, acted_at = now()
    WHERE instance_id = v_instance_id AND step_order = v_current_order;

    -- Required condition failed → reject
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
      'final_status', v_final_status,
      'advanced_to_step', v_current_order
    )
  );

  RETURN jsonb_build_object('instance_id', v_instance_id, 'status', v_final_status);
END;
$$;

-- ============================================================
-- Replace secure_workflow_action to include auto-step advancement
-- ============================================================
CREATE OR REPLACE FUNCTION public.secure_workflow_action(
  p_instance_id UUID,
  p_action TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
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
  v_has_more BOOLEAN;
  v_final_status TEXT;
  -- Auto-advance vars
  v_auto_step RECORD;
  v_auto_status TEXT;
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'مثيل سير العمل غير موجود';
  END IF;

  IF v_instance.status != 'in_progress' THEN
    RAISE EXCEPTION 'المثيل بحالة "%" ولا يمكن التعديل عليه', v_instance.status;
  END IF;

  -- 4) Tenant membership check
  IF NOT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = v_user_id AND tenant_id = v_instance.tenant_id
  ) THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (v_instance.tenant_id, v_user_id, 'workflow_approval_denied', 'workflow_instance', p_instance_id::TEXT, 'ليس عضواً في المنشأة');
    RAISE EXCEPTION 'ليس لديك صلاحية الوصول لهذه المنشأة';
  END IF;

  -- 5) Get current instance step
  SELECT wis.id, wis.step_id, wis.step_order, wis.status
  INTO v_current_step
  FROM workflow_instance_steps wis
  WHERE wis.instance_id = p_instance_id
    AND wis.step_order = v_instance.current_step_order;

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

  -- 8) Self-approval prevention
  IF p_action = 'approved' AND v_instance.started_by = v_user_id AND v_user_role != 'owner' THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (v_instance.tenant_id, v_user_id, 'workflow_approval_denied', 'workflow_instance', p_instance_id::TEXT, 'محاولة موافقة ذاتية');
    RAISE EXCEPTION 'لا يمكنك الموافقة على سير العمل الذي أنشأته بنفسك';
  END IF;

  -- 9) Execute the action on current step
  UPDATE workflow_instance_steps
  SET status = p_action,
      acted_by = v_user_id,
      acted_at = now(),
      comment = p_comment
  WHERE id = v_current_step.id;

  IF p_action = 'rejected' THEN
    UPDATE workflow_instances
    SET status = 'rejected', completed_at = now()
    WHERE id = p_instance_id;
    v_final_status := 'rejected';
  ELSE
    -- Move to next step and auto-advance
    v_next_order := v_instance.current_step_order + 1;

    -- Auto-advance loop
    LOOP
      SELECT ws.id AS step_id, ws.step_order, ws.type, ws.auto_condition, ws.is_required
      INTO v_auto_step
      FROM workflow_steps ws
      WHERE ws.workflow_id = v_instance.workflow_id AND ws.step_order = v_next_order;

      -- No more steps → approved
      IF NOT FOUND THEN
        UPDATE workflow_instances SET status = 'approved', completed_at = now(), current_step_order = v_next_order WHERE id = p_instance_id;
        v_final_status := 'approved';
        EXIT;
      END IF;

      -- Approval step → stop
      IF v_auto_step.type = 'approval' THEN
        UPDATE workflow_instances SET current_step_order = v_next_order WHERE id = p_instance_id;
        v_final_status := 'in_progress';
        EXIT;
      END IF;

      -- Auto or condition
      IF v_auto_step.type = 'condition' THEN
        IF v_auto_step.auto_condition IS NOT NULL AND (v_auto_step.auto_condition->>'pass')::BOOLEAN IS DISTINCT FROM TRUE THEN
          v_auto_status := 'skipped';
        ELSE
          v_auto_status := 'auto_passed';
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

  -- 10) Comprehensive audit log
  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (
    v_instance.tenant_id, v_user_id,
    CASE p_action WHEN 'approved' THEN 'workflow_approved' ELSE 'workflow_rejected' END,
    'workflow_instance', p_instance_id::TEXT,
    COALESCE(v_step_def.name, 'خطوة'),
    jsonb_build_object(
      'step_order', v_instance.current_step_order,
      'comment', p_comment,
      'final_status', v_final_status,
      'auto_advanced_to', v_next_order
    )
  );

  RETURN jsonb_build_object('status', v_final_status, 'step_order', v_instance.current_step_order);
END;
$$;

-- Lock down
REVOKE EXECUTE ON FUNCTION public.atomic_start_workflow FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_start_workflow TO service_role;

REVOKE EXECUTE ON FUNCTION public.secure_workflow_action FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secure_workflow_action TO service_role;
