
-- Drop and recreate approve_matured_commissions with correct return type
DROP FUNCTION IF EXISTS public.approve_matured_commissions();

CREATE OR REPLACE FUNCTION public.approve_matured_commissions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INT := 0;
BEGIN
  -- Only approve commissions past cooling period AND not flagged
  UPDATE affiliate_commissions ac
  SET status = 'approved'
  WHERE ac.status = 'locked'
    AND ac.locked_until <= now()
    AND NOT EXISTS (
      SELECT 1 FROM affiliate_referrals ar
      WHERE ar.affiliate_id = ac.affiliate_id
        AND ar.referred_tenant_id = ac.tenant_id
        AND ar.is_flagged = true
    );

  GET DIAGNOSTICS _count = ROW_COUNT;

  -- Update affiliate totals
  UPDATE affiliates a
  SET total_pending = (
    SELECT COALESCE(SUM(commission_amount), 0)
    FROM affiliate_commissions
    WHERE affiliate_id = a.id AND status IN ('pending', 'locked')
  ),
  total_earnings = (
    SELECT COALESCE(SUM(commission_amount), 0)
    FROM affiliate_commissions
    WHERE affiliate_id = a.id AND status IN ('approved', 'paid')
  ),
  updated_at = now()
  WHERE EXISTS (
    SELECT 1 FROM affiliate_commissions
    WHERE affiliate_id = a.id AND status = 'approved'
      AND locked_until <= now()
  );

  RETURN _count;
END;
$$;
