
-- Create region enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_region') THEN
    CREATE TYPE public.tenant_region AS ENUM ('ksa', 'gcc', 'eu');
  END IF;
END$$;

-- Add region column to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS region public.tenant_region NOT NULL DEFAULT 'ksa';

-- Index for region-based queries
CREATE INDEX IF NOT EXISTS idx_tenants_region ON public.tenants(region);

-- Create a view for region distribution stats (used by infrastructure dashboard)
CREATE OR REPLACE VIEW public.tenant_region_stats AS
SELECT 
  region::text,
  COUNT(*) AS tenant_count,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM subscriptions s WHERE s.tenant_id = t.id AND s.status = 'active'
  )) AS active_subscriptions
FROM tenants t
GROUP BY region;

-- Grant read access
GRANT SELECT ON public.tenant_region_stats TO authenticated, service_role;
