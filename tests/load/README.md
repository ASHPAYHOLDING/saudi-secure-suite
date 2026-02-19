# Numaxio SaaS — Load Test Guide

## المتطلبات

1. تثبيت [k6](https://k6.io/docs/getting-started/installation/)
2. Seed بيانات الاختبار (50 tenant × 4 users)

## تهيئة بيانات الاختبار

قبل التشغيل، أنشئ المستخدمين عبر Supabase SQL:

```sql
-- يمكنك استخدام هذا كقالب لإنشاء المستخدمين
-- أو استخدم سكريبت seed خارجي
DO $$
DECLARE
  t INT; u INT;
  user_id UUID;
  tenant_id UUID;
BEGIN
  FOR t IN 1..50 LOOP
    -- Create tenant
    INSERT INTO tenants (name, type) 
    VALUES ('LoadTest Tenant ' || t, 'company')
    RETURNING id INTO tenant_id;

    -- Create wallet
    INSERT INTO tenant_wallets (tenant_id, balance_available, currency)
    VALUES (tenant_id, 50000, 'SAR');

    -- Create customer
    INSERT INTO customers (tenant_id, name, customer_type)
    VALUES (tenant_id, 'عميل اختبار ' || t, 'company');

    FOR u IN 1..4 LOOP
      -- Create auth user via Supabase Auth API
      -- Then link: INSERT INTO tenant_members ...
      NULL; -- Replace with actual user creation
    END LOOP;
  END LOOP;
END $$;
```

## التشغيل

```bash
# تشغيل أساسي
k6 run \
  --env BASE_URL=https://izuyfgzwzszanjpenbmx.supabase.co \
  --env ANON_KEY=<your_anon_key> \
  --env SERVICE_KEY=<your_service_key> \
  tests/load/load-test.js

# مع تصدير النتائج
k6 run \
  --env BASE_URL=... \
  --env ANON_KEY=... \
  --out json=results.json \
  tests/load/load-test.js
```

## قراءة النتائج

التقرير يظهر تلقائياً في الـ terminal ويتضمن:

| المقياس | الحد المقبول |
|---------|-------------|
| معدل الأخطاء | < 5% |
| إنشاء فاتورة p95 | < 3 ثوانٍ |
| إضافة مصروف p95 | < 2 ثانية |
| محفظة p95 | < 2 ثانية |
| ترقية اشتراك p95 | < 5 ثوانٍ |
| إرسال بريد p95 | < 4 ثوانٍ |
| Deadlocks | < 5 |
| Race Conditions | < 10 |

## توصيات تحسين بناءً على النتائج

### إذا كان Latency عالي:
- أضف indexes على الأعمدة المستخدمة في WHERE
- فعّل connection pooling (PgBouncer)
- راجع RLS policies المعقدة

### إذا ظهرت Deadlocks:
- راجع ترتيب الـ locks في wallet transactions
- استخدم `SELECT ... FOR UPDATE SKIP LOCKED`
- قلل مدة الـ transactions

### إذا ظهرت Race Conditions (409):
- تأكد من Optimistic Locking على الـ wallets
- استخدم Idempotency Keys
- فعّل `SERIALIZABLE` isolation للعمليات المالية
