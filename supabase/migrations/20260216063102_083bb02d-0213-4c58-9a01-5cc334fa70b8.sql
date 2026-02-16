
-- Platform notifications table
CREATE TABLE public.platform_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- 'new_tenant', 'subscription_expired', 'subscription_cancelled'
  title text NOT NULL,
  message text NOT NULL,
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;

-- Only platform admins can access notifications
CREATE POLICY "Platform admins can view notifications" ON public.platform_notifications
  FOR SELECT USING (is_platform_admin());

CREATE POLICY "Platform admins can update notifications" ON public.platform_notifications
  FOR UPDATE USING (is_platform_admin());

-- System can insert notifications
CREATE POLICY "System can insert notifications" ON public.platform_notifications
  FOR INSERT WITH CHECK (true);

-- Trigger: notify on new tenant
CREATE OR REPLACE FUNCTION public.notify_new_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.platform_notifications (type, title, message, entity_id)
  VALUES (
    'new_tenant',
    'شركة جديدة',
    'تم تسجيل شركة جديدة: ' || NEW.name,
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_tenant
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_tenant();

-- Trigger: notify on subscription status change
CREATE OR REPLACE FUNCTION public.notify_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_name text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT name INTO _tenant_name FROM public.tenants WHERE id = NEW.tenant_id;
    
    IF NEW.status = 'expired' THEN
      INSERT INTO public.platform_notifications (type, title, message, entity_id)
      VALUES ('subscription_expired', 'اشتراك منتهي', 'انتهى اشتراك: ' || COALESCE(_tenant_name, 'غير معروف'), NEW.tenant_id);
    ELSIF NEW.status = 'cancelled' THEN
      INSERT INTO public.platform_notifications (type, title, message, entity_id)
      VALUES ('subscription_cancelled', 'اشتراك ملغي', 'تم إلغاء اشتراك: ' || COALESCE(_tenant_name, 'غير معروف'), NEW.tenant_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_subscription_change
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_subscription_change();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_notifications;
