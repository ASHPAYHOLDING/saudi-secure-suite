-- Trigger function: queue email when affiliate application is submitted (INSERT with status=pending)
CREATE OR REPLACE FUNCTION public.queue_affiliate_application_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On INSERT with pending status → application received email
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO public.email_logs (
      email_type, recipient_email, subject, sender_address,
      status, tenant_id, entity_type, entity_id,
      metadata
    ) VALUES (
      'affiliate_application_received',
      NEW.email,
      'تم استلام طلب الانضمام لبرنامج الشركاء',
      'no-reply@numaxio.com',
      'queued',
      NEW.tenant_id,
      'affiliate',
      NEW.id,
      jsonb_build_object(
        'full_name', NEW.full_name,
        'email', NEW.email,
        'code', NEW.code,
        'tier', NEW.tier,
        'commission_rate', NEW.commission_rate
      )
    );
  END IF;

  -- On UPDATE from pending → active → approved email
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'active' THEN
    INSERT INTO public.email_logs (
      email_type, recipient_email, subject, sender_address,
      status, tenant_id, entity_type, entity_id,
      metadata
    ) VALUES (
      'affiliate_application_approved',
      NEW.email,
      'تمت الموافقة على طلبك – برنامج شركاء Numaxio',
      'no-reply@numaxio.com',
      'queued',
      NEW.tenant_id,
      'affiliate',
      NEW.id,
      jsonb_build_object(
        'full_name', NEW.full_name,
        'email', NEW.email,
        'code', NEW.code,
        'tier', NEW.tier,
        'commission_rate', NEW.commission_rate
      )
    );
  END IF;

  -- On UPDATE from pending → suspended (rejected) → rejected email
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'suspended' THEN
    INSERT INTO public.email_logs (
      email_type, recipient_email, subject, sender_address,
      status, tenant_id, entity_type, entity_id,
      metadata
    ) VALUES (
      'affiliate_application_rejected',
      NEW.email,
      'تحديث حالة طلبك – برنامج شركاء Numaxio',
      'no-reply@numaxio.com',
      'queued',
      NEW.tenant_id,
      'affiliate',
      NEW.id,
      jsonb_build_object(
        'full_name', NEW.full_name,
        'email', NEW.email,
        'rejection_reason', COALESCE(NEW.notes, '')
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on affiliates table
DROP TRIGGER IF EXISTS trg_affiliate_application_email ON public.affiliates;
CREATE TRIGGER trg_affiliate_application_email
  AFTER INSERT OR UPDATE OF status ON public.affiliates
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_affiliate_application_email();