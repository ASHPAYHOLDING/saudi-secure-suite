
-- Unified Feature Entitlements System

CREATE TABLE public.plan_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  limit_value INTEGER DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, feature_key)
);

ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read plan entitlements"
  ON public.plan_entitlements FOR SELECT USING (true);

CREATE POLICY "Platform admins manage entitlements"
  ON public.plan_entitlements FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Core entitlement check
CREATE OR REPLACE FUNCTION public.check_entitlement(_tenant_id UUID, _feature_key TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _sub RECORD; _ent RECORD;
BEGIN
  SELECT s.*, sp.slug AS plan_slug INTO _sub
  FROM public.subscriptions s JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = _tenant_id AND s.status IN ('active','trial','past_due')
  ORDER BY s.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed', false, 'reason', 'no_subscription'); END IF;
  IF _sub.status = 'trial' THEN RETURN jsonb_build_object('allowed', true, 'reason', 'trial', 'limit', NULL::integer); END IF;
  SELECT * INTO _ent FROM public.plan_entitlements WHERE plan_id = _sub.plan_id AND feature_key = _feature_key;
  IF NOT FOUND OR NOT _ent.is_enabled THEN RETURN jsonb_build_object('allowed', false, 'reason', 'not_in_plan', 'plan', _sub.plan_slug); END IF;
  RETURN jsonb_build_object('allowed', true, 'reason', 'entitled', 'plan', _sub.plan_slug, 'limit', _ent.limit_value);
END; $$;

-- Bulk check
CREATE OR REPLACE FUNCTION public.check_entitlements_bulk(_tenant_id UUID, _feature_keys TEXT[])
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _sub RECORD; _result JSONB := '{}'::JSONB; _key TEXT; _ent RECORD;
BEGIN
  SELECT s.*, sp.slug AS plan_slug INTO _sub
  FROM public.subscriptions s JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = _tenant_id AND s.status IN ('active','trial','past_due')
  ORDER BY s.created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    FOREACH _key IN ARRAY _feature_keys LOOP _result := _result || jsonb_build_object(_key, jsonb_build_object('allowed', false, 'reason', 'no_subscription')); END LOOP;
    RETURN _result;
  END IF;
  IF _sub.status = 'trial' THEN
    FOREACH _key IN ARRAY _feature_keys LOOP _result := _result || jsonb_build_object(_key, jsonb_build_object('allowed', true, 'reason', 'trial')); END LOOP;
    RETURN _result;
  END IF;
  FOREACH _key IN ARRAY _feature_keys LOOP
    SELECT * INTO _ent FROM public.plan_entitlements WHERE plan_id = _sub.plan_id AND feature_key = _key;
    IF NOT FOUND OR NOT _ent.is_enabled THEN
      _result := _result || jsonb_build_object(_key, jsonb_build_object('allowed', false, 'reason', 'not_in_plan'));
    ELSE
      _result := _result || jsonb_build_object(_key, jsonb_build_object('allowed', true, 'reason', 'entitled', 'limit', _ent.limit_value));
    END IF;
  END LOOP;
  RETURN _result;
END; $$;

-- Seed: Starter
INSERT INTO public.plan_entitlements (plan_id, feature_key, is_enabled, limit_value) VALUES
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'invoices_basic', true, 50),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'customers', true, 100),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'zatca_phase1', true, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'limited_reports', true, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'expenses', true, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'quotations', true, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'payment_reminders', true, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'max_users', true, 3),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'max_storage_gb', true, 5),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'contracts', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'advanced_reports', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'hr', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'accounting_advanced', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'wallet', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'paid_integrations', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'inventory', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'branches', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'sales_orders', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'purchase_orders', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'delivery_notes', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'journal_entries', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'stamp', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'branding', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'audit_log', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'team_management', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'analytics', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'numaxio_pay', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'sla_support', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'dedicated_support', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'api_access', false, NULL),
  ('a5550688-6bac-4e00-8e71-16bc3a2cb2fb', 'unlimited_everything', false, NULL);

-- Seed: Professional
INSERT INTO public.plan_entitlements (plan_id, feature_key, is_enabled, limit_value) VALUES
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'invoices_basic', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'customers', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'zatca_phase1', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'limited_reports', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'expenses', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'quotations', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'payment_reminders', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'contracts', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'advanced_reports', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'hr', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'accounting_advanced', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'wallet', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'paid_integrations', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'inventory', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'branches', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'sales_orders', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'purchase_orders', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'delivery_notes', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'journal_entries', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'stamp', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'branding', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'audit_log', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'team_management', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'analytics', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'numaxio_pay', true, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'max_users', true, 25),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'max_storage_gb', true, 50),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'sla_support', false, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'dedicated_support', false, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'api_access', false, NULL),
  ('6c9f65f8-d38c-4611-9284-4533033b0ac4', 'unlimited_everything', false, NULL);

-- Seed: Enterprise
INSERT INTO public.plan_entitlements (plan_id, feature_key, is_enabled, limit_value) VALUES
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'invoices_basic', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'customers', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'zatca_phase1', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'limited_reports', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'expenses', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'quotations', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'payment_reminders', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'contracts', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'advanced_reports', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'hr', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'accounting_advanced', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'wallet', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'paid_integrations', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'inventory', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'branches', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'sales_orders', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'purchase_orders', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'delivery_notes', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'journal_entries', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'stamp', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'branding', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'audit_log', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'team_management', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'analytics', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'numaxio_pay', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'max_users', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'max_storage_gb', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'sla_support', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'dedicated_support', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'api_access', true, NULL),
  ('8e0d0fb7-ddd2-4c9e-b5d9-e4383d14946f', 'unlimited_everything', true, NULL);
