
-- Fix: Set hr_employees_safe view to SECURITY INVOKER (default, but explicit)
-- This ensures RLS policies of the querying user are applied, not the view creator
DROP VIEW IF EXISTS public.hr_employees_safe;

CREATE VIEW public.hr_employees_safe
WITH (security_invoker = true)
AS
SELECT
  id, tenant_id, user_id, employee_number,
  first_name, last_name, first_name_en, last_name_en,
  email, phone,
  CASE WHEN is_hr_manager(auth.uid(), tenant_id) THEN national_id ELSE NULL END AS national_id,
  date_of_birth, gender, nationality,
  department_id, position_id, manager_id, branch_id,
  hire_date, status, avatar_url, address,
  CASE WHEN is_hr_manager(auth.uid(), tenant_id) THEN bank_details ELSE NULL END AS bank_details,
  emergency_contact, notes, created_at, updated_at
FROM public.hr_employees;
