
-- Clean up duplicate triggers (keep the ones from earlier migrations, drop new duplicates)
DROP TRIGGER IF EXISTS audit_stamp_trail ON public.tenants;
DROP TRIGGER IF EXISTS notify_on_new_tenant ON public.tenants;
DROP TRIGGER IF EXISTS set_updated_at_tenants ON public.tenants;
DROP TRIGGER IF EXISTS notify_on_subscription_change ON public.subscriptions;
DROP TRIGGER IF EXISTS set_updated_at_subscriptions ON public.subscriptions;
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
DROP TRIGGER IF EXISTS set_updated_at_departments ON public.departments;
DROP TRIGGER IF EXISTS set_updated_at_customers ON public.customers;
DROP TRIGGER IF EXISTS audit_invoice_trail ON public.invoices;
DROP TRIGGER IF EXISTS enforce_vat_on_invoice ON public.invoices;
DROP TRIGGER IF EXISTS enforce_zatca_on_invoice ON public.invoices;
DROP TRIGGER IF EXISTS set_updated_at_invoices ON public.invoices;
DROP TRIGGER IF EXISTS audit_contract_trail ON public.contracts;
DROP TRIGGER IF EXISTS set_updated_at_contracts ON public.contracts;
DROP TRIGGER IF EXISTS set_updated_at_contract_templates ON public.contract_templates;

-- Remove duplicate auth triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
