
-- ============================================
-- 1. AFFILIATES TABLE
-- ============================================
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id uuid,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  tier text NOT NULL DEFAULT 'silver',
  commission_rate numeric NOT NULL DEFAULT 10,
  total_earnings numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  total_pending numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliates_code_unique UNIQUE (code),
  CONSTRAINT affiliates_status_check CHECK (status IN ('active','suspended','pending')),
  CONSTRAINT affiliates_tier_check CHECK (tier IN ('silver','gold','platinum','elite')),
  CONSTRAINT affiliates_commission_rate_range CHECK (commission_rate >= 0 AND commission_rate <= 100)
);

-- ============================================
-- 2. AFFILIATE REFERRALS TABLE
-- ============================================
CREATE TABLE public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  referred_user_id uuid,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  source text DEFAULT 'direct',
  utm_campaign text,
  utm_medium text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 3. AFFILIATE COMMISSIONS (Financial Ledger)
-- ============================================
CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  gross_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  locked_until timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_commissions_status_check CHECK (status IN ('pending','locked','approved','paid','cancelled'))
);

-- ============================================
-- 4. AFFILIATE PAYOUTS TABLE
-- ============================================
CREATE TABLE public.affiliate_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'wallet',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid,
  CONSTRAINT affiliate_payouts_method_check CHECK (method IN ('wallet','bank_transfer')),
  CONSTRAINT affiliate_payouts_status_check CHECK (status IN ('pending','approved','paid','rejected'))
);

-- ============================================
-- 5. INDEXES
-- ============================================
CREATE INDEX idx_affiliates_code ON public.affiliates(code);
CREATE INDEX idx_affiliates_status ON public.affiliates(status);
CREATE INDEX idx_affiliates_tenant_id ON public.affiliates(tenant_id);
CREATE INDEX idx_affiliates_user_id ON public.affiliates(user_id);
CREATE INDEX idx_affiliate_referrals_affiliate_id ON public.affiliate_referrals(affiliate_id);
CREATE INDEX idx_affiliate_referrals_referred_tenant ON public.affiliate_referrals(referred_tenant_id);
CREATE INDEX idx_affiliate_commissions_affiliate_id ON public.affiliate_commissions(affiliate_id);
CREATE INDEX idx_affiliate_commissions_status ON public.affiliate_commissions(status);
CREATE INDEX idx_affiliate_commissions_tenant_id ON public.affiliate_commissions(tenant_id);
CREATE INDEX idx_affiliate_payouts_affiliate_id ON public.affiliate_payouts(affiliate_id);
CREATE INDEX idx_affiliate_payouts_status ON public.affiliate_payouts(status);

-- ============================================
-- 6. RLS ENABLE
-- ============================================
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. RLS POLICIES - AFFILIATES
-- ============================================
CREATE POLICY "Platform admins full access on affiliates"
  ON public.affiliates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

CREATE POLICY "Affiliates can view own record"
  ON public.affiliates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Tenant owners can view linked affiliates"
  ON public.affiliates FOR SELECT
  USING (
    tenant_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = affiliates.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );

-- ============================================
-- 8. RLS POLICIES - REFERRALS
-- ============================================
CREATE POLICY "Platform admins full access on referrals"
  ON public.affiliate_referrals FOR ALL
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

CREATE POLICY "Affiliates can view own referrals"
  ON public.affiliate_referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_referrals.affiliate_id
        AND a.user_id = auth.uid()
    )
  );

-- ============================================
-- 9. RLS POLICIES - COMMISSIONS
-- ============================================
CREATE POLICY "Platform admins full access on commissions"
  ON public.affiliate_commissions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

CREATE POLICY "Affiliates can view own commissions"
  ON public.affiliate_commissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_commissions.affiliate_id
        AND a.user_id = auth.uid()
    )
  );

-- ============================================
-- 10. RLS POLICIES - PAYOUTS
-- ============================================
CREATE POLICY "Platform admins full access on payouts"
  ON public.affiliate_payouts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

CREATE POLICY "Affiliates can view own payouts"
  ON public.affiliate_payouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_payouts.affiliate_id
        AND a.user_id = auth.uid()
    )
  );

-- ============================================
-- 11. UPDATED_AT TRIGGER
-- ============================================
CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliate_commissions_updated_at
  BEFORE UPDATE ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 12. COMMISSION IMMUTABILITY (paid/cancelled)
-- ============================================
CREATE OR REPLACE FUNCTION public.prevent_paid_commission_mutation()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'لا يمكن تعديل عمولة بحالة % (Commission with status % is immutable)', OLD.status, OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_paid_commission_edit
  BEFORE UPDATE ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_commission_mutation();

-- ============================================
-- 13. AUTO-UPDATE AFFILIATE TOTALS
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_affiliate_totals()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _aff_id uuid;
BEGIN
  _aff_id := COALESCE(NEW.affiliate_id, OLD.affiliate_id);

  UPDATE public.affiliates SET
    total_earnings = COALESCE((SELECT SUM(commission_amount) FROM public.affiliate_commissions WHERE affiliate_id = _aff_id AND status IN ('approved','paid','locked')), 0),
    total_paid = COALESCE((SELECT SUM(commission_amount) FROM public.affiliate_commissions WHERE affiliate_id = _aff_id AND status = 'paid'), 0),
    total_pending = COALESCE((SELECT SUM(commission_amount) FROM public.affiliate_commissions WHERE affiliate_id = _aff_id AND status IN ('pending','locked')), 0)
  WHERE id = _aff_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER sync_affiliate_totals_on_commission
  AFTER INSERT OR UPDATE OR DELETE ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.sync_affiliate_totals();

-- ============================================
-- 14. REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliate_referrals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliate_commissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliate_payouts;
