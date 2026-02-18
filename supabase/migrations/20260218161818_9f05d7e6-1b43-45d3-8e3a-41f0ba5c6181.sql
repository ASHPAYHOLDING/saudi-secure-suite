
-- Auto-promote affiliates based on referral count thresholds
-- Silver(5), Gold(20), Platinum(50), Elite(custom/manual)

CREATE OR REPLACE FUNCTION public.auto_promote_affiliate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _affiliate_id UUID;
  _current_tier TEXT;
  _referral_count INT;
  _new_tier TEXT;
  _new_rate NUMERIC;
  _aff_name TEXT;
  _aff_email TEXT;
BEGIN
  _affiliate_id := NEW.affiliate_id;

  -- Get current affiliate info
  SELECT tier, full_name, email, commission_rate
  INTO _current_tier, _aff_name, _aff_email, _new_rate
  FROM affiliates
  WHERE id = _affiliate_id;

  IF _current_tier IS NULL OR _current_tier = 'elite' THEN
    RETURN NEW;
  END IF;

  -- Count confirmed (non-flagged) referrals
  SELECT COUNT(*)
  INTO _referral_count
  FROM affiliate_referrals ar
  WHERE ar.affiliate_id = _affiliate_id
    AND NOT EXISTS (
      SELECT 1 FROM affiliate_fraud_attempts af
      WHERE af.affiliate_id = _affiliate_id
        AND af.severity IN ('high','critical')
        AND NOT af.resolved
    );

  -- Determine new tier
  _new_tier := _current_tier;
  IF _referral_count >= 50 AND _current_tier IN ('bronze','silver','gold') THEN
    _new_tier := 'platinum';
    _new_rate := 15;
  ELSIF _referral_count >= 20 AND _current_tier IN ('bronze','silver') THEN
    _new_tier := 'gold';
    _new_rate := 12;
  ELSIF _referral_count >= 5 AND _current_tier = 'bronze' THEN
    _new_tier := 'silver';
    _new_rate := 10;
  END IF;

  -- If promotion needed
  IF _new_tier <> _current_tier THEN
    UPDATE affiliates
    SET tier = _new_tier,
        commission_rate = _new_rate,
        updated_at = now()
    WHERE id = _affiliate_id;

    -- Queue congratulations email
    INSERT INTO email_logs (
      email_type, recipient_email, subject, status, sender_address,
      metadata
    ) VALUES (
      'affiliate_promotion',
      _aff_email,
      'تهانينا! تمت ترقيتك إلى مستوى ' || _new_tier,
      'queued',
      'no-reply@numaxio.com',
      jsonb_build_object(
        'affiliate_name', _aff_name,
        'old_tier', _current_tier,
        'new_tier', _new_tier,
        'new_rate', _new_rate,
        'referral_count', _referral_count
      )
    );

    -- Send instant notification to affiliate (if user_id exists)
    INSERT INTO collaboration_notifications (
      type, message, actor_id, user_id, tenant_id,
      entity_type, entity_id
    )
    SELECT
      'affiliate_promotion',
      'تمت ترقيتك إلى مستوى ' || _new_tier || '! نسبتك الجديدة ' || _new_rate || '%',
      a.user_id,
      a.user_id,
      COALESCE(a.tenant_id, '00000000-0000-0000-0000-000000000000')
    FROM affiliates a
    WHERE a.id = _affiliate_id AND a.user_id IS NOT NULL;

    -- Notify super admins
    INSERT INTO collaboration_notifications (
      type, message, actor_id, user_id, tenant_id,
      entity_type, entity_id
    )
    SELECT
      'affiliate_promotion',
      'تمت ترقية الشريك ' || _aff_name || ' إلى ' || _new_tier,
      p.id,
      p.id,
      COALESCE((SELECT tenant_id FROM affiliates WHERE id = _affiliate_id), '00000000-0000-0000-0000-000000000000')
    FROM profiles p
    WHERE p.is_super_admin = true;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on new referral
DROP TRIGGER IF EXISTS trg_auto_promote_affiliate ON affiliate_referrals;
CREATE TRIGGER trg_auto_promote_affiliate
  AFTER INSERT ON affiliate_referrals
  FOR EACH ROW
  EXECUTE FUNCTION auto_promote_affiliate();
