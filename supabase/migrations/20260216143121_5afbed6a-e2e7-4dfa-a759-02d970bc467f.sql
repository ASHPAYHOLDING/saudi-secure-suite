
-- Global platform templates managed by super admins
CREATE TABLE public.platform_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'invoice', -- invoice, contract, email, notification
  name_ar text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  description text DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  placeholders jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  allow_tenant_customization boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active', -- active, draft, archived
  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_templates ENABLE ROW LEVEL SECURITY;

-- Platform admins full access
CREATE POLICY "Platform admins can view all templates"
  ON public.platform_templates FOR SELECT
  USING (is_platform_admin());

CREATE POLICY "Platform admins can create templates"
  ON public.platform_templates FOR INSERT
  WITH CHECK (is_platform_admin());

CREATE POLICY "Platform admins can update templates"
  ON public.platform_templates FOR UPDATE
  USING (is_platform_admin());

CREATE POLICY "Platform admins can delete templates"
  ON public.platform_templates FOR DELETE
  USING (is_platform_admin());

-- Authenticated users can view active non-locked or customizable templates
CREATE POLICY "Authenticated can view active templates"
  ON public.platform_templates FOR SELECT
  USING (status = 'active');

-- Indexes
CREATE INDEX idx_platform_templates_category ON public.platform_templates(category);
CREATE INDEX idx_platform_templates_status ON public.platform_templates(status);

-- Updated_at trigger
CREATE TRIGGER update_platform_templates_updated_at
  BEFORE UPDATE ON public.platform_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
