
-- ═══════════════════════════════════════════════════════════════════
-- PRICING REFACTOR MIGRATION (Fixed)
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Update subscription_plans ───

UPDATE subscription_plans
SET name_ar = 'أساسي', name_en = 'Starter',
    price_monthly = 149.00, price_quarterly = 402.00, price_yearly = 1430.00,
    max_users = 2, max_invoices = 100, max_storage_gb = 5, max_employees = NULL,
    features = '["فواتير إلكترونية","إدارة العملاء","QR متوافق مع ZATCA Phase 1","تقارير أساسية","دعم عبر البريد","مدى فقط","فرع واحد"]'::jsonb
WHERE slug = 'starter';

UPDATE subscription_plans
SET slug = 'business', name_ar = 'الأعمال', name_en = 'Business',
    price_monthly = 399.00, price_quarterly = 1077.00, price_yearly = 3830.00,
    max_users = 15, max_invoices = NULL, max_storage_gb = 100, max_employees = 50,
    features = '["كل مميزات الأساسي","فواتير غير محدودة","ZATCA Phase 2 كامل","إقرار ضريبي آلي","تقارير متقدمة + تحليلات","نظام موافقات","AI محاسبي أساسي","5 فروع","15 مستخدم","بوابات دفع متعددة","إدارة العقود","ختم إلكتروني","سجل مراجعة"]'::jsonb
WHERE slug = 'professional';

UPDATE subscription_plans
SET name_ar = 'المؤسسي', name_en = 'Enterprise',
    price_monthly = 0.00, price_quarterly = NULL, price_yearly = NULL,
    max_users = NULL, max_invoices = NULL, max_storage_gb = NULL, max_employees = NULL,
    features = '["كل مميزات الأعمال","مستخدمين غير محدود","فروع غير محدودة","AI محاسبي متقدم","سير عمل مخصص","تمويل داخلي","هيكل مؤسسي","شجرة حسابات","مدير حساب مخصص","API كامل","SLA 99.9%","جميع بوابات الدفع"]'::jsonb
WHERE slug = 'enterprise';

-- ─── 2. Add entitlements_json column ───

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS entitlements_json JSONB DEFAULT '{}'::jsonb;

UPDATE subscription_plans SET entitlements_json = '{"users_limit":2,"invoices_limit":100,"branches_limit":1,"storage_gb":5,"zatca_phase":1,"ai_level":0,"approvals_enabled":false,"advanced_reports":false,"enterprise_mode":false,"custom_workflows":false,"internal_financing":false,"payment_gateways":["mada"]}'::jsonb WHERE slug = 'starter';
UPDATE subscription_plans SET entitlements_json = '{"users_limit":15,"invoices_limit":-1,"branches_limit":5,"storage_gb":100,"zatca_phase":2,"ai_level":1,"approvals_enabled":true,"advanced_reports":true,"enterprise_mode":false,"custom_workflows":false,"internal_financing":false,"payment_gateways":["mada","visa","mastercard","applepay","stcpay"]}'::jsonb WHERE slug = 'business';
UPDATE subscription_plans SET entitlements_json = '{"users_limit":-1,"invoices_limit":-1,"branches_limit":-1,"storage_gb":-1,"zatca_phase":2,"ai_level":2,"approvals_enabled":true,"advanced_reports":true,"enterprise_mode":true,"custom_workflows":true,"internal_financing":true,"payment_gateways":["all"]}'::jsonb WHERE slug = 'enterprise';

-- ─── 3. New feature keys in plan_entitlements ───

DO $$
DECLARE
  _starter_id uuid;
  _business_id uuid;
  _enterprise_id uuid;
BEGIN
  SELECT id INTO _starter_id FROM subscription_plans WHERE slug = 'starter';
  SELECT id INTO _business_id FROM subscription_plans WHERE slug = 'business';
  SELECT id INTO _enterprise_id FROM subscription_plans WHERE slug = 'enterprise';

  INSERT INTO plan_entitlements (plan_id, feature_key, is_enabled, limit_value) VALUES
    (_starter_id, 'zatca_phase2', false, NULL),
    (_business_id, 'zatca_phase2', true, NULL),
    (_enterprise_id, 'zatca_phase2', true, NULL),
    (_starter_id, 'ai_accounting', false, 0),
    (_business_id, 'ai_accounting', true, 1),
    (_enterprise_id, 'ai_accounting', true, 2),
    (_starter_id, 'approvals_enabled', false, NULL),
    (_business_id, 'approvals_enabled', true, NULL),
    (_enterprise_id, 'approvals_enabled', true, NULL),
    (_starter_id, 'custom_workflows', false, NULL),
    (_business_id, 'custom_workflows', false, NULL),
    (_enterprise_id, 'custom_workflows', true, NULL),
    (_starter_id, 'internal_financing', false, NULL),
    (_business_id, 'internal_financing', false, NULL),
    (_enterprise_id, 'internal_financing', true, NULL),
    (_starter_id, 'vat_auto_return', false, NULL),
    (_business_id, 'vat_auto_return', true, NULL),
    (_enterprise_id, 'vat_auto_return', true, NULL)
  ON CONFLICT DO NOTHING;

  -- Update limits
  UPDATE plan_entitlements SET limit_value = 2 WHERE plan_id = _starter_id AND feature_key = 'max_users';
  UPDATE plan_entitlements SET limit_value = 100 WHERE plan_id = _starter_id AND feature_key = 'invoices_basic';
  UPDATE plan_entitlements SET is_enabled = false, limit_value = 1 WHERE plan_id = _starter_id AND feature_key = 'branches';
  UPDATE plan_entitlements SET limit_value = 15 WHERE plan_id = _business_id AND feature_key = 'max_users';
  UPDATE plan_entitlements SET limit_value = NULL WHERE plan_id = _business_id AND feature_key = 'invoices_basic';
  UPDATE plan_entitlements SET limit_value = 5 WHERE plan_id = _business_id AND feature_key = 'branches';
  UPDATE plan_entitlements SET is_enabled = false WHERE plan_id = _starter_id AND feature_key = 'enterprise_mode';
  UPDATE plan_entitlements SET is_enabled = false WHERE plan_id = _business_id AND feature_key = 'enterprise_mode';
END $$;

-- ─── 4. Create tenant_usage_tracking table ───

CREATE TABLE IF NOT EXISTS public.tenant_usage_tracking (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  limit_value INTEGER,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, metric_key)
);

ALTER TABLE public.tenant_usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can read own usage"
  ON public.tenant_usage_tracking FOR SELECT
  USING (tenant_id IN (
    SELECT t.id FROM tenants t
    JOIN tenant_members tm ON tm.tenant_id = t.id
    WHERE tm.user_id = auth.uid()
  ));

-- ─── 5. Fix rebuild_tenant_entitlements_cache to handle missing paid_integrations table ───

CREATE OR REPLACE FUNCTION public.rebuild_tenant_entitlements_cache(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _sub RECORD;
  _result JSONB := '{}'::JSONB;
  _ent RECORD;
  _plan_id uuid;
BEGIN
  SELECT s.id, s.plan_id, s.status, sp.slug AS plan_slug
    INTO _sub
  FROM subscriptions s
  JOIN subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = p_tenant_id
    AND s.status IN ('active', 'trial', 'past_due')
    AND s.deleted_at IS NULL
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    FOR _ent IN SELECT DISTINCT feature_key FROM plan_entitlements LOOP
      _result := _result || jsonb_build_object(
        _ent.feature_key,
        jsonb_build_object('allowed', false, 'reason', 'no_subscription')
      );
    END LOOP;
    _plan_id := NULL;
  ELSIF _sub.status = 'trial' THEN
    FOR _ent IN SELECT DISTINCT feature_key FROM plan_entitlements LOOP
      _result := _result || jsonb_build_object(
        _ent.feature_key,
        jsonb_build_object('allowed', true, 'reason', 'trial', 'plan', _sub.plan_slug)
      );
    END LOOP;
    _plan_id := _sub.plan_id;
  ELSE
    _plan_id := _sub.plan_id;
    FOR _ent IN SELECT pe.feature_key, pe.is_enabled, pe.limit_value
                FROM plan_entitlements pe WHERE pe.plan_id = _sub.plan_id
    LOOP
      IF _ent.is_enabled THEN
        _result := _result || jsonb_build_object(
          _ent.feature_key,
          jsonb_build_object('allowed', true, 'reason', 'entitled', 'plan', _sub.plan_slug, 'limit', _ent.limit_value)
        );
      ELSE
        _result := _result || jsonb_build_object(
          _ent.feature_key,
          jsonb_build_object('allowed', false, 'reason', 'not_in_plan', 'plan', _sub.plan_slug)
        );
      END IF;
    END LOOP;

    FOR _ent IN
      SELECT DISTINCT pe2.feature_key FROM plan_entitlements pe2
      WHERE pe2.feature_key NOT IN (
        SELECT pe3.feature_key FROM plan_entitlements pe3 WHERE pe3.plan_id = _sub.plan_id
      )
    LOOP
      _result := _result || jsonb_build_object(
        _ent.feature_key,
        jsonb_build_object('allowed', false, 'reason', 'not_in_plan', 'plan', _sub.plan_slug)
      );
    END LOOP;
  END IF;

  -- Overlay paid integrations (only if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_paid_integrations') THEN
    FOR _ent IN
      EXECUTE 'SELECT pi.key AS integration_key FROM tenant_paid_integrations tpi JOIN paid_integrations pi ON pi.id = tpi.integration_id WHERE tpi.tenant_id = $1 AND tpi.status = ''active'' AND tpi.deactivated_at IS NULL'
      USING p_tenant_id
    LOOP
      _result := _result || jsonb_build_object(
        _ent.integration_key,
        jsonb_build_object('allowed', true, 'reason', 'paid_integration')
      );
    END LOOP;
  END IF;

  INSERT INTO tenant_entitlements_cache (tenant_id, plan_id, entitlements, computed_at, version)
  VALUES (p_tenant_id, _plan_id, _result, now(), 1)
  ON CONFLICT (tenant_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    entitlements = EXCLUDED.entitlements,
    computed_at = EXCLUDED.computed_at,
    version = tenant_entitlements_cache.version + 1;
END;
$$;

-- ─── 6. Helper functions ───

CREATE OR REPLACE FUNCTION public.can_use_feature(p_tenant_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ent JSONB; _feature JSONB;
BEGIN
  SELECT entitlements INTO _ent FROM tenant_entitlements_cache WHERE tenant_id = p_tenant_id;
  IF _ent IS NULL THEN
    PERFORM rebuild_tenant_entitlements_cache(p_tenant_id);
    SELECT entitlements INTO _ent FROM tenant_entitlements_cache WHERE tenant_id = p_tenant_id;
  END IF;
  _feature := _ent -> p_feature_key;
  RETURN COALESCE((_feature ->> 'allowed')::boolean, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_create_invoice(p_tenant_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ent JSONB; _limit INT; _count INT;
BEGIN
  SELECT entitlements INTO _ent FROM tenant_entitlements_cache WHERE tenant_id = p_tenant_id;
  _limit := (_ent -> 'invoices_basic' ->> 'limit')::int;
  IF _limit IS NULL THEN RETURN true; END IF;
  SELECT count(*) INTO _count FROM invoices WHERE tenant_id = p_tenant_id AND created_at >= date_trunc('month', now());
  RETURN _count < _limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_add_user(p_tenant_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ent JSONB; _limit INT; _count INT;
BEGIN
  SELECT entitlements INTO _ent FROM tenant_entitlements_cache WHERE tenant_id = p_tenant_id;
  _limit := (_ent -> 'max_users' ->> 'limit')::int;
  IF _limit IS NULL THEN RETURN true; END IF;
  SELECT count(*) INTO _count FROM tenant_members WHERE tenant_id = p_tenant_id;
  RETURN _count < _limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_use_ai(p_tenant_id UUID, p_required_level INT DEFAULT 1)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ent JSONB; _level INT;
BEGIN
  SELECT entitlements INTO _ent FROM tenant_entitlements_cache WHERE tenant_id = p_tenant_id;
  _level := COALESCE((_ent -> 'ai_accounting' ->> 'limit')::int, 0);
  RETURN _level >= p_required_level;
END;
$$;

-- ─── 7. Rebuild all tenant caches ───
DO $$
DECLARE _tid UUID;
BEGIN
  FOR _tid IN SELECT DISTINCT tenant_id FROM subscriptions WHERE deleted_at IS NULL LOOP
    PERFORM rebuild_tenant_entitlements_cache(_tid);
  END LOOP;
END $$;
