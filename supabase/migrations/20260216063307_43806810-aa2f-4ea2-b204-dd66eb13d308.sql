
-- Fix: restrict direct INSERT to platform admins only (triggers use SECURITY DEFINER so bypass RLS)
DROP POLICY "System can insert notifications" ON public.platform_notifications;
