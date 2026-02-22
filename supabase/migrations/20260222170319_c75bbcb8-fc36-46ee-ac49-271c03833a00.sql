
-- ═══════════════════════════════════════════════════════════
-- HR Core v1 — Tables, RLS, Permissions, Role Templates
-- ═══════════════════════════════════════════════════════════

-- ── 1) ENUM TYPES ──
CREATE TYPE public.hr_employee_status AS ENUM ('active', 'on_leave', 'suspended', 'terminated', 'resigned');
CREATE TYPE public.hr_contract_type AS ENUM ('full_time', 'part_time', 'contract', 'internship', 'probation');
CREATE TYPE public.hr_leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE public.hr_attendance_source AS ENUM ('manual', 'csv_import', 'biometric', 'system');
CREATE TYPE public.hr_import_status AS ENUM ('pending', 'validating', 'validated', 'importing', 'completed', 'failed');

-- ── 2) ORG STRUCTURE ──
CREATE TABLE public.org_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, name_en TEXT,
  parent_id UUID REFERENCES public.org_departments(id),
  manager_id UUID, code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_org_departments_tenant ON public.org_departments(tenant_id);

CREATE TABLE public.org_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.org_departments(id),
  title TEXT NOT NULL, title_en TEXT, grade TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_org_positions_tenant ON public.org_positions(tenant_id);

-- ── 3) HR EMPLOYEES ──
CREATE TABLE public.hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID,
  employee_number TEXT NOT NULL,
  first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  first_name_en TEXT, last_name_en TEXT,
  email TEXT, phone TEXT, national_id TEXT,
  date_of_birth DATE, gender TEXT, nationality TEXT,
  department_id UUID REFERENCES public.org_departments(id),
  position_id UUID REFERENCES public.org_positions(id),
  manager_id UUID REFERENCES public.hr_employees(id),
  branch_id UUID REFERENCES public.branches(id),
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.hr_employee_status NOT NULL DEFAULT 'active',
  avatar_url TEXT, address JSONB, bank_details JSONB,
  emergency_contact JSONB, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, employee_number)
);
CREATE INDEX idx_hr_employees_tenant ON public.hr_employees(tenant_id);
CREATE INDEX idx_hr_employees_dept ON public.hr_employees(department_id);
CREATE INDEX idx_hr_employees_manager ON public.hr_employees(manager_id);
CREATE INDEX idx_hr_employees_user ON public.hr_employees(user_id);

ALTER TABLE public.org_departments ADD CONSTRAINT fk_dept_manager FOREIGN KEY (manager_id) REFERENCES public.hr_employees(id);

-- ── 4) HR CONTRACTS ──
CREATE TABLE public.hr_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL,
  contract_type public.hr_contract_type NOT NULL DEFAULT 'full_time',
  start_date DATE NOT NULL, end_date DATE,
  basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  housing_allowance NUMERIC(12,2) DEFAULT 0,
  transport_allowance NUMERIC(12,2) DEFAULT 0,
  other_allowances NUMERIC(12,2) DEFAULT 0,
  total_salary NUMERIC(12,2) GENERATED ALWAYS AS (basic_salary + COALESCE(housing_allowance,0) + COALESCE(transport_allowance,0) + COALESCE(other_allowances,0)) STORED,
  currency TEXT NOT NULL DEFAULT 'SAR',
  probation_end_date DATE, is_current BOOLEAN NOT NULL DEFAULT true,
  terms_json JSONB, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, contract_number)
);
CREATE INDEX idx_hr_contracts_tenant ON public.hr_contracts(tenant_id);
CREATE INDEX idx_hr_contracts_employee ON public.hr_contracts(employee_id);

-- ── 5) LEAVE ──
CREATE TABLE public.hr_leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, name_en TEXT, code TEXT,
  default_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  requires_attachment BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_leave_types_tenant ON public.hr_leave_types(tenant_id);

CREATE TABLE public.hr_leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.hr_leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  entitled_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  used_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  remaining_days NUMERIC(5,1) GENERATED ALWAYS AS (entitled_days - used_days) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, employee_id, leave_type_id, year)
);
CREATE INDEX idx_hr_leave_balances_tenant ON public.hr_leave_balances(tenant_id);

CREATE TABLE public.hr_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.hr_leave_types(id),
  start_date DATE NOT NULL, end_date DATE NOT NULL,
  days_count NUMERIC(5,1) NOT NULL,
  status public.hr_leave_status NOT NULL DEFAULT 'pending',
  reason TEXT, attachment_url TEXT,
  reviewed_by UUID REFERENCES public.hr_employees(id),
  reviewed_at TIMESTAMPTZ, review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_leave_requests_tenant ON public.hr_leave_requests(tenant_id);
CREATE INDEX idx_hr_leave_requests_employee ON public.hr_leave_requests(employee_id);
CREATE INDEX idx_hr_leave_requests_status ON public.hr_leave_requests(status);

-- ── 6) ATTENDANCE ──
CREATE TABLE public.hr_attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  log_date DATE NOT NULL, check_in TIMESTAMPTZ, check_out TIMESTAMPTZ,
  worked_hours NUMERIC(5,2), overtime_hours NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'present',
  source public.hr_attendance_source NOT NULL DEFAULT 'manual',
  import_job_id UUID, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_attendance_tenant ON public.hr_attendance_logs(tenant_id);
CREATE INDEX idx_hr_attendance_employee_date ON public.hr_attendance_logs(employee_id, log_date);

-- ── 7) IMPORT JOBS ──
CREATE TABLE public.hr_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL DEFAULT 'attendance',
  file_name TEXT, total_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0, error_rows INTEGER DEFAULT 0,
  errors_json JSONB,
  status public.hr_import_status NOT NULL DEFAULT 'pending',
  imported_by UUID NOT NULL, completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_import_jobs_tenant ON public.hr_import_jobs(tenant_id);
ALTER TABLE public.hr_attendance_logs ADD CONSTRAINT fk_attendance_import FOREIGN KEY (import_job_id) REFERENCES public.hr_import_jobs(id);

-- ── 8) ALLOWANCES (payroll-ready) ──
CREATE TABLE public.hr_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, name_en TEXT, code TEXT,
  is_taxable BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_allowances_tenant ON public.hr_allowances(tenant_id);

CREATE TABLE public.hr_employee_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  allowance_id UUID NOT NULL REFERENCES public.hr_allowances(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE, is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_emp_allowances_tenant ON public.hr_employee_allowances(tenant_id);

-- ── 9) ENABLE RLS ──
ALTER TABLE public.org_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_allowances ENABLE ROW LEVEL SECURITY;

-- ── 10) SECURITY DEFINER HELPERS ──
-- Uses tenant_members → custom_roles(base_role) → role_permissions chain
CREATE OR REPLACE FUNCTION public.is_hr_manager(p_user_id UUID, p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    JOIN public.custom_roles cr ON cr.tenant_id = p_tenant_id AND cr.base_role = tm.role
    JOIN public.role_permissions rp ON rp.role_id = cr.id AND rp.tenant_id = p_tenant_id
    WHERE tm.user_id = p_user_id
      AND tm.tenant_id = p_tenant_id
      AND rp.permission_key IN ('hr.manage_employees', 'hr.manage_org')
  )
  OR EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.user_id = p_user_id AND tm.tenant_id = p_tenant_id AND tm.role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_employee_id(p_user_id UUID, p_tenant_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.hr_employees
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of(p_user_id UUID, p_employee_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = p_employee_id
      AND e.manager_id = (SELECT id FROM public.hr_employees WHERE user_id = p_user_id AND tenant_id = e.tenant_id LIMIT 1)
  )
$$;

-- ── 11) RLS POLICIES ──
CREATE POLICY "dept_tenant_read" ON public.org_departments FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "dept_hr_write" ON public.org_departments FOR ALL
  USING (public.is_hr_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_hr_manager(auth.uid(), tenant_id));

CREATE POLICY "pos_tenant_read" ON public.org_positions FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "pos_hr_write" ON public.org_positions FOR ALL
  USING (public.is_hr_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_hr_manager(auth.uid(), tenant_id));

CREATE POLICY "emp_hr_all" ON public.hr_employees FOR ALL
  USING (public.is_hr_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_hr_manager(auth.uid(), tenant_id));
CREATE POLICY "emp_self_read" ON public.hr_employees FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "emp_manager_read" ON public.hr_employees FOR SELECT
  USING (manager_id = public.get_employee_id(auth.uid(), tenant_id));

CREATE POLICY "contract_hr_all" ON public.hr_contracts FOR ALL
  USING (public.is_hr_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_hr_manager(auth.uid(), tenant_id));
CREATE POLICY "contract_self_read" ON public.hr_contracts FOR SELECT
  USING (employee_id IN (SELECT id FROM public.hr_employees WHERE user_id = auth.uid()));

CREATE POLICY "lt_tenant_read" ON public.hr_leave_types FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "lt_hr_write" ON public.hr_leave_types FOR ALL
  USING (public.is_hr_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_hr_manager(auth.uid(), tenant_id));

CREATE POLICY "lb_hr_all" ON public.hr_leave_balances FOR ALL
  USING (public.is_hr_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_hr_manager(auth.uid(), tenant_id));
CREATE POLICY "lb_self_read" ON public.hr_leave_balances FOR SELECT
  USING (employee_id IN (SELECT id FROM public.hr_employees WHERE user_id = auth.uid()));

CREATE POLICY "lr_hr_all" ON public.hr_leave_requests FOR ALL
  USING (public.is_hr_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_hr_manager(auth.uid(), tenant_id));
CREATE POLICY "lr_self_all" ON public.hr_leave_requests FOR ALL
  USING (employee_id IN (SELECT id FROM public.hr_employees WHERE user_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM public.hr_employees WHERE user_id = auth.uid()));
CREATE POLICY "lr_manager_read" ON public.hr_leave_requests FOR SELECT
  USING (public.is_manager_of(auth.uid(), employee_id));
CREATE POLICY "lr_manager_update" ON public.hr_leave_requests FOR UPDATE
  USING (public.is_manager_of(auth.uid(), employee_id));

CREATE POLICY "att_hr_all" ON public.hr_attendance_logs FOR ALL
  USING (public.is_hr_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_hr_manager(auth.uid(), tenant_id));
CREATE POLICY "att_self_read" ON public.hr_attendance_logs FOR SELECT
  USING (employee_id IN (SELECT id FROM public.hr_employees WHERE user_id = auth.uid()));

CREATE POLICY "import_hr_all" ON public.hr_import_jobs FOR ALL
  USING (public.is_hr_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_hr_manager(auth.uid(), tenant_id));

CREATE POLICY "allow_tenant_read" ON public.hr_allowances FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "allow_hr_write" ON public.hr_allowances FOR ALL
  USING (public.is_hr_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_hr_manager(auth.uid(), tenant_id));

CREATE POLICY "emp_allow_hr_all" ON public.hr_employee_allowances FOR ALL
  USING (public.is_hr_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_hr_manager(auth.uid(), tenant_id));
CREATE POLICY "emp_allow_self_read" ON public.hr_employee_allowances FOR SELECT
  USING (employee_id IN (SELECT id FROM public.hr_employees WHERE user_id = auth.uid()));

-- ── 12) UPDATED_AT TRIGGERS ──
CREATE OR REPLACE FUNCTION public.hr_update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_org_departments_updated BEFORE UPDATE ON public.org_departments FOR EACH ROW EXECUTE FUNCTION public.hr_update_updated_at();
CREATE TRIGGER trg_org_positions_updated BEFORE UPDATE ON public.org_positions FOR EACH ROW EXECUTE FUNCTION public.hr_update_updated_at();
CREATE TRIGGER trg_hr_employees_updated BEFORE UPDATE ON public.hr_employees FOR EACH ROW EXECUTE FUNCTION public.hr_update_updated_at();
CREATE TRIGGER trg_hr_contracts_updated BEFORE UPDATE ON public.hr_contracts FOR EACH ROW EXECUTE FUNCTION public.hr_update_updated_at();
CREATE TRIGGER trg_hr_leave_types_updated BEFORE UPDATE ON public.hr_leave_types FOR EACH ROW EXECUTE FUNCTION public.hr_update_updated_at();
CREATE TRIGGER trg_hr_leave_balances_updated BEFORE UPDATE ON public.hr_leave_balances FOR EACH ROW EXECUTE FUNCTION public.hr_update_updated_at();
CREATE TRIGGER trg_hr_leave_requests_updated BEFORE UPDATE ON public.hr_leave_requests FOR EACH ROW EXECUTE FUNCTION public.hr_update_updated_at();
CREATE TRIGGER trg_hr_attendance_updated BEFORE UPDATE ON public.hr_attendance_logs FOR EACH ROW EXECUTE FUNCTION public.hr_update_updated_at();
CREATE TRIGGER trg_hr_import_jobs_updated BEFORE UPDATE ON public.hr_import_jobs FOR EACH ROW EXECUTE FUNCTION public.hr_update_updated_at();

-- ── 13) PERMISSION DEFINITIONS ──
INSERT INTO public.permission_definitions (key, name_ar, name_en, category, sort_order) VALUES
  ('hr.view', 'عرض الموارد البشرية', 'View HR', 'hr', 800),
  ('hr.manage_employees', 'إدارة الموظفين', 'Manage Employees', 'hr', 801),
  ('hr.manage_contracts', 'إدارة العقود', 'Manage Contracts', 'hr', 802),
  ('hr.manage_org', 'إدارة الهيكل التنظيمي', 'Manage Org Structure', 'hr', 803),
  ('hr.manage_leave', 'إدارة الإجازات', 'Manage Leave', 'hr', 804),
  ('hr.approve_leave', 'اعتماد الإجازات', 'Approve Leave', 'hr', 805),
  ('hr.manage_attendance', 'إدارة الحضور', 'Manage Attendance', 'hr', 806),
  ('hr.import_attendance', 'استيراد بيانات الحضور', 'Import Attendance', 'hr', 807),
  ('hr.view_reports', 'عرض تقارير HR', 'View HR Reports', 'hr', 808)
ON CONFLICT (key) DO NOTHING;

-- ── 14) ROLE TEMPLATE PERMISSIONS ──
INSERT INTO public.role_template_permissions (template_id, permission_key)
SELECT rt.id, pd.key FROM public.role_templates rt CROSS JOIN public.permission_definitions pd
WHERE rt.key = 'owner' AND pd.key LIKE 'hr.%' ON CONFLICT DO NOTHING;

INSERT INTO public.role_template_permissions (template_id, permission_key)
SELECT rt.id, pd.key FROM public.role_templates rt CROSS JOIN public.permission_definitions pd
WHERE rt.key = 'cfo' AND pd.key IN ('hr.view', 'hr.view_reports') ON CONFLICT DO NOTHING;

INSERT INTO public.role_templates (key, name_ar, name_en, description_ar, description_en, icon, is_enterprise_only)
VALUES ('hr_manager', 'مدير الموارد البشرية', 'HR Manager', 'صلاحيات كاملة لإدارة الموارد البشرية', 'Full HR management access', 'Users', false)
ON CONFLICT (key) DO NOTHING;
INSERT INTO public.role_template_permissions (template_id, permission_key)
SELECT rt.id, pd.key FROM public.role_templates rt CROSS JOIN public.permission_definitions pd
WHERE rt.key = 'hr_manager' AND pd.key LIKE 'hr.%' ON CONFLICT DO NOTHING;

INSERT INTO public.role_templates (key, name_ar, name_en, description_ar, description_en, icon, is_enterprise_only)
VALUES ('hr_officer', 'موظف موارد بشرية', 'HR Officer', 'صلاحيات تشغيلية للموارد البشرية', 'Operational HR access', 'UserCheck', false)
ON CONFLICT (key) DO NOTHING;
INSERT INTO public.role_template_permissions (template_id, permission_key)
SELECT rt.id, pd.key FROM public.role_templates rt CROSS JOIN public.permission_definitions pd
WHERE rt.key = 'hr_officer' AND pd.key IN ('hr.view', 'hr.manage_employees', 'hr.manage_leave', 'hr.manage_attendance', 'hr.import_attendance')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_template_permissions (template_id, permission_key)
SELECT rt.id, unnest(ARRAY['hr.view', 'hr.approve_leave'])
FROM public.role_templates rt WHERE rt.key = 'manager' ON CONFLICT DO NOTHING;

-- ── 15) LEAVE BALANCE AUTO-UPDATE TRIGGER ──
CREATE OR REPLACE FUNCTION public.hr_update_leave_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE public.hr_leave_balances SET used_days = used_days + NEW.days_count
    WHERE tenant_id = NEW.tenant_id AND employee_id = NEW.employee_id
      AND leave_type_id = NEW.leave_type_id AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status = 'approved' THEN
    UPDATE public.hr_leave_balances SET used_days = GREATEST(0, used_days - NEW.days_count)
    WHERE tenant_id = NEW.tenant_id AND employee_id = NEW.employee_id
      AND leave_type_id = NEW.leave_type_id AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_leave_balance_update AFTER UPDATE ON public.hr_leave_requests
FOR EACH ROW EXECUTE FUNCTION public.hr_update_leave_balance();

-- ── 16) ENTITLEMENT ──
INSERT INTO public.plan_entitlements (plan_id, feature_key, is_enabled)
SELECT sp.id, 'hr', true FROM public.subscription_plans sp
WHERE sp.slug IN ('business', 'enterprise') ON CONFLICT DO NOTHING;
