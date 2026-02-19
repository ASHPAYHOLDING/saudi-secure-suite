-- ============================================================
--  Numaxio Load Test — Seed Data (50 tenants × 4 users each)
-- ============================================================
--  Run via Lovable Cloud > Run SQL (Test environment)
--  
--  IMPORTANT: Users must be created via Auth API (see seed-users.sh)
--  This script creates: tenants, wallets, customers, subscriptions
-- ============================================================

DO $$
DECLARE
  t INT;
  tid UUID;
  plan_starter UUID;
BEGIN
  -- Get starter plan ID
  SELECT id INTO plan_starter FROM subscription_plans WHERE slug = 'starter' LIMIT 1;

  FOR t IN 1..50 LOOP
    -- 1. Create tenant
    INSERT INTO tenants (name, name_en, type, is_active)
    VALUES (
      'منشأة اختبار حمل ' || t,
      'LoadTest Tenant ' || t,
      'company',
      true
    ) RETURNING id INTO tid;

    -- 2. Create wallet with 50,000 SAR balance
    INSERT INTO tenant_wallets (tenant_id, balance_available, balance_pending, currency)
    VALUES (tid, 50000, 0, 'SAR')
    ON CONFLICT (tenant_id) DO NOTHING;

    -- 3. Create 2 test customers per tenant
    INSERT INTO customers (tenant_id, name, name_en, customer_type, email, is_active)
    VALUES
      (tid, 'عميل اختبار أ - ' || t, 'Test Customer A-' || t, 'company', 'cust-a-' || t || '@loadtest.local', true),
      (tid, 'عميل اختبار ب - ' || t, 'Test Customer B-' || t, 'individual', 'cust-b-' || t || '@loadtest.local', true);

    -- 4. Create starter subscription
    IF plan_starter IS NOT NULL THEN
      INSERT INTO subscriptions (tenant_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
      VALUES (tid, plan_starter, 'active', 'monthly', now(), now() + interval '30 days')
      ON CONFLICT DO NOTHING;
    END IF;

    RAISE NOTICE 'Created tenant % (id: %)', t, tid;
  END LOOP;
END $$;
