-- Fix 1: trg_invoice_domain_event uses NEW.total but column is grand_total
CREATE OR REPLACE FUNCTION public.trg_invoice_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM publish_domain_event(
      NEW.tenant_id, 'billing', 'invoice_created',
      jsonb_build_object('invoice_id', NEW.id, 'number', NEW.invoice_number, 'total', NEW.grand_total, 'status', NEW.status),
      NEW.id::text, 'invoice',
      NULL
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM publish_domain_event(
      NEW.tenant_id, 'billing', 'invoice_' || NEW.status,
      jsonb_build_object('invoice_id', NEW.id, 'number', NEW.invoice_number, 'total', NEW.grand_total, 'old_status', OLD.status, 'new_status', NEW.status),
      NEW.id::text, 'invoice',
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Fix 2: enforce_budget_entitlement uses record syntax on jsonb result
CREATE OR REPLACE FUNCTION public.enforce_budget_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ent jsonb;
  budget_count INT;
BEGIN
  ent := public.check_entitlement(NEW.tenant_id, 'budgets_basic');
  
  IF NOT (ent->>'allowed')::boolean THEN
    RAISE EXCEPTION 'Budget feature not available in current plan';
  END IF;
  
  IF ent->>'limit' IS NOT NULL THEN
    SELECT COUNT(*) INTO budget_count
    FROM public.budgets
    WHERE tenant_id = NEW.tenant_id;
    
    IF budget_count >= (ent->>'limit')::int THEN
      RAISE EXCEPTION 'Budget limit reached for current plan (% allowed)', (ent->>'limit')::int;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix 3: enforce_feature_entitlement - make sure it handles jsonb properly
CREATE OR REPLACE FUNCTION public.enforce_feature_entitlement(_tenant_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _result jsonb;
BEGIN
  _result := public.check_entitlement(_tenant_id, _feature_key);
  RETURN COALESCE((_result->>'allowed')::boolean, false);
END;
$$;