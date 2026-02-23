
-- 1) Add block_reason to email_jobs
ALTER TABLE public.email_jobs ADD COLUMN IF NOT EXISTS block_reason text;

-- 2) Create tenant_email_template_overrides for tenant-level template customization
CREATE TABLE IF NOT EXISTS public.tenant_email_template_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  template_definition_id uuid NOT NULL,
  locale text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text,
  version int NOT NULL DEFAULT 1,
  created_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, template_definition_id, locale, version)
);

-- Enable RLS
ALTER TABLE public.tenant_email_template_overrides ENABLE ROW LEVEL SECURITY;

-- RLS: Only tenant owners can manage their overrides
CREATE POLICY "Tenant owners read own overrides"
  ON public.tenant_email_template_overrides
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = tenant_email_template_overrides.tenant_id
        AND tm.role = 'owner'
    )
  );

CREATE POLICY "Tenant owners insert own overrides"
  ON public.tenant_email_template_overrides
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = tenant_email_template_overrides.tenant_id
        AND tm.role = 'owner'
    )
  );

CREATE POLICY "Tenant owners update own overrides"
  ON public.tenant_email_template_overrides
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = tenant_email_template_overrides.tenant_id
        AND tm.role = 'owner'
    )
  );

CREATE POLICY "Tenant owners delete own overrides"
  ON public.tenant_email_template_overrides
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = tenant_email_template_overrides.tenant_id
        AND tm.role = 'owner'
    )
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_tenant_template_overrides_tenant
  ON public.tenant_email_template_overrides(tenant_id, template_definition_id, locale);

-- Trigger for updated_at
CREATE TRIGGER update_tenant_email_template_overrides_updated_at
  BEFORE UPDATE ON public.tenant_email_template_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
