-- Add paylink_enabled column to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS paylink_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS paylink_enabled_at timestamp with time zone;
