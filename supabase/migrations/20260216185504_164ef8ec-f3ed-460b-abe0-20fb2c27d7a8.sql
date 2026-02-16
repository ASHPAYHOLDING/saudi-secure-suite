
-- Invoice Templates table
CREATE TABLE public.invoice_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'قالب جديد',
  layout_style text NOT NULL DEFAULT 'classic',
  -- Colors
  primary_color text NOT NULL DEFAULT '#1a1f36',
  secondary_color text NOT NULL DEFAULT '#1a9b8a',
  header_text_color text NOT NULL DEFAULT '#ffffff',
  -- Font
  font_family text NOT NULL DEFAULT 'IBM Plex Sans Arabic',
  -- Column customization (JSON array of column configs)
  columns_config jsonb NOT NULL DEFAULT '[
    {"key": "index", "label": "#", "visible": true, "order": 0},
    {"key": "description", "label": "الوصف", "visible": true, "order": 1},
    {"key": "quantity", "label": "الكمية", "visible": true, "order": 2},
    {"key": "unit", "label": "الوحدة", "visible": true, "order": 3},
    {"key": "unit_price", "label": "سعر الوحدة", "visible": true, "order": 4},
    {"key": "discount", "label": "الخصم", "visible": true, "order": 5},
    {"key": "vat_rate", "label": "الضريبة", "visible": true, "order": 6},
    {"key": "line_total", "label": "الإجمالي", "visible": true, "order": 7}
  ]'::jsonb,
  -- Additional settings
  show_logo boolean NOT NULL DEFAULT true,
  show_stamp boolean NOT NULL DEFAULT true,
  show_qr_code boolean NOT NULL DEFAULT true,
  show_notes boolean NOT NULL DEFAULT true,
  footer_text text DEFAULT NULL,
  -- Metadata
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can view templates"
  ON public.invoice_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create templates"
  ON public.invoice_templates FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_tenant_admin(tenant_id));

CREATE POLICY "Admins can update templates"
  ON public.invoice_templates FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND is_tenant_admin(tenant_id));

CREATE POLICY "Admins can delete templates"
  ON public.invoice_templates FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND is_tenant_admin(tenant_id));

-- Index
CREATE INDEX idx_invoice_templates_tenant ON public.invoice_templates(tenant_id);

-- Trigger for updated_at
CREATE TRIGGER update_invoice_templates_updated_at
  BEFORE UPDATE ON public.invoice_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one default per tenant
CREATE UNIQUE INDEX idx_invoice_templates_default
  ON public.invoice_templates(tenant_id) WHERE is_default = true;
