
-- =============================================
-- APPROVAL WORKFLOW SYSTEM
-- =============================================

-- 1. Approval Workflows: defines rules (e.g., "invoices > 10000 SAR need 2-level approval")
CREATE TABLE public.approval_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  document_type TEXT NOT NULL, -- 'invoice', 'expense', 'purchase_order', 'contract'
  condition_type TEXT NOT NULL DEFAULT 'amount', -- 'amount', 'always'
  min_amount NUMERIC DEFAULT 0,
  max_amount NUMERIC, -- NULL means unlimited
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0, -- higher = checked first
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Approval Workflow Steps: defines each level in the workflow
CREATE TABLE public.approval_workflow_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 1,
  approver_type TEXT NOT NULL DEFAULT 'role', -- 'role', 'user', 'department_manager'
  approver_role TEXT, -- app_role value when approver_type = 'role'
  approver_user_id UUID, -- specific user when approver_type = 'user'
  step_name TEXT NOT NULL DEFAULT '',
  step_name_en TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Approval Requests: tracks actual approval instances
CREATE TABLE public.approval_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.approval_workflows(id),
  document_type TEXT NOT NULL,
  document_id UUID NOT NULL,
  document_number TEXT,
  document_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  current_step INTEGER NOT NULL DEFAULT 1,
  total_steps INTEGER NOT NULL DEFAULT 1,
  requested_by UUID NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Approval Actions: each approver's decision
CREATE TABLE public.approval_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.approval_workflow_steps(id),
  step_order INTEGER NOT NULL,
  action TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  acted_by UUID,
  comment TEXT,
  acted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: approval_workflows
-- =============================================
CREATE POLICY "Members can view workflows"
  ON public.approval_workflows FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create workflows"
  ON public.approval_workflows FOR INSERT
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can update workflows"
  ON public.approval_workflows FOR UPDATE
  USING (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can delete workflows"
  ON public.approval_workflows FOR DELETE
  USING (is_tenant_admin(tenant_id));

-- =============================================
-- RLS POLICIES: approval_workflow_steps
-- =============================================
CREATE POLICY "Members can view workflow steps"
  ON public.approval_workflow_steps FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create workflow steps"
  ON public.approval_workflow_steps FOR INSERT
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can update workflow steps"
  ON public.approval_workflow_steps FOR UPDATE
  USING (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can delete workflow steps"
  ON public.approval_workflow_steps FOR DELETE
  USING (is_tenant_admin(tenant_id));

-- =============================================
-- RLS POLICIES: approval_requests
-- =============================================
CREATE POLICY "Members can view approval requests"
  ON public.approval_requests FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Members can create approval requests"
  ON public.approval_requests FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND requested_by = auth.uid());

CREATE POLICY "System can update approval requests"
  ON public.approval_requests FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Deny deletes on approval requests"
  ON public.approval_requests FOR DELETE
  USING (false);

-- =============================================
-- RLS POLICIES: approval_actions
-- =============================================
CREATE POLICY "Members can view approval actions"
  ON public.approval_actions FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Members can create approval actions"
  ON public.approval_actions FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Approvers can update their actions"
  ON public.approval_actions FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND acted_by = auth.uid());

CREATE POLICY "Deny deletes on approval actions"
  ON public.approval_actions FOR DELETE
  USING (false);

-- Enable realtime for approval requests (for live status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_actions;
