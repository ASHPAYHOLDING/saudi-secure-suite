
-- Add tags to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Customer activity timeline
CREATE TABLE public.customer_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  activity_type text NOT NULL, -- 'note', 'call', 'email', 'meeting', 'task', 'status_change'
  title text NOT NULL DEFAULT '',
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_activities ENABLE ROW LEVEL SECURITY;

-- Members can view activities in their tenant
CREATE POLICY "Members can view customer activities"
  ON public.customer_activities FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Members can create activities
CREATE POLICY "Members can create customer activities"
  ON public.customer_activities FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Admins can delete activities
CREATE POLICY "Admins can delete customer activities"
  ON public.customer_activities FOR DELETE
  USING (is_tenant_admin(tenant_id));

-- No updates on activities (immutable timeline)
CREATE POLICY "Deny updates on customer activities"
  ON public.customer_activities FOR UPDATE
  USING (false);

-- Index for fast lookups
CREATE INDEX idx_customer_activities_customer ON public.customer_activities(customer_id, created_at DESC);
CREATE INDEX idx_customers_tags ON public.customers USING GIN(tags);
