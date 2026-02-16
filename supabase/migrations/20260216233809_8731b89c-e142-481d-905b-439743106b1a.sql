
-- Payment reminder schedule templates per tenant
CREATE TABLE public.payment_reminder_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL DEFAULT 'تذكير افتراضي',
  name_en text DEFAULT 'Default Reminder',
  -- Days relative to due_date: negative = before, positive = after
  days_offset integer NOT NULL DEFAULT -3,
  channel text NOT NULL DEFAULT 'email',
  subject_template text NOT NULL DEFAULT 'تذكير بسداد الفاتورة {{invoice_number}}',
  body_template text NOT NULL DEFAULT 'عزيزي {{customer_name}}، نود تذكيركم بالفاتورة رقم {{invoice_number}} بمبلغ {{amount_due}} {{currency}} والمستحقة بتاريخ {{due_date}}.',
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Log of all sent reminders (immutable audit trail)
CREATE TABLE public.payment_reminder_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  schedule_id uuid REFERENCES public.payment_reminder_schedules(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  channel text NOT NULL DEFAULT 'email',
  recipient text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_reminder_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reminder_logs ENABLE ROW LEVEL SECURITY;

-- RLS for schedules
CREATE POLICY "Members can view reminder schedules"
  ON public.payment_reminder_schedules FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create reminder schedules"
  ON public.payment_reminder_schedules FOR INSERT
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can update reminder schedules"
  ON public.payment_reminder_schedules FOR UPDATE
  USING (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can delete reminder schedules"
  ON public.payment_reminder_schedules FOR DELETE
  USING (is_tenant_admin(tenant_id));

-- RLS for logs (immutable)
CREATE POLICY "Members can view reminder logs"
  ON public.payment_reminder_logs FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can insert reminder logs"
  ON public.payment_reminder_logs FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Deny updates on reminder logs"
  ON public.payment_reminder_logs FOR UPDATE
  USING (false);

CREATE POLICY "Deny deletes on reminder logs"
  ON public.payment_reminder_logs FOR DELETE
  USING (false);

-- Trigger for updated_at
CREATE TRIGGER update_payment_reminder_schedules_updated_at
  BEFORE UPDATE ON public.payment_reminder_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
