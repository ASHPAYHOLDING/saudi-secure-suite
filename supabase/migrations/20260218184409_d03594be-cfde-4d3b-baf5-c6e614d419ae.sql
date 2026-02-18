
-- Report versions table for versioning each generated report
CREATE TABLE public.report_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  report_key TEXT NOT NULL,
  report_name_ar TEXT NOT NULL,
  version_number INT NOT NULL DEFAULT 1,
  generated_by UUID NOT NULL,
  generated_by_name TEXT NOT NULL DEFAULT '',
  filters JSONB NOT NULL DEFAULT '{}',
  date_range TEXT NOT NULL DEFAULT '',
  row_count INT NOT NULL DEFAULT 0,
  has_critical_issues BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own tenant report versions"
  ON public.report_versions FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own tenant report versions"
  ON public.report_versions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_report_versions_tenant_key ON public.report_versions(tenant_id, report_key);

-- Auto-increment version number per tenant+report_key
CREATE OR REPLACE FUNCTION public.set_report_version_number()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO NEW.version_number
  FROM public.report_versions
  WHERE tenant_id = NEW.tenant_id AND report_key = NEW.report_key;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_report_version_number
  BEFORE INSERT ON public.report_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_report_version_number();
