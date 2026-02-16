
-- Create enum for tenant types
CREATE TYPE public.tenant_type AS ENUM ('company', 'individual', 'freelancer');

-- Add tenant_type column with default 'company'
ALTER TABLE public.tenants
ADD COLUMN tenant_type public.tenant_type NOT NULL DEFAULT 'company';
