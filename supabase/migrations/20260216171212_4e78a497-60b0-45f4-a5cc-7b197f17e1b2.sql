
-- Drop existing triggers if any, then recreate all

-- Audit triggers
DROP TRIGGER IF EXISTS trg_audit_invoices ON public.invoices;
CREATE TRIGGER trg_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_invoice_changes();

DROP TRIGGER IF EXISTS trg_audit_contracts ON public.contracts;
CREATE TRIGGER trg_audit_contracts
  AFTER INSERT OR UPDATE OR DELETE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.audit_contract_changes();

DROP TRIGGER IF EXISTS trg_audit_stamps ON public.tenants;
CREATE TRIGGER trg_audit_stamps
  AFTER UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.audit_stamp_changes();

-- Notification triggers
DROP TRIGGER IF EXISTS trg_notify_subscription_change ON public.subscriptions;
CREATE TRIGGER trg_notify_subscription_change
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_subscription_change();

DROP TRIGGER IF EXISTS trg_notify_new_tenant ON public.tenants;
CREATE TRIGGER trg_notify_new_tenant
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_tenant();

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_updated_at_tenants ON public.tenants;
CREATE TRIGGER trg_updated_at_tenants
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_updated_at_contracts ON public.contracts;
CREATE TRIGGER trg_updated_at_contracts
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_updated_at_invoices ON public.invoices;
CREATE TRIGGER trg_updated_at_invoices
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_updated_at_customers ON public.customers;
CREATE TRIGGER trg_updated_at_customers
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_updated_at_departments ON public.departments;
CREATE TRIGGER trg_updated_at_departments
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_updated_at_contract_templates ON public.contract_templates;
CREATE TRIGGER trg_updated_at_contract_templates
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_updated_at_profiles ON public.profiles;
CREATE TRIGGER trg_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_updated_at_subscriptions ON public.subscriptions;
CREATE TRIGGER trg_updated_at_subscriptions
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Compliance triggers
DROP TRIGGER IF EXISTS trg_enforce_vat_compliance ON public.invoices;
CREATE TRIGGER trg_enforce_vat_compliance
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vat_compliance();

DROP TRIGGER IF EXISTS trg_enforce_zatca_phase1 ON public.invoices;
CREATE TRIGGER trg_enforce_zatca_phase1
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_zatca_phase1();

-- Ensure audit_logs is append-only: revoke UPDATE/DELETE at RLS level
-- (RLS policies already block UPDATE/DELETE, but add explicit DENY policies for safety)
DO $$
BEGIN
  -- Drop if exists to be idempotent
  DROP POLICY IF EXISTS "Deny all updates on audit_logs" ON public.audit_logs;
  DROP POLICY IF EXISTS "Deny all deletes on audit_logs" ON public.audit_logs;
  
  CREATE POLICY "Deny all updates on audit_logs"
    ON public.audit_logs FOR UPDATE
    USING (false);
    
  CREATE POLICY "Deny all deletes on audit_logs"
    ON public.audit_logs FOR DELETE
    USING (false);
END $$;
