
-- 1. Drop the permissive UPDATE policy for platform admins
DROP POLICY IF EXISTS "Platform admins can update wallet status" ON public.tenant_wallets;

-- 2. Create RESTRICTIVE policy that blocks ALL direct UPDATEs (RLS level)
-- process_wallet_transaction() uses SECURITY DEFINER so it bypasses RLS
CREATE POLICY "Block all direct wallet updates"
ON public.tenant_wallets
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (false);

-- 3. Allow platform admins to UPDATE status ONLY (freeze/unfreeze) via a dedicated function
CREATE OR REPLACE FUNCTION public.admin_set_wallet_status(
  p_wallet_id uuid,
  p_status text,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet RECORD;
BEGIN
  IF p_status NOT IN ('active', 'frozen') THEN
    RAISE EXCEPTION 'حالة غير صالحة: %. المسموح: active, frozen', p_status;
  END IF;

  -- Verify caller is platform admin
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_admin_id) THEN
    RAISE EXCEPTION 'غير مصرح — يتطلب صلاحية سوبر أدمن';
  END IF;

  SELECT id, tenant_id, status INTO v_wallet
  FROM public.tenant_wallets WHERE id = p_wallet_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المحفظة غير موجودة';
  END IF;

  UPDATE public.tenant_wallets SET status = p_status WHERE id = p_wallet_id;

  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (
    v_wallet.tenant_id, p_admin_id,
    CASE p_status WHEN 'frozen' THEN 'wallet_freeze' ELSE 'wallet_unfreeze' END,
    'wallet', p_wallet_id, p_status,
    jsonb_build_object('old_status', v_wallet.status, 'new_status', p_status)
  );
END;
$$;
