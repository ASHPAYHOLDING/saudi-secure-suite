
-- Secure document access tokens for PDF links
CREATE TABLE public.document_access_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  document_type TEXT NOT NULL, -- 'invoice', 'credit_note', 'receipt'
  document_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  max_access INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Index for fast token lookups
CREATE INDEX idx_doc_access_token ON public.document_access_tokens(token);
CREATE INDEX idx_doc_access_expires ON public.document_access_tokens(expires_at);
CREATE INDEX idx_doc_access_tenant ON public.document_access_tokens(tenant_id);

-- RLS
ALTER TABLE public.document_access_tokens ENABLE ROW LEVEL SECURITY;

-- Platform admins can see all
CREATE POLICY "Platform admins view all tokens"
  ON public.document_access_tokens FOR SELECT
  USING (public.is_platform_admin());

-- Tenant admins can view their own
CREATE POLICY "Tenant admins view own tokens"
  ON public.document_access_tokens FOR SELECT
  USING (public.is_tenant_admin(tenant_id));

-- Service role insert/update (via edge functions)
CREATE POLICY "Service role manages tokens"
  ON public.document_access_tokens FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to generate a secure access token
CREATE OR REPLACE FUNCTION public.create_document_access_token(
  _tenant_id UUID,
  _document_type TEXT,
  _document_id UUID,
  _hours INTEGER DEFAULT 48,
  _max_access INTEGER DEFAULT 5
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _token TEXT;
BEGIN
  _token := encode(gen_random_bytes(32), 'hex');
  
  INSERT INTO public.document_access_tokens (tenant_id, document_type, document_id, token, expires_at, max_access, created_by)
  VALUES (_tenant_id, _document_type, _document_id, _token, now() + (_hours || ' hours')::interval, _max_access, auth.uid());
  
  RETURN _token;
END;
$$;

-- Function to validate and consume a token
CREATE OR REPLACE FUNCTION public.validate_document_token(_token TEXT)
RETURNS TABLE(tenant_id UUID, document_type TEXT, document_id UUID, is_valid BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rec RECORD;
BEGIN
  SELECT * INTO _rec
  FROM public.document_access_tokens dat
  WHERE dat.token = _token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::UUID, false;
    RETURN;
  END IF;

  -- Check expiry
  IF _rec.expires_at < now() THEN
    RETURN QUERY SELECT _rec.tenant_id, _rec.document_type, _rec.document_id, false;
    RETURN;
  END IF;

  -- Check max access
  IF _rec.access_count >= _rec.max_access THEN
    RETURN QUERY SELECT _rec.tenant_id, _rec.document_type, _rec.document_id, false;
    RETURN;
  END IF;

  -- Increment access count
  UPDATE public.document_access_tokens
  SET access_count = access_count + 1, accessed_at = now()
  WHERE id = _rec.id;

  RETURN QUERY SELECT _rec.tenant_id, _rec.document_type, _rec.document_id, true;
END;
$$;

-- Auto-cleanup expired tokens (via scheduled cleanup)
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.document_access_tokens
  WHERE expires_at < now() - interval '7 days';
END;
$$;

-- Trigger: Auto-send financial email on invoice status change to 'issued'
CREATE OR REPLACE FUNCTION public.fire_invoice_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _customer RECORD;
  _tenant RECORD;
  _token TEXT;
BEGIN
  -- Only fire when status changes to 'issued' or 'sent'
  IF NEW.status IN ('issued', 'sent') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Get customer info
    SELECT * INTO _customer FROM public.customers WHERE id = NEW.customer_id;
    
    -- Get tenant info
    SELECT * INTO _tenant FROM public.tenants WHERE id = NEW.tenant_id;
    
    -- Only send if customer has email
    IF _customer.email IS NOT NULL AND _customer.email <> '' THEN
      -- Generate secure access token
      _token := encode(gen_random_bytes(32), 'hex');
      INSERT INTO public.document_access_tokens (tenant_id, document_type, document_id, token, expires_at, max_access, created_by)
      VALUES (NEW.tenant_id, 'invoice', NEW.id, _token, now() + interval '48 hours', 5, COALESCE(auth.uid(), NEW.created_by));
      
      -- Log the email request (edge function will pick it up)
      INSERT INTO public.email_logs (
        tenant_id, user_id, email_type, sender_address, recipient_email,
        subject, status, entity_type, entity_id, metadata
      ) VALUES (
        NEW.tenant_id, COALESCE(auth.uid(), NEW.created_by),
        'financial_invoice',
        'billing@numaxio.com',
        _customer.email,
        'فاتورة ضريبية ' || NEW.invoice_number,
        'queued',
        'invoice', NEW.id,
        jsonb_build_object(
          'invoice_number', NEW.invoice_number,
          'company_name', _tenant.name,
          'vat_number', COALESCE(_tenant.vat_number, ''),
          'cr_number', COALESCE(_tenant.cr_number, ''),
          'subtotal', NEW.subtotal,
          'vat_total', NEW.vat_total,
          'grand_total', NEW.grand_total,
          'currency', NEW.currency,
          'invoice_date', NEW.invoice_date,
          'due_date', NEW.due_date,
          'customer_name', _customer.name,
          'access_token', _token
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_financial_email
  AFTER UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.fire_invoice_email();

-- Trigger: Auto-send payment receipt email
CREATE OR REPLACE FUNCTION public.fire_payment_receipt_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoice RECORD;
  _customer RECORD;
  _tenant RECORD;
BEGIN
  -- Get invoice
  SELECT * INTO _invoice FROM public.invoices WHERE id = NEW.invoice_id;
  SELECT * INTO _customer FROM public.customers WHERE id = _invoice.customer_id;
  SELECT * INTO _tenant FROM public.tenants WHERE id = _invoice.tenant_id;
  
  IF _customer.email IS NOT NULL AND _customer.email <> '' THEN
    INSERT INTO public.email_logs (
      tenant_id, user_id, email_type, sender_address, recipient_email,
      subject, status, entity_type, entity_id, metadata
    ) VALUES (
      _invoice.tenant_id, NEW.created_by,
      'financial_payment_receipt',
      'billing@numaxio.com',
      _customer.email,
      'إيصال دفع – ' || NEW.amount || ' ' || _invoice.currency,
      'queued',
      'invoice_payment', NEW.id,
      jsonb_build_object(
        'invoice_number', _invoice.invoice_number,
        'company_name', _tenant.name,
        'vat_number', COALESCE(_tenant.vat_number, ''),
        'amount', NEW.amount,
        'currency', _invoice.currency,
        'payment_date', NEW.payment_date,
        'payment_method', NEW.payment_method,
        'reference_number', COALESCE(NEW.reference_number, ''),
        'customer_name', _customer.name,
        'remaining_balance', _invoice.amount_due - NEW.amount
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_receipt_financial_email
  AFTER INSERT ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.fire_payment_receipt_email();

-- Trigger: Wallet balance notification
CREATE OR REPLACE FUNCTION public.fire_wallet_balance_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant RECORD;
  _owner RECORD;
  _profile RECORD;
BEGIN
  IF NEW.status = 'completed' THEN
    SELECT * INTO _tenant FROM public.tenants WHERE id = NEW.tenant_id;
    
    -- Get tenant owner
    SELECT * INTO _owner FROM public.tenant_members 
    WHERE tenant_id = NEW.tenant_id AND role = 'owner' LIMIT 1;
    
    IF _owner IS NOT NULL THEN
      SELECT * INTO _profile FROM public.profiles WHERE id = _owner.user_id;
      
      IF _profile.email IS NOT NULL AND _profile.email <> '' THEN
        INSERT INTO public.email_logs (
          tenant_id, user_id, email_type, sender_address, recipient_email,
          subject, status, entity_type, entity_id, metadata
        ) VALUES (
          NEW.tenant_id, _owner.user_id,
          'financial_wallet_notification',
          'billing@numaxio.com',
          _profile.email,
          CASE NEW.transaction_type 
            WHEN 'deposit' THEN 'إشعار إيداع في المحفظة'
            WHEN 'withdrawal' THEN 'إشعار سحب من المحفظة'
            ELSE 'إشعار رصيد المحفظة'
          END,
          'queued',
          'wallet_transaction', NEW.id,
          jsonb_build_object(
            'transaction_type', NEW.transaction_type,
            'amount', NEW.amount,
            'balance_before', NEW.balance_before,
            'balance_after', NEW.balance_after,
            'company_name', _tenant.name,
            'reason', COALESCE(NEW.reason, ''),
            'reference_type', COALESCE(NEW.reference_type, '')
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_wallet_balance_financial_email
  AFTER INSERT OR UPDATE ON public.wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.fire_wallet_balance_email();

-- Trigger: Credit note (refund) email
CREATE OR REPLACE FUNCTION public.fire_credit_note_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _customer RECORD;
  _tenant RECORD;
  _token TEXT;
BEGIN
  IF NEW.status = 'issued' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT * INTO _customer FROM public.customers WHERE id = NEW.customer_id;
    SELECT * INTO _tenant FROM public.tenants WHERE id = NEW.tenant_id;
    
    IF _customer.email IS NOT NULL AND _customer.email <> '' THEN
      _token := encode(gen_random_bytes(32), 'hex');
      INSERT INTO public.document_access_tokens (tenant_id, document_type, document_id, token, expires_at, max_access, created_by)
      VALUES (NEW.tenant_id, 'credit_note', NEW.id, _token, now() + interval '48 hours', 5, COALESCE(auth.uid(), NEW.created_by));
      
      INSERT INTO public.email_logs (
        tenant_id, user_id, email_type, sender_address, recipient_email,
        subject, status, entity_type, entity_id, metadata
      ) VALUES (
        NEW.tenant_id, COALESCE(auth.uid(), NEW.created_by),
        'financial_refund',
        'billing@numaxio.com',
        _customer.email,
        'إشعار استرداد – ' || NEW.credit_note_number,
        'queued',
        'credit_note', NEW.id,
        jsonb_build_object(
          'credit_note_number', NEW.credit_note_number,
          'company_name', _tenant.name,
          'vat_number', COALESCE(_tenant.vat_number, ''),
          'subtotal', NEW.subtotal,
          'vat_total', NEW.vat_total,
          'grand_total', NEW.grand_total,
          'currency', NEW.currency,
          'credit_date', NEW.credit_date,
          'reason', COALESCE(NEW.reason, ''),
          'customer_name', _customer.name,
          'access_token', _token
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_note_financial_email
  AFTER UPDATE ON public.credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.fire_credit_note_email();
