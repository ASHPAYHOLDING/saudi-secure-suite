
-- Add branding columns to tenants table
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS brand_primary_color text DEFAULT '#0f4c81',
  ADD COLUMN IF NOT EXISTS brand_secondary_color text DEFAULT '#1a9b8a',
  ADD COLUMN IF NOT EXISTS brand_font text DEFAULT 'IBM Plex Sans Arabic';
