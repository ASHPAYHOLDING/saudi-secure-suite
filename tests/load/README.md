# Numaxio SaaS — Load Test Suite

## نظرة عامة

اختبار حمل واقعي لـ 200 مستخدم متزامن عبر 50 منشأة، يستهدف Edge Functions و DB مباشرة.

### العمليات المختبرة

| العملية | النسبة | الهدف |
|---------|--------|-------|
| إنشاء فاتورة | 30% | DB + RLS + triggers |
| إضافة مصروف | 25% | DB + RLS |
| رصيد المحفظة | 15% | Edge Function + DB |
| ترقية اشتراك | 15% | Edge Function + wallet debit + concurrency |
| إرسال بريد | 15% | Edge Function + email queue |

---

## 1. المتطلبات

```bash
# تثبيت k6
brew install grafana/k6/k6    # macOS
# أو: https://k6.io/docs/getting-started/installation/

# تثبيت jq (للـ seed script)
brew install jq
```

## 2. تهيئة بيانات الاختبار

```bash
# الخطوة 1: أنشئ الـ tenants و wallets و customers
# شغّل محتويات seed-data.sql في Lovable Cloud > Run SQL

# الخطوة 2: أنشئ المستخدمين
export SUPABASE_URL="https://izuyfgzwzszanjpenbmx.supabase.co"
export SERVICE_ROLE_KEY="<your-service-role-key>"
bash tests/load/seed-users.sh
```

## 3. التشغيل

```bash
# تشغيل أساسي
k6 run \
  --env BASE_URL=https://izuyfgzwzszanjpenbmx.supabase.co \
  --env ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... \
  --env SERVICE_KEY=<service-role-key> \
  tests/load/load-test.js

# مع تصدير JSON
k6 run \
  --env BASE_URL=... \
  --env ANON_KEY=... \
  --out json=results.json \
  tests/load/load-test.js
```

## 4. مراحل التحميل

```
VUs
200 ┤          ┌────────────────────┐
    │         ╱                    ╲
 50 ┤   ┌────╱                      ╲────┐
    │  ╱                                  ╲
  0 ┤─╱                                    ╲─
    └──┬──────┬──────────┬──────────┬───────┬──
      0s    30s        1m30s      4m30s   5m15s
       warm   ramp       sustained   cool  stop
```

## 5. Acceptance Criteria (معايير الإطلاق)

| المقياس | الحد المقبول | مستوى الخطورة |
|---------|-------------|---------------|
| Error Rate | < 5% | 🔴 Critical |
| Invoice p95 | < 3,000ms | 🟡 High |
| Expense p95 | < 2,000ms | 🟡 High |
| Wallet p95 | < 2,000ms | 🔴 Critical |
| Subscription p95 | < 5,000ms | 🟡 High |
| Email p95 | < 4,000ms | 🟢 Medium |
| Deadlocks | < 5 | 🔴 Critical |
| Race Conditions | < 10 | 🔴 Critical |

### قواعد الإطلاق:
- ✅ **GO**: كل المقاييس ضمن الحدود
- ⚠️ **CONDITIONAL**: مقياس Medium واحد تجاوز → يُطلق مع monitoring
- ❌ **NO-GO**: أي مقياس Critical تجاوز → يُصلح أولاً

## 6. شكل التقرير النهائي

التقرير يظهر تلقائياً بالعربية في الـ terminal:

```
╔══════════════════════════════════════════════════════════════╗
║             تقرير اختبار الحمل — Numaxio SaaS              ║
╠══════════════════════════════════════════════════════════════╣

📊 إحصائيات عامة:
  ├─ إجمالي الطلبات:     4,521
  ├─ معدل الأخطاء:       1.23%
  ├─ HTTP 409 (تضارب):   3
  ├─ HTTP 429 (حد):      12
  ├─ Deadlocks:          0
  └─ Race Conditions:    3

⏱️ Latency (ms):
  ┌──────────────────────┬──────────┬──────────┬──────────┐
  │ العملية               │  p50     │  p95     │  p99     │
  ├──────────────────────┼──────────┼──────────┼──────────┤
  │ إنشاء فاتورة         │   245ms  │  1200ms  │  2100ms  │
  │ إضافة مصروف          │   180ms  │   800ms  │  1500ms  │
  │ محفظة                │   320ms  │  1100ms  │  1800ms  │
  │ ترقية اشتراك         │   890ms  │  3200ms  │  4500ms  │
  │ إرسال بريد           │   450ms  │  2100ms  │  3200ms  │
  └──────────────────────┴──────────┴──────────┴──────────┘

🎯 الحدود: ✅ PASS / ❌ FAIL لكل معيار
╚══════════════════════════════════════════════════════════════╝
```

ويُصدّر أيضاً `load-test-report.json` للتحليل التفصيلي.

## 7. كشف Deadlocks/Race Conditions من DB Logs

بعد التشغيل، افحص سجلات قاعدة البيانات:

```sql
-- كشف Deadlocks
SELECT timestamp, event_message 
FROM postgres_logs
WHERE event_message ILIKE '%deadlock%'
ORDER BY timestamp DESC LIMIT 20;

-- كشف Serialization Failures
SELECT timestamp, event_message
FROM postgres_logs
WHERE event_message ILIKE '%could not serialize%'
ORDER BY timestamp DESC LIMIT 20;

-- أبطأ الاستعلامات
SELECT timestamp, event_message
FROM postgres_logs
WHERE event_message ILIKE '%duration:%'
ORDER BY timestamp DESC LIMIT 50;
```

## 8. توصيات التحسين

### Indexes الموصى بها:
```sql
-- فواتير: بحث بالتاريخ والحالة
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_tenant_status 
ON invoices(tenant_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_tenant_date 
ON invoices(tenant_id, invoice_date DESC);

-- مصروفات
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_tenant_date 
ON expenses(tenant_id, expense_date DESC);

-- محفظة: قفل سريع
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_tenant 
ON tenant_wallets(tenant_id);
```

### Connection Pooling:
- PgBouncer مُفعّل تلقائياً على Lovable Cloud (port 6543)
- الحد الافتراضي: 60 connection per tenant
- إذا ظهرت أخطاء `too many connections`، استخدم pooling mode: `transaction`

### Query Optimizations:
- تأكد أن RLS policies تستخدم indexed columns
- تجنّب `SELECT *` في الـ policies — استخدم `EXISTS` subquery
- استخدم `FOR UPDATE SKIP LOCKED` في عمليات المحفظة
