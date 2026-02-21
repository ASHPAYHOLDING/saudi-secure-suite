
-- ══════════════════════════════════════════════════════════════
-- Workflow Engine Tables
-- ══════════════════════════════════════════════════════════════

-- 1) نوع حالة الخطوة
CREATE TYPE public.wf_step_type AS ENUM ('approval', 'condition', 'auto');
CREATE TYPE public.wf_instance_status AS ENUM ('pending', 'in_progress', 'approved', 'rejected', 'cancelled');
CREATE TYPE public.wf_step_status AS ENUM ('pending', 'approved', 'rejected', 'skipped', 'auto_passed');

-- 2) workflows — تعريف سير العمل
CREATE TABLE public.workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  entity_type TEXT NOT NULL, -- invoice, expense, po, contract, credit_note, etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflows_tenant ON public.workflows(tenant_id);
CREATE INDEX idx_workflows_entity ON public.workflows(tenant_id, entity_type);

-- 3) workflow_steps — خطوات سير العمل
CREATE TABLE public.workflow_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  step_order INT NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  name_en TEXT,
  type public.wf_step_type NOT NULL DEFAULT 'approval',
  role_required TEXT,        -- دور RBAC المطلوب للموافقة
  permission_required TEXT,  -- صلاحية محددة مطلوبة
  auto_condition JSONB,      -- شرط تلقائي (للخطوات من نوع condition/auto)
  is_required BOOLEAN NOT NULL DEFAULT true,
  timeout_hours INT,         -- مهلة زمنية اختيارية
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, step_order)
);

CREATE INDEX idx_wf_steps_workflow ON public.workflow_steps(workflow_id);

-- 4) workflow_instances — مثيلات سير العمل المرتبطة بكيان محدد
CREATE TABLE public.workflow_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  status public.wf_instance_status NOT NULL DEFAULT 'pending',
  current_step_order INT NOT NULL DEFAULT 1,
  started_by UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wf_instances_tenant ON public.workflow_instances(tenant_id);
CREATE INDEX idx_wf_instances_entity ON public.workflow_instances(tenant_id, entity_type, entity_id);
CREATE INDEX idx_wf_instances_status ON public.workflow_instances(tenant_id, status);

-- 5) workflow_instance_steps — حالة كل خطوة في المثيل
CREATE TABLE public.workflow_instance_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  status public.wf_step_status NOT NULL DEFAULT 'pending',
  acted_by UUID,
  acted_at TIMESTAMPTZ,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wf_inst_steps_instance ON public.workflow_instance_steps(instance_id);
CREATE INDEX idx_wf_inst_steps_status ON public.workflow_instance_steps(tenant_id, status);

-- ══════════════════════════════════════════════════════════════
-- RLS Policies
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instance_steps ENABLE ROW LEVEL SECURITY;

-- workflows
CREATE POLICY "tenant_workflows_select" ON public.workflows FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "tenant_workflows_insert" ON public.workflows FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "tenant_workflows_update" ON public.workflows FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "tenant_workflows_delete" ON public.workflows FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- workflow_steps
CREATE POLICY "tenant_wf_steps_select" ON public.workflow_steps FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "tenant_wf_steps_insert" ON public.workflow_steps FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "tenant_wf_steps_update" ON public.workflow_steps FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "tenant_wf_steps_delete" ON public.workflow_steps FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- workflow_instances
CREATE POLICY "tenant_wf_instances_select" ON public.workflow_instances FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "tenant_wf_instances_insert" ON public.workflow_instances FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "tenant_wf_instances_update" ON public.workflow_instances FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- workflow_instance_steps
CREATE POLICY "tenant_wf_inst_steps_select" ON public.workflow_instance_steps FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "tenant_wf_inst_steps_insert" ON public.workflow_instance_steps FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "tenant_wf_inst_steps_update" ON public.workflow_instance_steps FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- ══════════════════════════════════════════════════════════════
-- Trigger: تحديث updated_at
-- ══════════════════════════════════════════════════════════════
CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wf_instances_updated_at
  BEFORE UPDATE ON public.workflow_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
