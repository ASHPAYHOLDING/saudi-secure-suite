
-- =============================================================
-- 1. Audit Log Table
-- =============================================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,           -- 'create', 'update', 'delete', 'sign'
  entity_type text NOT NULL,      -- 'invoice', 'contract', 'stamp', 'template'
  entity_id uuid,
  entity_label text,              -- human-readable label e.g. invoice number
  changes jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins+ can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (is_tenant_admin(tenant_id));

-- System inserts via triggers (SECURITY DEFINER functions)
-- No direct user INSERT/UPDATE/DELETE
CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE INDEX idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- =============================================================
-- 2. Role-checking helper functions
-- =============================================================

-- Finance operations: owner, admin, accountant
CREATE OR REPLACE FUNCTION public.is_authorized_finance(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin', 'accountant')
  )
$$;

-- HR operations: owner, admin, hr, manager
CREATE OR REPLACE FUNCTION public.is_authorized_hr(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin', 'hr', 'manager')
  )
$$;

-- Contract operations: owner, admin, manager, accountant
CREATE OR REPLACE FUNCTION public.is_authorized_contracts(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin', 'manager', 'accountant')
  )
$$;

-- =============================================================
-- 3. Tighten Invoice RLS — only finance roles can create/update
-- =============================================================
DROP POLICY IF EXISTS "Members can create invoices" ON public.invoices;
DROP POLICY IF EXISTS "Members can update invoices" ON public.invoices;

CREATE POLICY "Finance roles can create invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND created_by = auth.uid()
    AND is_authorized_finance(tenant_id)
  );

CREATE POLICY "Finance roles can update invoices"
  ON public.invoices FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id()
    AND is_authorized_finance(tenant_id)
  );

-- Invoice items: same finance restriction
DROP POLICY IF EXISTS "Members can create invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Members can update invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Members can delete invoice items" ON public.invoice_items;

CREATE POLICY "Finance roles can create invoice items"
  ON public.invoice_items FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND is_authorized_finance(tenant_id)
  );

CREATE POLICY "Finance roles can update invoice items"
  ON public.invoice_items FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id()
    AND is_authorized_finance(tenant_id)
  );

CREATE POLICY "Finance roles can delete invoice items"
  ON public.invoice_items FOR DELETE
  USING (
    tenant_id = get_user_tenant_id()
    AND is_authorized_finance(tenant_id)
  );

-- =============================================================
-- 4. Tighten Contract RLS — authorized roles only
-- =============================================================
DROP POLICY IF EXISTS "Authorized can create contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authorized can update contracts" ON public.contracts;

CREATE POLICY "Authorized can create contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND created_by = auth.uid()
    AND is_authorized_contracts(tenant_id)
  );

CREATE POLICY "Authorized can update contracts"
  ON public.contracts FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id()
    AND status <> 'signed'
    AND is_authorized_contracts(tenant_id)
  );

-- =============================================================
-- 5. Audit triggers (SECURITY DEFINER)
-- =============================================================

-- Invoice audit
CREATE OR REPLACE FUNCTION public.audit_invoice_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (NEW.tenant_id, NEW.created_by, 'create', 'invoice', NEW.id, NEW.invoice_number);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      NEW.tenant_id,
      auth.uid(),
      CASE WHEN OLD.status <> NEW.status AND NEW.status = 'cancelled' THEN 'cancel'
           WHEN OLD.status <> NEW.status AND NEW.status = 'paid' THEN 'mark_paid'
           ELSE 'update' END,
      'invoice', NEW.id, NEW.invoice_number,
      jsonb_build_object(
        'old_status', OLD.status, 'new_status', NEW.status,
        'old_total', OLD.grand_total, 'new_total', NEW.grand_total
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (OLD.tenant_id, auth.uid(), 'delete', 'invoice', OLD.id, OLD.invoice_number);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_invoice_changes();

-- Contract audit
CREATE OR REPLACE FUNCTION public.audit_contract_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (NEW.tenant_id, NEW.created_by, 'create', 'contract', NEW.id, NEW.contract_number);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      NEW.tenant_id,
      auth.uid(),
      CASE WHEN NEW.status = 'signed' AND OLD.status <> 'signed' THEN 'sign'
           ELSE 'update' END,
      'contract', NEW.id, NEW.contract_number,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
    VALUES (OLD.tenant_id, auth.uid(), 'delete', 'contract', OLD.id, OLD.contract_number);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_contracts
  AFTER INSERT OR UPDATE OR DELETE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.audit_contract_changes();

-- Stamp (tenant) audit
CREATE OR REPLACE FUNCTION public.audit_stamp_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.stamp_enabled IS DISTINCT FROM NEW.stamp_enabled)
     OR (OLD.stamp_image_url IS DISTINCT FROM NEW.stamp_image_url)
     OR (OLD.stamp_company_name IS DISTINCT FROM NEW.stamp_company_name)
     OR (OLD.stamp_cr_number IS DISTINCT FROM NEW.stamp_cr_number)
     OR (OLD.stamp_vat_number IS DISTINCT FROM NEW.stamp_vat_number)
  THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (
      NEW.id,
      auth.uid(),
      'update',
      'stamp',
      NEW.id,
      NEW.name,
      jsonb_build_object(
        'stamp_enabled', jsonb_build_object('old', OLD.stamp_enabled, 'new', NEW.stamp_enabled),
        'stamp_company_name', jsonb_build_object('old', OLD.stamp_company_name, 'new', NEW.stamp_company_name)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_stamp
  AFTER UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.audit_stamp_changes();
