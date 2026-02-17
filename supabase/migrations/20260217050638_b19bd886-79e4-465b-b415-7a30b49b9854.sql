-- Update status check constraint for one-time payment model (active | disabled only)
ALTER TABLE public.tenant_paid_integrations DROP CONSTRAINT tenant_paid_integrations_status_check;
ALTER TABLE public.tenant_paid_integrations ADD CONSTRAINT tenant_paid_integrations_status_check CHECK (status IN ('active', 'disabled'));