
-- Create subscription change logs table
CREATE TABLE public.subscription_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  action text NOT NULL, -- 'upgrade', 'downgrade', 'cancel', 'renew', 'extend', 'status_change'
  old_plan_id uuid REFERENCES public.subscription_plans(id),
  new_plan_id uuid REFERENCES public.subscription_plans(id),
  old_status text,
  new_status text,
  old_billing_cycle text,
  new_billing_cycle text,
  notes text,
  performed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view all subscription logs"
  ON public.subscription_logs FOR SELECT
  USING (is_platform_admin());

CREATE POLICY "Platform admins can insert subscription logs"
  ON public.subscription_logs FOR INSERT
  WITH CHECK (is_platform_admin());

CREATE INDEX idx_subscription_logs_sub_id ON public.subscription_logs(subscription_id);
CREATE INDEX idx_subscription_logs_tenant_id ON public.subscription_logs(tenant_id);
