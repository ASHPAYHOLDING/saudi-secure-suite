
-- 1. Insert permission definitions first
INSERT INTO public.permission_definitions (key, name_ar, name_en, category, description)
VALUES
  ('ess.view', 'عرض بوابة الموظف', 'View ESS Portal', 'hr', 'View employee self-service portal'),
  ('ess.request_leave', 'تقديم طلب إجازة', 'Request Leave', 'hr', 'Submit leave requests'),
  ('ess.view_payslip', 'عرض كشف الراتب', 'View Payslip', 'hr', 'View own payslips'),
  ('ess.view_attendance', 'عرض سجل الحضور', 'View Attendance', 'hr', 'View own attendance records')
ON CONFLICT (key) DO NOTHING;

-- 2. Seed ESS permissions for all roles
INSERT INTO public.role_permissions (tenant_id, role_id, permission_key)
SELECT cr.tenant_id, cr.id, p.key
FROM public.custom_roles cr
CROSS JOIN (VALUES ('ess.view'), ('ess.request_leave'), ('ess.view_payslip'), ('ess.view_attendance')) AS p(key)
WHERE cr.name IN ('owner', 'admin', 'hr', 'member')
ON CONFLICT (tenant_id, role_id, permission_key) DO NOTHING;

-- 3. RLS for employee self-service on existing tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ess_leave_own_select' AND tablename = 'hr_leave_requests') THEN
    CREATE POLICY "ess_leave_own_select" ON public.hr_leave_requests
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.hr_employees WHERE hr_employees.id = employee_id AND hr_employees.user_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ess_leave_own_insert' AND tablename = 'hr_leave_requests') THEN
    CREATE POLICY "ess_leave_own_insert" ON public.hr_leave_requests
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.hr_employees WHERE hr_employees.id = employee_id AND hr_employees.user_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ess_attendance_own_select' AND tablename = 'hr_attendance_logs') THEN
    CREATE POLICY "ess_attendance_own_select" ON public.hr_attendance_logs
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.hr_employees WHERE hr_employees.id = employee_id AND hr_employees.user_id = auth.uid())
      );
  END IF;
END $$;
