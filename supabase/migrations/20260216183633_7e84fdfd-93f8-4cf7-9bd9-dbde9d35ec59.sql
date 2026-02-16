
-- Create tenant_notifications table
CREATE TABLE public.tenant_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'info',
  entity_type text,
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_notifications_tenant ON public.tenant_notifications(tenant_id);
CREATE INDEX idx_tenant_notifications_unread ON public.tenant_notifications(tenant_id, is_read) WHERE NOT is_read;

ALTER TABLE public.tenant_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own tenant notifications"
  ON public.tenant_notifications FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Members can update own tenant notifications"
  ON public.tenant_notifications FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can insert notifications"
  ON public.tenant_notifications FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Deny deletes on notifications"
  ON public.tenant_notifications FOR DELETE
  USING (false);

-- Create notification_preferences table
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  days_before integer NOT NULL DEFAULT 3,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, notification_type)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage notification preferences"
  ON public.notification_preferences FOR ALL
  USING (is_tenant_admin(tenant_id));

-- Enable realtime for tenant_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_notifications;
