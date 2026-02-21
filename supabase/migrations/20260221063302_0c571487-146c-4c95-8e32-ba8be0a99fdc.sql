
-- Usage analytics events table
CREATE TABLE public.app_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  user_id uuid NOT NULL,
  event_type text NOT NULL DEFAULT 'page_view' CHECK (event_type IN ('page_view', 'action')),
  route text NOT NULL,
  category text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for analytics queries
CREATE INDEX idx_usage_events_tenant_created ON public.app_usage_events(tenant_id, created_at DESC);
CREATE INDEX idx_usage_events_route ON public.app_usage_events(route, created_at DESC);

-- RLS: tenant-scoped read for platform admins only, no direct insert from anon/authenticated
ALTER TABLE public.app_usage_events ENABLE ROW LEVEL SECURITY;

-- Platform admins can read all
CREATE POLICY "Platform admins can read all usage events"
  ON public.app_usage_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

-- No insert/update/delete for regular users (service_role bypasses RLS)

-- RPC to insert usage event (SECURITY DEFINER so it runs as owner, bypassing RLS)
CREATE OR REPLACE FUNCTION public.track_usage_event(
  p_tenant_id uuid,
  p_user_id uuid,
  p_event_type text DEFAULT 'page_view',
  p_route text DEFAULT '',
  p_category text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_usage_events (tenant_id, user_id, event_type, route, category, metadata)
  VALUES (p_tenant_id, p_user_id, p_event_type, p_route, p_category, p_metadata);
END;
$$;

-- RPC for usage summary (platform admins only)
CREATE OR REPLACE FUNCTION public.get_usage_summary(p_days int DEFAULT 7)
RETURNS TABLE(
  route text,
  category text,
  view_count bigint,
  unique_users bigint,
  unique_tenants bigint,
  last_used timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    e.route,
    e.category,
    COUNT(*) AS view_count,
    COUNT(DISTINCT e.user_id) AS unique_users,
    COUNT(DISTINCT e.tenant_id) AS unique_tenants,
    MAX(e.created_at) AS last_used
  FROM public.app_usage_events e
  WHERE e.created_at >= now() - (p_days || ' days')::interval
    AND EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  GROUP BY e.route, e.category
  ORDER BY view_count DESC;
$$;
