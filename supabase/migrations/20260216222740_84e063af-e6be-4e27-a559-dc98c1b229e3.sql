
-- Invoice delivery log
CREATE TABLE public.invoice_delivery_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email', -- 'email', 'whatsapp'
  recipient TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'opened'
  message_body TEXT,
  sent_by UUID NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view delivery logs"
ON public.invoice_delivery_log FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Finance can create delivery logs"
ON public.invoice_delivery_log FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND sent_by = auth.uid() AND is_authorized_finance(tenant_id));

CREATE POLICY "Deny updates on delivery logs"
ON public.invoice_delivery_log FOR UPDATE
USING (false);

CREATE POLICY "Deny deletes on delivery logs"
ON public.invoice_delivery_log FOR DELETE
USING (false);

CREATE INDEX idx_delivery_log_invoice ON public.invoice_delivery_log(invoice_id);
CREATE INDEX idx_delivery_log_tenant ON public.invoice_delivery_log(tenant_id);

-- Invoice message templates
CREATE TABLE public.invoice_message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  channel TEXT NOT NULL DEFAULT 'email', -- 'email', 'whatsapp'
  name TEXT NOT NULL DEFAULT '',
  subject TEXT, -- email subject
  body_template TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view message templates"
ON public.invoice_message_templates FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create message templates"
ON public.invoice_message_templates FOR INSERT
WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can update message templates"
ON public.invoice_message_templates FOR UPDATE
USING (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can delete message templates"
ON public.invoice_message_templates FOR DELETE
USING (is_tenant_admin(tenant_id));
