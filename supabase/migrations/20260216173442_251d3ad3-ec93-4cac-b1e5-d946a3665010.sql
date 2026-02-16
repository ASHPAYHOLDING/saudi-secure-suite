
-- Clean up duplicate triggers from overlapping migrations
DROP TRIGGER IF EXISTS trg_audit_stamps ON public.tenants;
DROP TRIGGER IF EXISTS trg_notify_new_tenant ON public.tenants;
DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_notify_subscription_change ON public.subscriptions;
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
DROP TRIGGER IF EXISTS update_departments_updated_at ON public.departments;
DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
DROP TRIGGER IF EXISTS update_contract_templates_updated_at ON public.contract_templates;
DROP TRIGGER IF EXISTS update_contracts_updated_at ON public.contracts;
