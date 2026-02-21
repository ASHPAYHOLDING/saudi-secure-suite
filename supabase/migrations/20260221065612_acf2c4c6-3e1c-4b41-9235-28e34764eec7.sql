
-- Index for efficient route usage queries
CREATE INDEX IF NOT EXISTS idx_app_usage_events_route_created 
ON public.app_usage_events (route, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_usage_events_tenant_created
ON public.app_usage_events (tenant_id, created_at DESC);

-- Auto-cleanup function: delete events older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_usage_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.app_usage_events
  WHERE created_at < now() - interval '30 days';
END;
$$;

-- Deprecated/soft-deleted routes tracking table
CREATE TABLE IF NOT EXISTS public.deprecated_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route TEXT NOT NULL UNIQUE,
  redirect_to TEXT NOT NULL,
  reason TEXT,
  deprecated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hard_delete_after TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT
);

ALTER TABLE public.deprecated_routes ENABLE ROW LEVEL SECURITY;

-- Only platform admins can manage deprecated routes
CREATE POLICY "Platform admins can manage deprecated routes"
ON public.deprecated_routes
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- Read-only for authenticated users (needed for redirect logic)
CREATE POLICY "Authenticated users can read deprecated routes"
ON public.deprecated_routes
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RPC to get route usage stats for last 30 days
CREATE OR REPLACE FUNCTION public.get_route_usage_stats()
RETURNS TABLE(
  route TEXT,
  visit_count BIGINT,
  unique_users BIGINT,
  last_visited TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT 
    route,
    count(*) as visit_count,
    count(DISTINCT user_id) as unique_users,
    max(created_at) as last_visited
  FROM public.app_usage_events
  WHERE created_at >= now() - interval '30 days'
  GROUP BY route
  ORDER BY visit_count DESC;
$$;
