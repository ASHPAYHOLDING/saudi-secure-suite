
-- Step 1: Create fraud attempts table
CREATE TABLE IF NOT EXISTS public.affiliate_fraud_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID REFERENCES public.affiliates(id),
  fraud_type TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_fraud_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view fraud attempts"
  ON public.affiliate_fraud_attempts FOR SELECT
  USING (EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()));

CREATE POLICY "Platform admins can update fraud attempts"
  ON public.affiliate_fraud_attempts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()));

-- Step 2: Fraud email trigger
CREATE OR REPLACE FUNCTION public.email_on_fraud_detected()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _aff_email TEXT; _aff_name TEXT;
  _fraud_labels JSONB := '{"self_referral":"إحالة ذاتية","duplicate_ip":"IP مكرر","duplicate_account":"حساب مكرر","cooling_bypass":"تجاوز فترة التبريد"}'::jsonb;
  _fraud_label TEXT;
BEGIN
  IF NEW.severity NOT IN ('high','critical') THEN RETURN NEW; END IF;
  _fraud_label := COALESCE(_fraud_labels ->> NEW.fraud_type, NEW.fraud_type);

  IF NEW.affiliate_id IS NOT NULL THEN
    SELECT full_name, email INTO _aff_name, _aff_email FROM affiliates WHERE id = NEW.affiliate_id;
    IF _aff_email IS NOT NULL THEN
      INSERT INTO email_logs (email_type, recipient_email, subject, status, sender_address, metadata)
      VALUES ('affiliate_fraud_warning', _aff_email, 'تنبيه أمني: تم رصد نشاط مشبوه في حسابك', 'queued', 'security@numaxio.com',
        jsonb_build_object('affiliate_name', _aff_name, 'fraud_type', _fraud_label, 'severity', NEW.severity, 'ip_address', NEW.ip_address));
    END IF;
  END IF;

  INSERT INTO email_logs (email_type, recipient_email, subject, status, sender_address, metadata)
  SELECT 'affiliate_fraud_admin_alert', p.email,
    'تنبيه احتيال (' || NEW.severity || '): ' || _fraud_label,
    'queued', 'security@numaxio.com',
    jsonb_build_object('affiliate_name', COALESCE(_aff_name,'غير معروف'), 'fraud_type', _fraud_label, 'severity', NEW.severity, 'details', NEW.details)
  FROM platform_admins pa JOIN profiles p ON p.id = pa.user_id WHERE p.email IS NOT NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_fraud_detected ON affiliate_fraud_attempts;
CREATE TRIGGER trg_email_fraud_detected AFTER INSERT ON affiliate_fraud_attempts FOR EACH ROW EXECUTE FUNCTION email_on_fraud_detected();

-- Step 3: Fix auto_promote to use platform_admins
CREATE OR REPLACE FUNCTION public.auto_promote_affiliate()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _affiliate_id UUID; _current_tier TEXT; _referral_count INT;
  _new_tier TEXT; _new_rate NUMERIC; _aff_name TEXT; _aff_email TEXT;
BEGIN
  _affiliate_id := NEW.affiliate_id;
  SELECT tier, full_name, email, commission_rate INTO _current_tier, _aff_name, _aff_email, _new_rate FROM affiliates WHERE id = _affiliate_id;
  IF _current_tier IS NULL OR _current_tier = 'elite' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO _referral_count FROM affiliate_referrals WHERE affiliate_id = _affiliate_id;

  _new_tier := _current_tier;
  IF _referral_count >= 50 AND _current_tier IN ('bronze','silver','gold') THEN _new_tier := 'platinum'; _new_rate := 15;
  ELSIF _referral_count >= 20 AND _current_tier IN ('bronze','silver') THEN _new_tier := 'gold'; _new_rate := 12;
  ELSIF _referral_count >= 5 AND _current_tier = 'bronze' THEN _new_tier := 'silver'; _new_rate := 10;
  END IF;

  IF _new_tier <> _current_tier THEN
    UPDATE affiliates SET tier = _new_tier, commission_rate = _new_rate, updated_at = now() WHERE id = _affiliate_id;

    INSERT INTO email_logs (email_type, recipient_email, subject, status, sender_address, metadata)
    VALUES ('affiliate_promotion', _aff_email, 'تهانينا! تمت ترقيتك إلى مستوى ' || _new_tier, 'queued', 'no-reply@numaxio.com',
      jsonb_build_object('affiliate_name', _aff_name, 'old_tier', _current_tier, 'new_tier', _new_tier, 'new_rate', _new_rate, 'referral_count', _referral_count));

    INSERT INTO collaboration_notifications (type, message, actor_id, user_id, tenant_id, entity_type, entity_id)
    SELECT 'affiliate_promotion', 'تمت ترقيتك إلى مستوى ' || _new_tier || '! نسبتك الجديدة ' || _new_rate || '%',
      a.user_id, a.user_id, COALESCE(a.tenant_id, '00000000-0000-0000-0000-000000000000'), 'affiliate', a.id::text
    FROM affiliates a WHERE a.id = _affiliate_id AND a.user_id IS NOT NULL;

    INSERT INTO collaboration_notifications (type, message, actor_id, user_id, tenant_id, entity_type, entity_id)
    SELECT 'affiliate_promotion', 'تمت ترقية الشريك ' || _aff_name || ' إلى ' || _new_tier,
      pa.user_id, pa.user_id, COALESCE((SELECT tenant_id FROM affiliates WHERE id = _affiliate_id), '00000000-0000-0000-0000-000000000000'),
      'affiliate', _affiliate_id::text
    FROM platform_admins pa;
  END IF;
  RETURN NEW;
END;
$$;
