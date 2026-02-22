
-- 1) Create hr_employee_contract_files table
CREATE TABLE public.hr_employee_contract_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  size BIGINT NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_contract_files_employee ON public.hr_employee_contract_files(employee_id);
CREATE INDEX idx_hr_contract_files_tenant ON public.hr_employee_contract_files(tenant_id);

ALTER TABLE public.hr_employee_contract_files ENABLE ROW LEVEL SECURITY;

-- RLS: read for anyone with hr.view in tenant
CREATE POLICY "hr_contract_files_select"
  ON public.hr_employee_contract_files FOR SELECT
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.view'));

-- RLS: insert for hr.manage_contracts
CREATE POLICY "hr_contract_files_insert"
  ON public.hr_employee_contract_files FOR INSERT
  WITH CHECK (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_contracts'));

-- RLS: update for hr.manage_contracts
CREATE POLICY "hr_contract_files_update"
  ON public.hr_employee_contract_files FOR UPDATE
  USING (has_hr_permission(auth.uid(), tenant_id, 'hr.manage_contracts'));

-- RLS: delete for hr managers only
CREATE POLICY "hr_contract_files_delete"
  ON public.hr_employee_contract_files FOR DELETE
  USING (is_hr_manager(auth.uid(), tenant_id));

-- 2) Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('hr-contracts', 'hr-contracts', false)
ON CONFLICT (id) DO NOTHING;

-- 3) Storage RLS policies
CREATE POLICY "hr_contracts_bucket_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'hr-contracts'
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "hr_contracts_bucket_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'hr-contracts'
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "hr_contracts_bucket_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'hr-contracts'
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );
