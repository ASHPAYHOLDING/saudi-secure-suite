
-- Validation function: ensure every tenant has a wallet (runs deferred)
-- This adds a constraint trigger that checks after transaction commit
CREATE OR REPLACE FUNCTION public.validate_tenant_has_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_wallets WHERE tenant_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'لا يمكن إنشاء منشأة بدون محفظة — فشل الإنشاء التلقائي للمحفظة (tenant_id: %)', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create a constraint trigger that fires AFTER INSERT, deferred to end of transaction
-- This ensures auto_create_tenant_wallet runs first, then this validates
DROP TRIGGER IF EXISTS trg_validate_tenant_wallet ON public.tenants;
CREATE CONSTRAINT TRIGGER trg_validate_tenant_wallet
  AFTER INSERT ON public.tenants
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tenant_has_wallet();
