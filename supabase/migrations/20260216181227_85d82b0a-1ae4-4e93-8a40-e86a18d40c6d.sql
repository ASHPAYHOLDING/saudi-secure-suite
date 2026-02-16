
-- Integrations configuration per tenant
CREATE TABLE public.tenant_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_type text NOT NULL, -- 'pos_foodics', 'ecommerce_shopify', 'ecommerce_woocommerce'
  display_name text NOT NULL DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}', -- store API keys, store URL, etc (encrypted at app level)
  sync_sales boolean NOT NULL DEFAULT true,
  sync_inventory boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_status text DEFAULT 'never', -- 'never', 'success', 'error', 'syncing'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, integration_type)
);

ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage integrations"
  ON public.tenant_integrations FOR ALL
  USING (is_tenant_admin(tenant_id))
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Members can view integrations"
  ON public.tenant_integrations FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Platform admins can view all integrations"
  ON public.tenant_integrations FOR SELECT
  USING (is_platform_admin());

-- Sync logs for audit and debugging
CREATE TABLE public.integration_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.tenant_integrations(id) ON DELETE CASCADE,
  sync_type text NOT NULL, -- 'sales', 'inventory', 'full'
  status text NOT NULL DEFAULT 'started', -- 'started', 'success', 'error', 'partial'
  records_synced integer NOT NULL DEFAULT 0,
  records_failed integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync logs"
  ON public.integration_sync_logs FOR SELECT
  USING (is_tenant_admin(tenant_id));

CREATE POLICY "System can insert sync logs"
  ON public.integration_sync_logs FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Platform admins can view all sync logs"
  ON public.integration_sync_logs FOR SELECT
  USING (is_platform_admin());

-- Deny updates/deletes on sync logs (immutable audit trail)
CREATE POLICY "Deny updates on sync logs"
  ON public.integration_sync_logs FOR UPDATE
  USING (false);

CREATE POLICY "Deny deletes on sync logs"
  ON public.integration_sync_logs FOR DELETE
  USING (false);

-- Triggers for updated_at
CREATE TRIGGER update_tenant_integrations_updated_at
  BEFORE UPDATE ON public.tenant_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_integrations;
