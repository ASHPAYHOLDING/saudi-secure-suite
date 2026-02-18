-- Database-level entitlement enforcement function
-- Used in RLS policies to block write operations for disabled features
CREATE OR REPLACE FUNCTION public.enforce_feature_entitlement(_tenant_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _result jsonb;
BEGIN
  _result := public.check_entitlement(_tenant_id, _feature_key);
  RETURN (_result->>'allowed')::boolean;
END;
$$;

-- Add RLS policies for feature-gated write operations on key tables

-- Invoices: require invoices_basic entitlement for INSERT
CREATE POLICY "enforce_invoices_entitlement"
ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (
  public.enforce_feature_entitlement(tenant_id, 'invoices_basic')
);

-- Contracts: require contracts entitlement for INSERT
CREATE POLICY "enforce_contracts_entitlement"
ON public.contracts
FOR INSERT
TO authenticated
WITH CHECK (
  public.enforce_feature_entitlement(tenant_id, 'contracts')
);

-- Expenses: require expenses entitlement for INSERT
CREATE POLICY "enforce_expenses_entitlement"
ON public.expenses
FOR INSERT
TO authenticated
WITH CHECK (
  public.enforce_feature_entitlement(tenant_id, 'expenses')
);

-- Journal entries: require journal_entries entitlement for INSERT
CREATE POLICY "enforce_journal_entries_entitlement"
ON public.journal_entries
FOR INSERT
TO authenticated
WITH CHECK (
  public.enforce_feature_entitlement(tenant_id, 'journal_entries')
);

-- Products (inventory): require inventory entitlement for INSERT
CREATE POLICY "enforce_inventory_entitlement"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  public.enforce_feature_entitlement(tenant_id, 'inventory')
);

-- Sales orders: require sales_orders entitlement for INSERT
CREATE POLICY "enforce_sales_orders_entitlement"
ON public.sales_orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.enforce_feature_entitlement(tenant_id, 'sales_orders')
);

-- Purchase orders: require purchase_orders entitlement for INSERT
CREATE POLICY "enforce_purchase_orders_entitlement"
ON public.purchase_orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.enforce_feature_entitlement(tenant_id, 'purchase_orders')
);

-- Delivery notes: require delivery_notes entitlement for INSERT
CREATE POLICY "enforce_delivery_notes_entitlement"
ON public.delivery_notes
FOR INSERT
TO authenticated
WITH CHECK (
  public.enforce_feature_entitlement(tenant_id, 'delivery_notes')
);

-- Credit notes: require invoices_basic entitlement for INSERT
CREATE POLICY "enforce_credit_notes_entitlement"
ON public.credit_notes
FOR INSERT
TO authenticated
WITH CHECK (
  public.enforce_feature_entitlement(tenant_id, 'invoices_basic')
);

-- Quotations: require quotations entitlement for INSERT
CREATE POLICY "enforce_quotations_entitlement"
ON public.quotations
FOR INSERT
TO authenticated
WITH CHECK (
  public.enforce_feature_entitlement(tenant_id, 'quotations')
);
