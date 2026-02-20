
-- جدول سجلات اختبار الاتصال
CREATE TABLE IF NOT EXISTS public.connection_test_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  category TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.connection_test_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their connection test logs"
  ON public.connection_test_logs FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can insert connection test logs"
  ON public.connection_test_logs FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
  ));

-- جدول تذاكر دعم التكاملات
CREATE TABLE IF NOT EXISTS public.integration_support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  category TEXT NOT NULL,
  provider TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  message TEXT NOT NULL,
  diagnostics JSONB,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their support tickets"
  ON public.integration_support_tickets FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can create support tickets"
  ON public.integration_support_tickets FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
  ));
