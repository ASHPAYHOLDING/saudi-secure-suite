
-- Add permission definition for payroll
INSERT INTO permission_definitions (key, name_ar, name_en, category, description)
VALUES ('hr.manage_payroll', 'إدارة الرواتب', 'Manage Payroll', 'hr', 'إدارة مسيّرات الرواتب والاستقطاعات')
ON CONFLICT (key) DO NOTHING;
