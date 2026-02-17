
-- Support tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'platform' CHECK (scope IN ('platform', 'tenant')),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_by UUID NOT NULL,
  assigned_to UUID,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('technical', 'suggestion', 'inquiry', 'payment_gateway', 'invoices', 'subscriptions', 'transfers', 'account', 'other')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  customer_name TEXT,
  customer_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

-- Ticket replies table
CREATE TABLE public.ticket_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID,
  sender_type TEXT NOT NULL DEFAULT 'user' CHECK (sender_type IN ('user', 'admin', 'system')),
  sender_name TEXT,
  sender_email TEXT,
  content TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  is_internal_note BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_support_tickets_tenant ON public.support_tickets(tenant_id);
CREATE INDEX idx_support_tickets_scope ON public.support_tickets(scope);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_number ON public.support_tickets(ticket_number);
CREATE INDEX idx_ticket_replies_ticket ON public.ticket_replies(ticket_id);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

-- RLS for support_tickets
-- Tenant members can view their own tenant tickets
CREATE POLICY "Tenant members can view own tickets"
ON public.support_tickets FOR SELECT
USING (
  public.is_tenant_member(tenant_id)
  OR public.is_platform_admin()
);

-- Tenant admins/owners can create tickets
CREATE POLICY "Tenant members can create tickets"
ON public.support_tickets FOR INSERT
WITH CHECK (
  public.is_tenant_member(tenant_id)
  OR public.is_platform_admin()
);

-- Tenant admins and platform admins can update tickets
CREATE POLICY "Authorized users can update tickets"
ON public.support_tickets FOR UPDATE
USING (
  public.is_tenant_admin(tenant_id)
  OR public.is_platform_admin()
);

-- RLS for ticket_replies
CREATE POLICY "Users can view replies of accessible tickets"
ON public.ticket_replies FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id = ticket_id
    AND (public.is_tenant_member(st.tenant_id) OR public.is_platform_admin())
  )
);

CREATE POLICY "Users can create replies on accessible tickets"
ON public.ticket_replies FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id = ticket_id
    AND (public.is_tenant_member(st.tenant_id) OR public.is_platform_admin())
  )
);

-- Updated_at trigger
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START 1000;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_replies;
