
-- Drop existing permissive admin ALL policies on wallet_transactions and wallet_receipts
DROP POLICY IF EXISTS "Platform admins full access to wallet_transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Platform admins full access to wallet_receipts" ON public.wallet_receipts;

-- Re-create as SELECT-only policies
CREATE POLICY "Platform admins read-only wallet_transactions"
ON public.wallet_transactions
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

CREATE POLICY "Platform admins read-only wallet_receipts"
ON public.wallet_receipts
FOR SELECT
TO authenticated
USING (public.is_platform_admin());
