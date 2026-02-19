-- Add email_preferences to tenant_settings
ALTER TABLE public.tenant_settings
ADD COLUMN IF NOT EXISTS email_preferences jsonb DEFAULT '{
  "send_invoice_email": true,
  "send_payment_receipt": true,
  "send_security_alert": true,
  "from_name": "",
  "reply_to_email": ""
}'::jsonb;