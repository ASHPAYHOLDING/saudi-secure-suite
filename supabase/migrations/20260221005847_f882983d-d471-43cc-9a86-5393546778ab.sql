
-- workflow_versions table for versioned workflow definitions
CREATE TABLE public.workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  definition_json JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  published_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(workflow_id, version)
);

ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wv_select" ON public.workflow_versions
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "wv_insert" ON public.workflow_versions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "wv_update" ON public.workflow_versions
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "wv_delete" ON public.workflow_versions
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "auth_gate_wv" ON public.workflow_versions
  AS RESTRICTIVE FOR ALL TO anon USING (false);

-- Add definition_json to approval_workflows for draft storage
ALTER TABLE public.approval_workflows
  ADD COLUMN IF NOT EXISTS definition_json JSONB DEFAULT '{"nodes":[],"edges":[]}';

-- Index for fast lookup of published version
CREATE INDEX idx_wv_published ON public.workflow_versions(workflow_id) WHERE is_published = true;
