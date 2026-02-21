
-- Document template types
CREATE TYPE public.document_template_type AS ENUM (
  'invoice', 'credit_note', 'quotation', 'purchase_order',
  'delivery_note', 'sales_order', 'journal_entry', 'contract', 'receipt'
);

-- Document templates table
CREATE TABLE public.document_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type public.document_template_type NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  html_template TEXT NOT NULL DEFAULT '',
  css TEXT NOT NULL DEFAULT '',
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one default template per type per tenant
CREATE UNIQUE INDEX idx_document_templates_default
  ON public.document_templates (tenant_id, document_type)
  WHERE is_default = true;

CREATE INDEX idx_document_templates_tenant ON public.document_templates(tenant_id);
CREATE INDEX idx_document_templates_type ON public.document_templates(tenant_id, document_type);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view templates"
  ON public.document_templates FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Template managers can insert"
  ON public.document_templates FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Template managers can update"
  ON public.document_templates FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Template managers can delete"
  ON public.document_templates FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Document render logs table
CREATE TABLE public.document_render_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
  document_type public.document_template_type NOT NULL,
  document_id UUID,
  document_number TEXT,
  rendered_by UUID NOT NULL,
  rendered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  render_format TEXT NOT NULL DEFAULT 'pdf',
  render_duration_ms INTEGER,
  file_size_bytes BIGINT,
  error_message TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_render_logs_tenant ON public.document_render_logs(tenant_id);
CREATE INDEX idx_render_logs_template ON public.document_render_logs(template_id);
CREATE INDEX idx_render_logs_document ON public.document_render_logs(tenant_id, document_type, document_id);

ALTER TABLE public.document_render_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view render logs"
  ON public.document_render_logs FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "System can insert render logs"
  ON public.document_render_logs FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Update trigger for document_templates
CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
