
-- Update the check constraint to use 'payment' instead of 'payment_gateway'
ALTER TABLE public.paid_integrations DROP CONSTRAINT paid_integrations_category_check;

ALTER TABLE public.paid_integrations ADD CONSTRAINT paid_integrations_category_check 
CHECK (integration_type = ANY (ARRAY['pos','ecommerce','hr_payroll','payment','payment_gateway','accounting','sms','whatsapp','other']));

-- Rename existing rows
UPDATE public.paid_integrations SET integration_type = 'payment' WHERE integration_type = 'payment_gateway';
