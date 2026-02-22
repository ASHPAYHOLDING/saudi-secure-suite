
-- ═══════════════════════════════════════════════════════════
-- HR Core v2 — Granular RLS Policies
-- Replaces blanket ALL policies with per-operation policies
-- Adds HR Officer role, sensitive data protection, team scope
-- ═══════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────┐
-- │  1. NEW SECURITY DEFINER FUNCTIONS                   │
-- └─────────────────────────────────────────────────────┘

-- HR Officer: has hr.manage_* but NOT owner/admin level
CREATE OR REPLACE FUNCTION public.is_hr_officer(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    JOIN public.custom_roles cr ON cr.tenant_id = p_tenant_id AND cr.base_role = tm.role
    JOIN public.role_permissions rp ON rp.role_id = cr.id AND rp.tenant_id = p_tenant_id
    WHERE tm.user_id = p_user_id
      AND tm.tenant_id = p_tenant_id
      AND rp.permission_key IN ('hr.manage_employees','hr.manage_contracts','hr.manage_leave','hr.manage_attendance')
  )
$$;

-- Check if user has a specific HR permission
CREATE OR REPLACE FUNCTION public.has_hr_permission(p_user_id uuid, p_tenant_id uuid, p_perm text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.user_id = p_user_id AND tm.tenant_id = p_tenant_id AND tm.role = 'owner'
  )
  OR EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    JOIN public.custom_roles cr ON cr.tenant_id = p_tenant_id AND cr.base_role = tm.role
    JOIN public.role_permissions rp ON rp.role_id = cr.id AND rp.tenant_id = p_tenant_id
    WHERE tm.user_id = p_user_id
      AND tm.tenant_id = p_tenant_id
      AND rp.permission_key = p_perm
  )
$$;

-- Check if user is a tenant member (any role)
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  )
$$;

-- Get IDs of direct reports for a manager
CREATE OR REPLACE FUNCTION public.get_direct_report_ids(p_user_id uuid, p_tenant_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT e.id FROM public.hr_employees e
  WHERE e.tenant_id = p_tenant_id
    AND e.manager_id = (
      SELECT id FROM public.hr_employees
      WHERE user_id = p_user_id AND tenant_id = p_tenant_id LIMIT 1
    )
$$;


-- ┌─────────────────────────────────────────────────────┐
-- │  2. SECURE VIEW FOR SENSITIVE EMPLOYEE DATA          │
-- │  (hides national_id, bank_details from non-HR)       │
-- └─────────────────────────────────────────────────────┘

CREATE OR REPLACE VIEW public.hr_employees_safe AS
SELECT
  id, tenant_id, user_id, employee_number,
  first_name, last_name, first_name_en, last_name_en,
  email, phone,
  -- Sensitive: only HR/Owner can see
  CASE WHEN is_hr_manager(auth.uid(), tenant_id) THEN national_id ELSE NULL END AS national_id,
  date_of_birth, gender, nationality,
  department_id, position_id, manager_id, branch_id,
  hire_date, status, avatar_url, address,
  -- Sensitive: bank_details hidden from non-HR
  CASE WHEN is_hr_manager(auth.uid(), tenant_id) THEN bank_details ELSE NULL END AS bank_details,
  emergency_contact, notes, created_at, updated_at
FROM public.hr_employees;


-- ┌─────────────────────────────────────────────────────┐
-- │  3. DROP ALL EXISTING HR POLICIES                    │
-- └─────────────────────────────────────────────────────┘

-- hr_employees
DROP POLICY IF EXISTS emp_hr_all ON public.hr_employees;
DROP POLICY IF EXISTS emp_self_read ON public.hr_employees;
DROP POLICY IF EXISTS emp_manager_read ON public.hr_employees;

-- hr_contracts
DROP POLICY IF EXISTS contract_hr_all ON public.hr_contracts;
DROP POLICY IF EXISTS contract_self_read ON public.hr_contracts;

-- hr_leave_types
DROP POLICY IF EXISTS lt_hr_write ON public.hr_leave_types;
DROP POLICY IF EXISTS lt_tenant_read ON public.hr_leave_types;

-- hr_leave_balances
DROP POLICY IF EXISTS lb_hr_all ON public.hr_leave_balances;
DROP POLICY IF EXISTS lb_self_read ON public.hr_leave_balances;

-- hr_leave_requests
DROP POLICY IF EXISTS lr_hr_all ON public.hr_leave_requests;
DROP POLICY IF EXISTS lr_self_all ON public.hr_leave_requests;
DROP POLICY IF EXISTS lr_manager_read ON public.hr_leave_requests;
DROP POLICY IF EXISTS lr_manager_update ON public.hr_leave_requests;

-- hr_attendance_logs
DROP POLICY IF EXISTS att_hr_all ON public.hr_attendance_logs;
DROP POLICY IF EXISTS att_self_read ON public.hr_attendance_logs;

-- hr_import_jobs
DROP POLICY IF EXISTS import_hr_all ON public.hr_import_jobs;

-- hr_allowances
DROP POLICY IF EXISTS allow_hr_write ON public.hr_allowances;
DROP POLICY IF EXISTS allow_tenant_read ON public.hr_allowances;

-- hr_employee_allowances
DROP POLICY IF EXISTS emp_allow_hr_all ON public.hr_employee_allowances;
DROP POLICY IF EXISTS emp_allow_self_read ON public.hr_employee_allowances;

-- org_departments
DROP POLICY IF EXISTS dept_hr_write ON public.org_departments;
DROP POLICY IF EXISTS dept_tenant_read ON public.org_departments;

-- org_positions
DROP POLICY IF EXISTS pos_hr_write ON public.org_positions;
DROP POLICY IF EXISTS pos_tenant_read ON public.org_positions;


-- ┌─────────────────────────────────────────────────────┐
-- │  4. HR_EMPLOYEES — Granular Policies                 │
-- └─────────────────────────────────────────────────────┘

-- SELECT: Employee reads own | Manager reads direct reports | HR reads all in tenant
CREATE POLICY hr_emp_select_self ON public.hr_employees FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY hr_emp_select_manager ON public.hr_employees FOR SELECT
  USING (manager_id = get_employee_id(auth.uid(), tenant_id));

CREATE POLICY hr_emp_select_hr ON public.hr_employees FOR SELECT
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.view'));

-- INSERT: HR Manager only
CREATE POLICY hr_emp_insert ON public.hr_employees FOR INSERT
  WITH CHECK (is_hr_manager(auth.uid(), tenant_id));

-- UPDATE: HR Manager full | HR Officer full (no distinction at row level, column restrictions via app)
CREATE POLICY hr_emp_update_hr ON public.hr_employees FOR UPDATE
  USING (is_hr_officer(auth.uid(), tenant_id))
  WITH CHECK (is_hr_officer(auth.uid(), tenant_id));

-- DELETE: Owner/HR Manager only (NOT HR Officer)
CREATE POLICY hr_emp_delete ON public.hr_employees FOR DELETE
  USING (is_hr_manager(auth.uid(), tenant_id));


-- ┌─────────────────────────────────────────────────────┐
-- │  5. HR_CONTRACTS — Granular Policies                 │
-- └─────────────────────────────────────────────────────┘

CREATE POLICY hr_contract_select_self ON public.hr_contracts FOR SELECT
  USING (employee_id = get_employee_id(auth.uid(), tenant_id));

CREATE POLICY hr_contract_select_hr ON public.hr_contracts FOR SELECT
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_contracts'));

CREATE POLICY hr_contract_insert ON public.hr_contracts FOR INSERT
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_contracts'));

CREATE POLICY hr_contract_update ON public.hr_contracts FOR UPDATE
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_contracts'))
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_contracts'));

-- DELETE: HR Manager/Owner only
CREATE POLICY hr_contract_delete ON public.hr_contracts FOR DELETE
  USING (is_hr_manager(auth.uid(), tenant_id));


-- ┌─────────────────────────────────────────────────────┐
-- │  6. HR_LEAVE_TYPES — Granular Policies               │
-- └─────────────────────────────────────────────────────┘

-- SELECT: Any tenant member can read leave types
CREATE POLICY hr_lt_select ON public.hr_leave_types FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

-- INSERT/UPDATE: HR with manage_leave permission
CREATE POLICY hr_lt_insert ON public.hr_leave_types FOR INSERT
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_leave'));

CREATE POLICY hr_lt_update ON public.hr_leave_types FOR UPDATE
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_leave'))
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_leave'));

-- DELETE: HR Manager/Owner only
CREATE POLICY hr_lt_delete ON public.hr_leave_types FOR DELETE
  USING (is_hr_manager(auth.uid(), tenant_id));


-- ┌─────────────────────────────────────────────────────┐
-- │  7. HR_LEAVE_BALANCES — Granular Policies            │
-- └─────────────────────────────────────────────────────┘

CREATE POLICY hr_lb_select_self ON public.hr_leave_balances FOR SELECT
  USING (employee_id = get_employee_id(auth.uid(), tenant_id));

CREATE POLICY hr_lb_select_hr ON public.hr_leave_balances FOR SELECT
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_leave'));

CREATE POLICY hr_lb_insert ON public.hr_leave_balances FOR INSERT
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_leave'));

CREATE POLICY hr_lb_update ON public.hr_leave_balances FOR UPDATE
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_leave'))
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_leave'));

CREATE POLICY hr_lb_delete ON public.hr_leave_balances FOR DELETE
  USING (is_hr_manager(auth.uid(), tenant_id));


-- ┌─────────────────────────────────────────────────────┐
-- │  8. HR_LEAVE_REQUESTS — Most Complex                 │
-- └─────────────────────────────────────────────────────┘

-- SELECT: Employee reads own
CREATE POLICY hr_lr_select_self ON public.hr_leave_requests FOR SELECT
  USING (employee_id = get_employee_id(auth.uid(), tenant_id));

-- SELECT: Manager reads direct reports' requests
CREATE POLICY hr_lr_select_manager ON public.hr_leave_requests FOR SELECT
  USING (employee_id IN (SELECT get_direct_report_ids(auth.uid(), tenant_id)));

-- SELECT: HR reads all in tenant
CREATE POLICY hr_lr_select_hr ON public.hr_leave_requests FOR SELECT
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_leave'));

-- INSERT: Employee creates own request only
CREATE POLICY hr_lr_insert_self ON public.hr_leave_requests FOR INSERT
  WITH CHECK (employee_id = get_employee_id(auth.uid(), tenant_id));

-- INSERT: HR can create on behalf
CREATE POLICY hr_lr_insert_hr ON public.hr_leave_requests FOR INSERT
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_leave'));

-- UPDATE: Manager approves/rejects direct reports (status + reviewed_at only enforced at app level)
CREATE POLICY hr_lr_update_manager ON public.hr_leave_requests FOR UPDATE
  USING (
    employee_id IN (SELECT get_direct_report_ids(auth.uid(), tenant_id))
    OR has_hr_permission(auth.uid(), tenant_id, 'hr.approve_leave')
  );

-- UPDATE: HR can update any request in tenant
CREATE POLICY hr_lr_update_hr ON public.hr_leave_requests FOR UPDATE
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_leave'))
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_leave'));

-- UPDATE: Employee can cancel own pending request
CREATE POLICY hr_lr_update_self_cancel ON public.hr_leave_requests FOR UPDATE
  USING (
    employee_id = get_employee_id(auth.uid(), tenant_id)
    AND status = 'pending'
  );

-- DELETE: HR Manager/Owner only
CREATE POLICY hr_lr_delete ON public.hr_leave_requests FOR DELETE
  USING (is_hr_manager(auth.uid(), tenant_id));


-- ┌─────────────────────────────────────────────────────┐
-- │  9. HR_ATTENDANCE_LOGS — Granular Policies           │
-- └─────────────────────────────────────────────────────┘

CREATE POLICY hr_att_select_self ON public.hr_attendance_logs FOR SELECT
  USING (employee_id = get_employee_id(auth.uid(), tenant_id));

CREATE POLICY hr_att_select_manager ON public.hr_attendance_logs FOR SELECT
  USING (employee_id IN (SELECT get_direct_report_ids(auth.uid(), tenant_id)));

CREATE POLICY hr_att_select_hr ON public.hr_attendance_logs FOR SELECT
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_attendance'));

CREATE POLICY hr_att_insert ON public.hr_attendance_logs FOR INSERT
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_attendance'));

CREATE POLICY hr_att_update ON public.hr_attendance_logs FOR UPDATE
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_attendance'))
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_attendance'));

-- DELETE: HR Manager/Owner only
CREATE POLICY hr_att_delete ON public.hr_attendance_logs FOR DELETE
  USING (is_hr_manager(auth.uid(), tenant_id));


-- ┌─────────────────────────────────────────────────────┐
-- │  10. HR_IMPORT_JOBS — Granular Policies              │
-- └─────────────────────────────────────────────────────┘

CREATE POLICY hr_import_select ON public.hr_import_jobs FOR SELECT
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.import_attendance'));

CREATE POLICY hr_import_insert ON public.hr_import_jobs FOR INSERT
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.import_attendance'));

CREATE POLICY hr_import_update ON public.hr_import_jobs FOR UPDATE
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.import_attendance'))
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.import_attendance'));

-- DELETE: HR Manager only
CREATE POLICY hr_import_delete ON public.hr_import_jobs FOR DELETE
  USING (is_hr_manager(auth.uid(), tenant_id));


-- ┌─────────────────────────────────────────────────────┐
-- │  11. HR_ALLOWANCES — Granular Policies               │
-- └─────────────────────────────────────────────────────┘

CREATE POLICY hr_allow_select ON public.hr_allowances FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY hr_allow_insert ON public.hr_allowances FOR INSERT
  WITH CHECK (is_hr_manager(auth.uid(), tenant_id));

CREATE POLICY hr_allow_update ON public.hr_allowances FOR UPDATE
  USING (is_hr_manager(auth.uid(), tenant_id))
  WITH CHECK (is_hr_manager(auth.uid(), tenant_id));

CREATE POLICY hr_allow_delete ON public.hr_allowances FOR DELETE
  USING (is_hr_manager(auth.uid(), tenant_id));


-- ┌─────────────────────────────────────────────────────┐
-- │  12. HR_EMPLOYEE_ALLOWANCES — Granular Policies      │
-- └─────────────────────────────────────────────────────┘

CREATE POLICY hr_emp_allow_select_self ON public.hr_employee_allowances FOR SELECT
  USING (employee_id = get_employee_id(auth.uid(), (SELECT tenant_id FROM hr_allowances WHERE id = allowance_id LIMIT 1)));

CREATE POLICY hr_emp_allow_select_hr ON public.hr_employee_allowances FOR SELECT
  USING (is_hr_officer(auth.uid(), (SELECT tenant_id FROM hr_allowances WHERE id = allowance_id LIMIT 1)));

CREATE POLICY hr_emp_allow_insert ON public.hr_employee_allowances FOR INSERT
  WITH CHECK (is_hr_officer(auth.uid(), (SELECT tenant_id FROM hr_allowances WHERE id = allowance_id LIMIT 1)));

CREATE POLICY hr_emp_allow_update ON public.hr_employee_allowances FOR UPDATE
  USING (is_hr_officer(auth.uid(), (SELECT tenant_id FROM hr_allowances WHERE id = allowance_id LIMIT 1)));

CREATE POLICY hr_emp_allow_delete ON public.hr_employee_allowances FOR DELETE
  USING (is_hr_manager(auth.uid(), (SELECT tenant_id FROM hr_allowances WHERE id = allowance_id LIMIT 1)));


-- ┌─────────────────────────────────────────────────────┐
-- │  13. ORG_DEPARTMENTS — Granular Policies             │
-- └─────────────────────────────────────────────────────┘

CREATE POLICY hr_dept_select ON public.org_departments FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY hr_dept_insert ON public.org_departments FOR INSERT
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_org'));

CREATE POLICY hr_dept_update ON public.org_departments FOR UPDATE
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_org'))
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_org'));

CREATE POLICY hr_dept_delete ON public.org_departments FOR DELETE
  USING (is_hr_manager(auth.uid(), tenant_id));


-- ┌─────────────────────────────────────────────────────┐
-- │  14. ORG_POSITIONS — Granular Policies               │
-- └─────────────────────────────────────────────────────┘

CREATE POLICY hr_pos_select ON public.org_positions FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY hr_pos_insert ON public.org_positions FOR INSERT
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_org'));

CREATE POLICY hr_pos_update ON public.org_positions FOR UPDATE
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_org'))
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_org'));

CREATE POLICY hr_pos_delete ON public.org_positions FOR DELETE
  USING (is_hr_manager(auth.uid(), tenant_id));


-- ┌─────────────────────────────────────────────────────┐
-- │  15. PERFORMANCE INDEXES for RLS functions           │
-- └─────────────────────────────────────────────────────┘

CREATE INDEX IF NOT EXISTS idx_hr_employees_user_tenant ON public.hr_employees(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_manager_tenant ON public.hr_employees(manager_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_employee ON public.hr_leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee_date ON public.hr_attendance_logs(employee_id, log_date);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user_tenant ON public.tenant_members(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_tenant ON public.role_permissions(role_id, tenant_id, permission_key);
