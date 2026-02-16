
-- OCR usage logs for billing tracking
CREATE TABLE public.ocr_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  processing_time_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'processing',
  model_used TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  extracted_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ocr_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own OCR logs"
ON public.ocr_usage_logs FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Members can create OCR logs"
ON public.ocr_usage_logs FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND user_id = auth.uid());

CREATE POLICY "Deny updates on OCR logs"
ON public.ocr_usage_logs FOR UPDATE
USING (false);

CREATE POLICY "Deny deletes on OCR logs"
ON public.ocr_usage_logs FOR DELETE
USING (false);

CREATE POLICY "Platform admins can view all OCR logs"
ON public.ocr_usage_logs FOR SELECT
USING (is_platform_admin());

-- Create index for tenant lookups
CREATE INDEX idx_ocr_usage_logs_tenant ON public.ocr_usage_logs(tenant_id);

-- Storage bucket for OCR uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('ocr-uploads', 'ocr-uploads', false);

-- Storage policies for OCR uploads
CREATE POLICY "Tenant members can upload OCR files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ocr-uploads' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant members can view own OCR files"
ON storage.objects FOR SELECT
USING (bucket_id = 'ocr-uploads' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant members can delete own OCR files"
ON storage.objects FOR DELETE
USING (bucket_id = 'ocr-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
