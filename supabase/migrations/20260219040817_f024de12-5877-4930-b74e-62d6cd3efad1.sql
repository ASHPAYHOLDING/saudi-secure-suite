
-- 1) Add recurring commission support to affiliate_commissions
ALTER TABLE public.affiliate_commissions
  ADD COLUMN IF NOT EXISTS commission_type TEXT NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS recurring_month INT,
  ADD COLUMN IF NOT EXISTS subscription_period_start DATE,
  ADD COLUMN IF NOT EXISTS subscription_period_end DATE,
  ADD COLUMN IF NOT EXISTS original_commission_id UUID REFERENCES public.affiliate_commissions(id);

-- Add check constraint separately (safer with existing data)
DO $$ BEGIN
  ALTER TABLE public.affiliate_commissions ADD CONSTRAINT chk_commission_type CHECK (commission_type IN ('one_time', 'recurring'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_aff_comm_recurring_dedup 
  ON public.affiliate_commissions(affiliate_id, subscription_id, recurring_month)
  WHERE commission_type = 'recurring';

-- 2) Conversion events table
CREATE TABLE IF NOT EXISTS public.affiliate_conversion_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_id UUID REFERENCES public.affiliate_referrals(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('click', 'signup', 'trial_start', 'subscription_start', 'subscription_renewal', 'subscription_cancel', 'upgrade', 'downgrade')),
  event_metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  tenant_id UUID REFERENCES public.tenants(id),
  referred_user_id UUID,
  revenue_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage conversion events"
  ON public.affiliate_conversion_events FOR ALL TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "Affiliates can view own conversion events"
  ON public.affiliate_conversion_events FOR SELECT TO authenticated
  USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));

CREATE INDEX idx_aff_conv_affiliate ON public.affiliate_conversion_events(affiliate_id, created_at DESC);
CREATE INDEX idx_aff_conv_type ON public.affiliate_conversion_events(event_type, created_at DESC);

-- 3) Affiliate payout schedules
CREATE TABLE IF NOT EXISTS public.affiliate_payout_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE UNIQUE,
  schedule_type TEXT NOT NULL DEFAULT 'manual' CHECK (schedule_type IN ('manual', 'weekly', 'biweekly', 'monthly')),
  payout_day INT DEFAULT 1,
  min_payout_amount NUMERIC(12,2) DEFAULT 500,
  auto_approve BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_payout_at TIMESTAMPTZ,
  next_payout_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_payout_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates manage own payout schedule"
  ON public.affiliate_payout_schedules FOR ALL TO authenticated
  USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()))
  WITH CHECK (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));

CREATE POLICY "Platform admins manage all payout schedules"
  ON public.affiliate_payout_schedules FOR ALL TO authenticated
  USING (public.is_platform_admin());

-- 4) Anti-fraud trigger
CREATE OR REPLACE FUNCTION public.detect_affiliate_fraud()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _recent_same_ip INT;
  _self_referral BOOLEAN;
  _rapid_signups INT;
BEGIN
  -- Self-referral detection
  IF NEW.referred_user_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM affiliates WHERE id = NEW.affiliate_id AND user_id = NEW.referred_user_id) INTO _self_referral;
    IF _self_referral THEN
      INSERT INTO affiliate_fraud_attempts (affiliate_id, fraud_type, severity, details, ip_address)
      VALUES (NEW.affiliate_id, 'self_referral', 'critical',
        jsonb_build_object('event_type', NEW.event_type, 'referred_user_id', NEW.referred_user_id), NEW.ip_address);
      RETURN NULL;
    END IF;
  END IF;

  -- IP flooding (>5 clicks/hour)
  IF NEW.event_type = 'click' AND NEW.ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO _recent_same_ip FROM affiliate_conversion_events
    WHERE affiliate_id = NEW.affiliate_id AND ip_address = NEW.ip_address AND event_type = 'click' AND created_at > now() - INTERVAL '1 hour';
    IF _recent_same_ip >= 5 THEN
      INSERT INTO affiliate_fraud_attempts (affiliate_id, fraud_type, severity, details, ip_address)
      VALUES (NEW.affiliate_id, 'ip_flooding', 'high', jsonb_build_object('count', _recent_same_ip), NEW.ip_address);
      RETURN NULL;
    END IF;
  END IF;

  -- Rapid signups (>10/hour)
  IF NEW.event_type = 'signup' THEN
    SELECT COUNT(*) INTO _rapid_signups FROM affiliate_conversion_events
    WHERE affiliate_id = NEW.affiliate_id AND event_type = 'signup' AND created_at > now() - INTERVAL '1 hour';
    IF _rapid_signups >= 10 THEN
      INSERT INTO affiliate_fraud_attempts (affiliate_id, fraud_type, severity, details)
      VALUES (NEW.affiliate_id, 'rapid_signups', 'high', jsonb_build_object('count', _rapid_signups));
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_detect_affiliate_fraud ON public.affiliate_conversion_events;
CREATE TRIGGER trg_detect_affiliate_fraud BEFORE INSERT ON public.affiliate_conversion_events
  FOR EACH ROW EXECUTE FUNCTION public.detect_affiliate_fraud();

-- 5) Recurring commission generator
CREATE OR REPLACE FUNCTION public.generate_recurring_commissions()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rec RECORD; _count INT := 0; _current_month INT;
BEGIN
  _current_month := EXTRACT(YEAR FROM now())::int * 12 + EXTRACT(MONTH FROM now())::int;
  FOR _rec IN
    SELECT ar.affiliate_id, ar.subscription_id, s.plan_id, s.current_period_start, s.current_period_end,
      a.commission_rate, p.price_monthly
    FROM affiliate_referrals ar
    JOIN subscriptions s ON s.id = ar.subscription_id
    JOIN affiliates a ON a.id = ar.affiliate_id
    JOIN subscription_plans p ON p.id = s.plan_id
    WHERE s.status = 'active' AND a.status = 'active' AND ar.subscription_id IS NOT NULL
  LOOP
    IF NOT EXISTS(SELECT 1 FROM affiliate_commissions WHERE affiliate_id = _rec.affiliate_id
      AND subscription_id = _rec.subscription_id AND recurring_month = _current_month AND commission_type = 'recurring') THEN
      INSERT INTO affiliate_commissions (affiliate_id, subscription_id, commission_type, recurring_month,
        gross_amount, net_amount, commission_rate, commission_amount, status, locked_until, subscription_period_start, subscription_period_end)
      VALUES (_rec.affiliate_id, _rec.subscription_id, 'recurring', _current_month,
        _rec.price_monthly, _rec.price_monthly, _rec.commission_rate,
        ROUND(_rec.price_monthly * _rec.commission_rate / 100, 2), 'locked', now() + INTERVAL '7 days',
        _rec.current_period_start, _rec.current_period_end);
      INSERT INTO affiliate_conversion_events (affiliate_id, event_type, revenue_amount)
      VALUES (_rec.affiliate_id, 'subscription_renewal', _rec.price_monthly);
      _count := _count + 1;
    END IF;
  END LOOP;
  UPDATE affiliates a SET
    total_pending = COALESCE((SELECT SUM(commission_amount) FROM affiliate_commissions WHERE affiliate_id = a.id AND status IN ('pending','locked','approved')), 0),
    total_earnings = COALESCE((SELECT SUM(commission_amount) FROM affiliate_commissions WHERE affiliate_id = a.id AND status != 'cancelled'), 0),
    updated_at = now()
  WHERE a.status = 'active';
  RETURN jsonb_build_object('generated', _count, 'month', _current_month);
END; $$;

REVOKE EXECUTE ON FUNCTION public.generate_recurring_commissions() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_recurring_commissions() TO service_role;

-- 6) Scheduled affiliate payouts processor
CREATE OR REPLACE FUNCTION public.process_scheduled_affiliate_payouts()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sched RECORD; _available NUMERIC; _count INT := 0;
BEGIN
  FOR _sched IN
    SELECT ps.*, a.full_name, a.bank_name, a.bank_iban, a.status as aff_status
    FROM affiliate_payout_schedules ps JOIN affiliates a ON a.id = ps.affiliate_id
    WHERE ps.is_active AND ps.schedule_type != 'manual' AND a.status = 'active'
      AND (ps.next_payout_at IS NULL OR ps.next_payout_at <= now())
  LOOP
    SELECT COALESCE(SUM(commission_amount), 0) INTO _available FROM affiliate_commissions
    WHERE affiliate_id = _sched.affiliate_id AND status = 'approved';
    IF _available < _sched.min_payout_amount THEN
      UPDATE affiliate_payout_schedules SET next_payout_at = CASE
        WHEN _sched.schedule_type = 'weekly' THEN now() + INTERVAL '7 days'
        WHEN _sched.schedule_type = 'biweekly' THEN now() + INTERVAL '14 days'
        ELSE (date_trunc('month', now()) + INTERVAL '1 month')::timestamptz + ((_sched.payout_day - 1) * INTERVAL '1 day')
      END, updated_at = now() WHERE id = _sched.id;
      CONTINUE;
    END IF;
    INSERT INTO affiliate_payouts (affiliate_id, amount, method, status, notes)
    VALUES (_sched.affiliate_id, _available,
      CASE WHEN _sched.auto_approve THEN 'wallet' ELSE 'bank_transfer' END,
      CASE WHEN _sched.auto_approve THEN 'approved' ELSE 'pending' END, 'صرف تلقائي مجدول');
    IF _sched.auto_approve THEN
      UPDATE affiliate_commissions SET status = 'paid', paid_at = now()
      WHERE affiliate_id = _sched.affiliate_id AND status = 'approved';
      UPDATE affiliates SET total_paid = total_paid + _available, total_pending = GREATEST(total_pending - _available, 0), updated_at = now()
      WHERE id = _sched.affiliate_id;
    END IF;
    UPDATE affiliate_payout_schedules SET last_payout_at = now(), next_payout_at = CASE
      WHEN _sched.schedule_type = 'weekly' THEN now() + INTERVAL '7 days'
      WHEN _sched.schedule_type = 'biweekly' THEN now() + INTERVAL '14 days'
      ELSE (date_trunc('month', now()) + INTERVAL '1 month')::timestamptz + ((_sched.payout_day - 1) * INTERVAL '1 day')
    END, updated_at = now() WHERE id = _sched.id;
    _count := _count + 1;
  END LOOP;
  RETURN jsonb_build_object('processed', _count);
END; $$;

REVOKE EXECUTE ON FUNCTION public.process_scheduled_affiliate_payouts() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_scheduled_affiliate_payouts() TO service_role;

-- 7) Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliate_conversion_events;
