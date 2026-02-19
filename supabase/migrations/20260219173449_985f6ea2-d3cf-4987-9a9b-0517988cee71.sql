
-- Add segment and credit_limit to customers
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT NULL;

-- Create customer_tasks table
CREATE TABLE IF NOT EXISTS public.customer_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.customer_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_tasks_select" ON public.customer_tasks
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "customer_tasks_insert" ON public.customer_tasks
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "customer_tasks_update" ON public.customer_tasks
  FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "customer_tasks_delete" ON public.customer_tasks
  FOR DELETE USING (tenant_id = get_user_tenant_id());
