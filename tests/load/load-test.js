/**
 * ============================================================
 *  Numaxio SaaS — k6 Load Test Script
 * ============================================================
 *
 *  Scenario: 200 VUs, 50 tenants, realistic SaaS operations
 *
 *  Run:
 *    k6 run --env BASE_URL=https://izuyfgzwzszanjpenbmx.supabase.co \
 *            --env ANON_KEY=<your_anon_key> \
 *            --env SERVICE_KEY=<your_service_key> \
 *            load-test.js
 *
 *  Prerequisites:
 *    - Seed 50 tenants with owners (see seedData() below)
 *    - Each tenant needs a wallet with balance >= 5000
 *    - At least 2 subscription plans (starter, professional)
 *    - At least 1 customer per tenant
 * ============================================================
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { SharedArray } from "k6/data";
import { randomIntBetween, randomItem } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

// ─── Custom Metrics ───
const errorRate = new Rate("errors");
const invoiceLatency = new Trend("invoice_create_latency", true);
const expenseLatency = new Trend("expense_create_latency", true);
const walletLatency = new Trend("wallet_debit_latency", true);
const subscriptionLatency = new Trend("subscription_upgrade_latency", true);
const emailLatency = new Trend("email_send_latency", true);
const deadlockErrors = new Counter("deadlock_errors");
const raceConditionErrors = new Counter("race_condition_errors");
const http409s = new Counter("http_409_conflicts");
const http429s = new Counter("http_429_rate_limited");

// ─── Config ───
const BASE_URL = __ENV.BASE_URL;
const ANON_KEY = __ENV.ANON_KEY;
const SERVICE_KEY = __ENV.SERVICE_KEY;
const FUNCTIONS_URL = `${BASE_URL}/functions/v1`;

// ─── Test Users (seed before running) ───
// Format: { email, password, tenant_id }
// Generate 50 tenants × 4 users = 200 users
const TEST_USERS = new SharedArray("users", function () {
  const users = [];
  for (let t = 1; t <= 50; t++) {
    for (let u = 1; u <= 4; u++) {
      users.push({
        email: `loadtest-t${t}-u${u}@numaxio.test`,
        password: "LoadTest2026!Secure",
        tenant_index: t,
      });
    }
  }
  return users;
});

// ─── Stages ───
export const options = {
  scenarios: {
    ramp_up: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 },   // Warm-up
        { duration: "1m", target: 200 },   // Ramp to full load
        { duration: "3m", target: 200 },   // Sustained load
        { duration: "30s", target: 50 },   // Cool-down
        { duration: "15s", target: 0 },    // Shutdown
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    errors: ["rate<0.05"],                           // <5% error rate
    invoice_create_latency: ["p(95)<3000"],          // p95 < 3s
    expense_create_latency: ["p(95)<2000"],          // p95 < 2s
    wallet_debit_latency: ["p(95)<2000"],            // p95 < 2s
    subscription_upgrade_latency: ["p(95)<5000"],    // p95 < 5s
    email_send_latency: ["p(95)<4000"],              // p95 < 4s
    http_requests: ["p(95)<3000"],                   // Overall p95
    deadlock_errors: ["count<5"],                    // Near-zero deadlocks
    race_condition_errors: ["count<10"],             // Minimal race conditions
  },
};

// ─── Helpers ───
function headers(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    apikey: ANON_KEY,
  };
}

function anonHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
  };
}

function checkResponse(res, name) {
  const ok = check(res, {
    [`${name} status 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
  errorRate.add(!ok);

  if (res.status === 409) {
    http409s.add(1);
    raceConditionErrors.add(1);
  }
  if (res.status === 429) {
    http429s.add(1);
  }

  // Detect deadlocks from error messages
  try {
    const body = JSON.parse(res.body);
    if (
      body?.error &&
      (body.error.includes("deadlock") || body.error.includes("could not serialize"))
    ) {
      deadlockErrors.add(1);
    }
  } catch (_) {}

  return ok;
}

// ─── Auth ───
function login(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    { headers: anonHeaders(), tags: { name: "auth_login" } }
  );

  if (res.status !== 200) {
    console.error(`Login failed for ${email}: ${res.status}`);
    return null;
  }

  const data = JSON.parse(res.body);
  return data.access_token;
}

// ─── Get tenant context ───
function getTenantContext(token) {
  const res = http.get(
    `${BASE_URL}/rest/v1/tenant_members?select=tenant_id,role&limit=1`,
    { headers: headers(token), tags: { name: "get_tenant" } }
  );

  if (res.status !== 200) return null;
  const data = JSON.parse(res.body);
  return data[0] || null;
}

function getCustomer(token, tenantId) {
  const res = http.get(
    `${BASE_URL}/rest/v1/customers?tenant_id=eq.${tenantId}&limit=1&select=id,name`,
    { headers: headers(token), tags: { name: "get_customer" } }
  );

  if (res.status !== 200) return null;
  const data = JSON.parse(res.body);
  return data[0] || null;
}

// ═══════════════════════════════════════════
//  SCENARIO OPERATIONS
// ═══════════════════════════════════════════

function createInvoice(token, tenantId, customerId) {
  group("Create Invoice", function () {
    const invoiceNumber = `LT-INV-${Date.now()}-${randomIntBetween(1000, 9999)}`;
    const payload = {
      tenant_id: tenantId,
      customer_id: customerId,
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      subtotal: randomIntBetween(500, 50000),
      vat_total: 0,
      grand_total: 0,
      status: "draft",
      currency: "SAR",
      created_by: "",  // Will be set by RLS
    };

    payload.vat_total = Math.round(payload.subtotal * 0.15 * 100) / 100;
    payload.grand_total = payload.subtotal + payload.vat_total;

    const res = http.post(
      `${BASE_URL}/rest/v1/invoices`,
      JSON.stringify(payload),
      {
        headers: { ...headers(token), Prefer: "return=representation" },
        tags: { name: "create_invoice" },
      }
    );

    invoiceLatency.add(res.timings.duration);
    checkResponse(res, "create_invoice");
  });
}

function createExpense(token, tenantId) {
  group("Create Expense", function () {
    const payload = {
      tenant_id: tenantId,
      expense_number: `LT-EXP-${Date.now()}-${randomIntBetween(1000, 9999)}`,
      description: "مصروف اختبار حمل",
      amount: randomIntBetween(100, 10000),
      vat_amount: 0,
      total_amount: 0,
      expense_date: new Date().toISOString().split("T")[0],
      category: randomItem(["office", "travel", "utilities", "marketing"]),
      status: "draft",
      currency: "SAR",
    };

    payload.vat_amount = Math.round(payload.amount * 0.15 * 100) / 100;
    payload.total_amount = payload.amount + payload.vat_amount;

    const res = http.post(
      `${BASE_URL}/rest/v1/expenses`,
      JSON.stringify(payload),
      {
        headers: { ...headers(token), Prefer: "return=minimal" },
        tags: { name: "create_expense" },
      }
    );

    expenseLatency.add(res.timings.duration);
    checkResponse(res, "create_expense");
  });
}

function walletGetBalance(token) {
  group("Wallet Balance", function () {
    const res = http.post(
      `${FUNCTIONS_URL}/wallet-purchase?action=get-balance`,
      "{}",
      {
        headers: headers(token),
        tags: { name: "wallet_balance" },
      }
    );

    walletLatency.add(res.timings.duration);
    checkResponse(res, "wallet_balance");
  });
}

function upgradeSubscription(token) {
  group("Upgrade Subscription", function () {
    // This will likely fail (already on plan / insufficient balance)
    // but we're testing latency and race conditions
    const res = http.post(
      `${FUNCTIONS_URL}/upgrade-subscription`,
      JSON.stringify({
        plan_id: "00000000-0000-0000-0000-000000000002", // placeholder
        billing_cycle: "monthly",
        idempotency_key: `lt-${Date.now()}-${randomIntBetween(1, 999999)}`,
      }),
      {
        headers: headers(token),
        tags: { name: "upgrade_subscription" },
      }
    );

    subscriptionLatency.add(res.timings.duration);
    // Don't count 400s as errors (expected for same-plan / insufficient)
    if (res.status !== 400) {
      checkResponse(res, "upgrade_subscription");
    }
  });
}

function sendInvoiceEmail(token, tenantId) {
  group("Send Invoice Email", function () {
    // Get a random invoice
    const listRes = http.get(
      `${BASE_URL}/rest/v1/invoices?tenant_id=eq.${tenantId}&limit=1&select=id`,
      { headers: headers(token), tags: { name: "list_invoices" } }
    );

    if (listRes.status !== 200) return;
    const invoices = JSON.parse(listRes.body);
    if (!invoices.length) return;

    const res = http.post(
      `${FUNCTIONS_URL}/send-invoice`,
      JSON.stringify({
        invoiceId: invoices[0].id,
        channel: "email",
        recipient: "loadtest-sink@numaxio.test",
        tenantId: tenantId,
      }),
      {
        headers: headers(token),
        tags: { name: "send_invoice_email" },
      }
    );

    emailLatency.add(res.timings.duration);
    checkResponse(res, "send_invoice_email");
  });
}

// ═══════════════════════════════════════════
//  MAIN VU LOOP
// ═══════════════════════════════════════════

export default function () {
  const userIndex = __VU % TEST_USERS.length;
  const user = TEST_USERS[userIndex];

  // 1. Login
  const token = login(user.email, user.password);
  if (!token) {
    errorRate.add(1);
    sleep(2);
    return;
  }

  // 2. Get tenant context
  const ctx = getTenantContext(token);
  if (!ctx) {
    errorRate.add(1);
    sleep(1);
    return;
  }
  const tenantId = ctx.tenant_id;

  // 3. Get a customer for invoices
  const customer = getCustomer(token, tenantId);

  // 4. Execute weighted random operations
  const roll = Math.random();

  if (roll < 0.30 && customer) {
    // 30% - Create invoice
    createInvoice(token, tenantId, customer.id);
  } else if (roll < 0.55) {
    // 25% - Create expense
    createExpense(token, tenantId);
  } else if (roll < 0.70) {
    // 15% - Wallet balance check
    walletGetBalance(token);
  } else if (roll < 0.85) {
    // 15% - Subscription upgrade attempt
    upgradeSubscription(token);
  } else {
    // 15% - Send invoice email
    sendInvoiceEmail(token, tenantId);
  }

  // Think time: 1-3 seconds between operations
  sleep(randomIntBetween(1, 3));
}

// ═══════════════════════════════════════════
//  SUMMARY HANDLER (Arabic report)
// ═══════════════════════════════════════════

export function handleSummary(data) {
  const metrics = data.metrics;

  const report = `
╔══════════════════════════════════════════════════════════════╗
║             تقرير اختبار الحمل — Numaxio SaaS              ║
╠══════════════════════════════════════════════════════════════╣

📊 إحصائيات عامة:
  ├─ إجمالي الطلبات:     ${metrics.http_reqs?.values?.count || 0}
  ├─ معدل الأخطاء:       ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%
  ├─ HTTP 409 (تضارب):   ${metrics.http_409_conflicts?.values?.count || 0}
  ├─ HTTP 429 (حد):      ${metrics.http_429_rate_limited?.values?.count || 0}
  ├─ Deadlocks:          ${metrics.deadlock_errors?.values?.count || 0}
  └─ Race Conditions:    ${metrics.race_condition_errors?.values?.count || 0}

⏱️ Latency (ms):
  ┌──────────────────────┬──────────┬──────────┬──────────┐
  │ العملية               │  p50     │  p95     │  p99     │
  ├──────────────────────┼──────────┼──────────┼──────────┤
  │ إنشاء فاتورة         │ ${fmt(metrics.invoice_create_latency, "p(50)")} │ ${fmt(metrics.invoice_create_latency, "p(95)")} │ ${fmt(metrics.invoice_create_latency, "p(99)")} │
  │ إضافة مصروف          │ ${fmt(metrics.expense_create_latency, "p(50)")} │ ${fmt(metrics.expense_create_latency, "p(95)")} │ ${fmt(metrics.expense_create_latency, "p(99)")} │
  │ محفظة                │ ${fmt(metrics.wallet_debit_latency, "p(50)")} │ ${fmt(metrics.wallet_debit_latency, "p(95)")} │ ${fmt(metrics.wallet_debit_latency, "p(99)")} │
  │ ترقية اشتراك         │ ${fmt(metrics.subscription_upgrade_latency, "p(50)")} │ ${fmt(metrics.subscription_upgrade_latency, "p(95)")} │ ${fmt(metrics.subscription_upgrade_latency, "p(99)")} │
  │ إرسال بريد           │ ${fmt(metrics.email_send_latency, "p(50)")} │ ${fmt(metrics.email_send_latency, "p(95)")} │ ${fmt(metrics.email_send_latency, "p(99)")} │
  └──────────────────────┴──────────┴──────────┴──────────┘

🎯 الحدود (Thresholds):
  ├─ أخطاء < 5%:              ${metrics.errors?.thresholds?.["rate<0.05"]?.ok ? "✅" : "❌"}
  ├─ فاتورة p95 < 3s:         ${metrics.invoice_create_latency?.thresholds?.["p(95)<3000"]?.ok ? "✅" : "❌"}
  ├─ مصروف p95 < 2s:          ${metrics.expense_create_latency?.thresholds?.["p(95)<2000"]?.ok ? "✅" : "❌"}
  ├─ محفظة p95 < 2s:           ${metrics.wallet_debit_latency?.thresholds?.["p(95)<2000"]?.ok ? "✅" : "❌"}
  ├─ اشتراك p95 < 5s:         ${metrics.subscription_upgrade_latency?.thresholds?.["p(95)<5000"]?.ok ? "✅" : "❌"}
  ├─ بريد p95 < 4s:            ${metrics.email_send_latency?.thresholds?.["p(95)<4000"]?.ok ? "✅" : "❌"}
  ├─ Deadlocks < 5:            ${metrics.deadlock_errors?.thresholds?.["count<5"]?.ok ? "✅" : "❌"}
  └─ Race Conditions < 10:    ${metrics.race_condition_errors?.thresholds?.["count<10"]?.ok ? "✅" : "❌"}

╚══════════════════════════════════════════════════════════════╝
`;

  return {
    stdout: report,
    "load-test-report.json": JSON.stringify(data, null, 2),
  };
}

function fmt(metric, percentile) {
  if (!metric?.values?.[percentile]) return "  N/A   ";
  return String(Math.round(metric.values[percentile])).padStart(6) + "ms";
}
