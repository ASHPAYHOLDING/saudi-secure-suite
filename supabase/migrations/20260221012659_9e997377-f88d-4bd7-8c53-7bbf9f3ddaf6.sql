
-- Server-side function for secure workflow step approval/rejection
-- Enforces: tenant membership, RBAC, self-approval prevention, audit logging
CREATE OR REPLACE FUNCTION public.secure_workflow_action(
  p_instance_id UUID,
  p_action TEXT,        -- 'approved' or 'rejected'
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
    -- Log denied attempt
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

  -- 6) Get step definition (role_required, permission_required)
  SELECT ws.role_required, ws.permission_required, ws.name
  INTO v_step_def
  FROM workflow_steps ws
  WHERE ws.id = v_current_step.step_id;

  -- 7) RBAC check
  -- Get user's role in this tenant
  SELECT tm.role INTO v_user_role
  FROM tenant_members tm
  WHERE tm.user_id = v_user_id AND tm.tenant_id = v_instance.tenant_id;

  -- Owner bypasses all checks
  IF v_user_role = 'owner' THEN
    v_has_permission := TRUE;
  ELSE
    -- Check role_required
    IF v_step_def.role_required IS NOT NULL THEN
      IF v_user_role = v_step_def.role_required THEN
        v_has_permission := TRUE;
      END IF;
      -- Also check if user role is higher (admin can approve manager steps)
      IF v_user_role = 'admin' THEN
        v_has_permission := TRUE;
      END IF;
    END IF;

    -- Check permission_required via granular permissions
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

    -- If no specific requirement, any tenant member can act
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

  -- 8) Self-approval prevention (unless Owner)
  IF p_action = 'approved' AND v_instance.started_by = v_user_id AND v_user_role != 'owner' THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (v_instance.tenant_id, v_user_id, 'workflow_approval_denied', 'workflow_instance', p_instance_id::TEXT, 'محاولة موافقة ذاتية');
    RAISE EXCEPTION 'لا يمكنك الموافقة على سير العمل الذي أنشأته بنفسك';
  END IF;

  -- 9) Execute the action
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
    -- Check if there are more steps
    v_next_order := v_instance.current_step_order + 1;
    SELECT EXISTS(
      SELECT 1 FROM workflow_steps ws
      JOIN workflow_instances wi ON wi.workflow_id = ws.workflow_id
      WHERE wi.id = p_instance_id AND ws.step_order >= v_next_order
    ) INTO v_has_more;

    IF NOT v_has_more THEN
      UPDATE workflow_instances
      SET status = 'approved', completed_at = now()
      WHERE id = p_instance_id;
      v_final_status := 'approved';
    ELSE
      UPDATE workflow_instances
      SET current_step_order = v_next_order
      WHERE id = p_instance_id;
      v_final_status := 'in_progress';
    END IF;
  END IF;

  -- 10) Audit log
  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (
    v_instance.tenant_id,
    v_user_id,
    CASE p_action WHEN 'approved' THEN 'workflow_approved' ELSE 'workflow_rejected' END,
    'workflow_instance',
    p_instance_id::TEXT,
    COALESCE(v_step_def.name, 'خطوة'),
    jsonb_build_object(
      'step_order', v_instance.current_step_order,
      'comment', p_comment,
      'final_status', v_final_status
    )
  );

  RETURN jsonb_build_object('status', v_final_status, 'step_order', v_instance.current_step_order);
END;
$$;

-- Same function for legacy approval_requests system
CREATE OR REPLACE FUNCTION public.secure_approval_action(
  p_action_id UUID,
  p_request_id UUID,
  p_decision TEXT,      -- 'approved' or 'rejected'
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
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

  -- Get the step to check approver_role
  SELECT aws.* INTO v_step
  FROM approval_workflow_steps aws
  JOIN approval_actions aa ON aa.step_id = aws.id
  WHERE aa.id = p_action_id;

  -- RBAC check (owner bypasses)
  IF v_user_role != 'owner' THEN
    IF v_step.approver_role IS NOT NULL AND v_user_role != v_step.approver_role AND v_user_role != 'admin' THEN
      INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
      VALUES (v_request.tenant_id, v_user_id, 'workflow_approval_denied', 'approval_request', p_request_id::TEXT, 'صلاحيات غير كافية',
              jsonb_build_object('required_role', v_step.approver_role, 'user_role', v_user_role));
      RAISE EXCEPTION 'ليس لديك الصلاحيات اللازمة. مطلوب دور: %', v_step.approver_role;
    END IF;

    -- Self-approval prevention
    IF p_decision = 'approved' AND v_request.requested_by = v_user_id THEN
      INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
      VALUES (v_request.tenant_id, v_user_id, 'workflow_approval_denied', 'approval_request', p_request_id::TEXT, 'محاولة موافقة ذاتية');
      RAISE EXCEPTION 'لا يمكنك الموافقة على طلبك بنفسك';
    END IF;
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

-- Lock down access
REVOKE EXECUTE ON FUNCTION public.secure_workflow_action FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secure_workflow_action TO service_role;

REVOKE EXECUTE ON FUNCTION public.secure_approval_action FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secure_approval_action TO service_role;
