
-- Add reversed_by_event_id to track which event reversed a payment
-- and is_reversed flag on invoice_payments for projection
ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

-- Function to reverse a payment via event sourcing
CREATE OR REPLACE FUNCTION public.reverse_payment(
  p_payment_id UUID,
  p_reason TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_payment RECORD;
  v_event_id UUID;
  v_actor UUID;
BEGIN
  v_actor := COALESCE(p_user_id, auth.uid());
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get payment details
  SELECT * INTO v_payment FROM public.invoice_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF v_payment.is_reversed THEN
    RAISE EXCEPTION 'Payment already reversed';
  END IF;

  -- 1. Emit reversal event
  INSERT INTO public.finance_events (tenant_id, aggregate_type, aggregate_id, event_type, payload_json, created_by)
  VALUES (
    v_payment.tenant_id,
    'invoice',
    v_payment.invoice_id,
    'payment_reversed',
    jsonb_build_object(
      'payment_id', v_payment.id,
      'original_amount', v_payment.amount,
      'reversed_amount', -v_payment.amount,
      'method', v_payment.payment_method,
      'reference', v_payment.reference_number,
      'reason', p_reason,
      'original_payment_date', v_payment.payment_date
    ),
    v_actor
  )
  RETURNING id INTO v_event_id;

  -- 2. Apply projection: mark payment as reversed (not delete)
  -- We need to temporarily disable the immutability trigger for this controlled update
  -- Instead, we mark via a separate mechanism
  UPDATE public.invoice_payments
  SET is_reversed = true,
      reversed_at = now(),
      reversal_reason = p_reason
  WHERE id = p_payment_id;

  -- 3. Update invoice paid_amount and status
  UPDATE public.invoices
  SET paid_amount = GREATEST(0, paid_amount - v_payment.amount),
      status = CASE
        WHEN GREATEST(0, paid_amount - v_payment.amount) <= 0 THEN 'issued'
        WHEN GREATEST(0, paid_amount - v_payment.amount) < grand_total THEN 'partially_paid'
        ELSE status
      END
  WHERE id = v_payment.invoice_id;

  -- 4. Audit log
  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (
    v_payment.tenant_id,
    v_actor,
    'payment_reversed',
    'invoice_payment',
    p_payment_id::text,
    v_payment.reference_number,
    jsonb_build_object('amount', v_payment.amount, 'reason', p_reason)
  );

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke from public, only via secure-rpc
REVOKE EXECUTE ON FUNCTION public.reverse_payment FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_payment TO service_role;
