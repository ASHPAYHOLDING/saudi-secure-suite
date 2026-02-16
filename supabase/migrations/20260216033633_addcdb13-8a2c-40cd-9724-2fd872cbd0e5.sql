
-- Add stamp configuration columns to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS stamp_image_url text,
  ADD COLUMN IF NOT EXISTS stamp_company_name text,
  ADD COLUMN IF NOT EXISTS stamp_cr_number text,
  ADD COLUMN IF NOT EXISTS stamp_vat_number text,
  ADD COLUMN IF NOT EXISTS stamp_enabled boolean NOT NULL DEFAULT false;

-- Create storage bucket for stamp images
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-stamps', 'tenant-stamps', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Anyone can view stamp images (needed for invoice rendering)
CREATE POLICY "Public can view stamp images"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-stamps');

-- RLS: Only tenant admins can upload stamps (folder = tenant_id)
CREATE POLICY "Admins can upload stamps"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-stamps'
  AND auth.role() = 'authenticated'
);

-- RLS: Admins can update their stamps
CREATE POLICY "Admins can update stamps"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-stamps'
  AND auth.role() = 'authenticated'
);

-- RLS: Admins can delete their stamps
CREATE POLICY "Admins can delete stamps"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-stamps'
  AND auth.role() = 'authenticated'
);
