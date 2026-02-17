-- Add 'accounting' category to paid_integrations
ALTER TABLE public.paid_integrations DROP CONSTRAINT paid_integrations_category_check;
ALTER TABLE public.paid_integrations ADD CONSTRAINT paid_integrations_category_check 
  CHECK (category = ANY (ARRAY['pos', 'ecommerce', 'hr_payroll', 'payment_gateway', 'accounting', 'other']));