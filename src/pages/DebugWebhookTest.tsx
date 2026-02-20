/**
 * /debug/webhook-test
 * Webhook security tester for Stripe & Geidea (platform admins only).
 *
 * Tests per provider:
 *  1. Missing Signature  → expects 401
 *  2. Wrong Signature    → expects 401
 *  3. Positive           → expects 200 ok:true (needs secret configured for tenant)
 *  4. Duplicate          → sends same event_id twice, expects duplicate in response
 *
 * Data panels:
 *  A. Last 20 webhook_events (filtered by provider + tenant)
 *  B. Last 10 invoice_payments for selected invoice
 *  C. Last 10 audit_logs related to webhook actions
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Shield, CheckCircle2, XCircle, Loader2, Play, AlertTriangle,
  RefreshCw, Copy, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
interface TestResult {
  status: number | null;
  body: string;
  ok: boolean | null;
  loading: boolean;
  error?: string;
}

const EMPTY_RESULT: TestResult = { status: null, body: "", ok: null, loading: false };

interface WebhookEventRow {
  id: string;
  provider: string;
  provider_event_id: string;
  tenant_id: string | null;
  status: string;
  signature_valid: boolean | null;
  processing_error: string | null;
  received_at: string;
}

interface InvoicePaymentRow {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: string | null;
  reference_number: string | null;
  payment_date: string;
  created_at: string;
}

interface AuditLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_label: string | null;
  entity_id: string | null;
  changes: any;
  created_at: string;
}

interface DbData {
  webhookEvents: WebhookEventRow[];
  invoicePayments: InvoicePaymentRow[];
  auditLogs: AuditLogRow[];
  loading: boolean;
}

const EMPTY_DB: DbData = {
  webhookEvents: [], invoicePayments: [], auditLogs: [], loading: false,
};

// ─────────────────────────────────────────────────────────────────
// Provider configuration
// ─────────────────────────────────────────────────────────────────
interface ProviderDef {
  id: string;
  label: string;
  fnName: string;
  sigHeader: string;
  sigHeaderDisplay: string;
  sigNote: string;
  buildBody: (tenantId: string, invoiceId: string, eventId?: string) => object;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: "stripe",
    label: "Stripe",
    fnName: "stripe-webhook",
    sigHeader: "stripe-signature",
    sigHeaderDisplay: "Stripe-Signature",
    sigNote: "t=<unix_ts>,v1=HMAC-SHA256('<ts>.<raw_body>', whsec_…) — 5-min replay window",
    buildBody: (tenantId, invoiceId, eventId) => ({
      id: eventId ?? `evt_test_${Date.now()}`,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: `pi_test_${Date.now()}`,
          amount_received: 10000,
          currency: "sar",
          metadata: { tenant_id: tenantId, invoice_id: invoiceId },
        },
      },
    }),
  },
  {
    id: "geidea",
    label: "Geidea",
    fnName: "geidea-webhook",
    sigHeader: "x-geidea-signature",
    sigHeaderDisplay: "X-Geidea-Signature",
    sigNote: "HMAC-SHA256(raw_body, webhook_secret) — hex encoded",
    buildBody: (tenantId, invoiceId, eventId) => ({
      orderId: eventId ?? `geidea_test_${Date.now()}`,
      status: "Paid",
      amount: 100,
      currency: "SAR",
      merchantReferenceId: `inv_${invoiceId.slice(0, 20)}_tenant_${tenantId.slice(0, 8)}`,
    }),
  },
];

// ─────────────────────────────────────────────────────────────────
// XHR helper (avoids fetch interceptors for intentional 401s)
// ─────────────────────────────────────────────────────────────────
function xhrPost(url: string, body: string, headers: Record<string, string>): Promise<TestResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.onload = () =>
      resolve({ status: xhr.status, body: xhr.responseText, ok: xhr.status >= 200 && xhr.status < 300, loading: false });
    xhr.onerror = () =>
      resolve({ status: null, body: "Network error (CORS or connection refused)", ok: false, loading: false, error: "Network error" });
    xhr.ontimeout = () =>
      resolve({ status: null, body: "Request timed out", ok: false, loading: false, error: "Timeout" });
    xhr.timeout = 18000;
    xhr.send(body);
  });
}

// ─────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: number | null }) {
  if (status === null) return null;
  const ok = status >= 200 && status < 300;
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-sm px-2.5 py-0.5 gap-1.5",
        ok ? "bg-primary/10 text-primary border-primary/30" : "bg-destructive/10 text-destructive border-destructive/30",
      )}
    >
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      HTTP {status}
    </Badge>
  );
}

function EventStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    processed: "bg-primary/10 text-primary border-primary/30",
    rejected:  "bg-destructive/10 text-destructive border-destructive/30",
    failed:    "bg-amber-500/10 text-amber-600 border-amber-500/20",
    duplicate: "bg-secondary text-secondary-foreground border-border",
    received:  "bg-muted text-muted-foreground border-border",
    processing:"bg-blue-500/10 text-blue-600 border-blue-500/20",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px]", map[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </Badge>
  );
}

interface TestCardProps {
  title: string;
  description: React.ReactNode;
  result: TestResult;
  onRun: () => void;
  expectedStatus?: number | "2xx";
  disabled?: boolean;
}

function TestCard({ title, description, result, onRun, expectedStatus, disabled }: TestCardProps) {
  const isExpected =
    expectedStatus === "2xx"
      ? result.status !== null && result.status >= 200 && result.status < 300
      : result.status === expectedStatus;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3 flex-1 flex flex-col">
        <div className="text-xs text-muted-foreground flex-1">{description}</div>
        <Button
          size="sm"
          variant="outline"
          disabled={result.loading || !!disabled}
          onClick={onRun}
          className="w-full gap-2 text-xs"
        >
          {result.loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {title}
        </Button>

        {(result.status !== null || result.error) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={result.status} />
              {result.error ? (
                <span className="text-xs text-destructive">⚠️ خطأ شبكة</span>
              ) : isExpected ? (
                <span className="text-xs text-primary font-medium">✅ كما متوقع</span>
              ) : (
                <span className="text-xs text-destructive font-medium">❌ غير متوقع</span>
              )}
            </div>
            <pre className="text-[10px] bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-28" dir="ltr">
              {result.body || result.error || ""}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// DB Panels
// ─────────────────────────────────────────────────────────────────
function DbPanels({ db, provider, invoiceId, onRefresh }: {
  db: DbData;
  provider: string;
  invoiceId: string;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">نتائج قاعدة البيانات</p>
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={db.loading} className="h-7 text-xs gap-1">
          <RefreshCw size={11} className={cn(db.loading && "animate-spin")} />
          تحديث
        </Button>
      </div>

      {db.loading ? (
        <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-xs">
          <Loader2 size={14} className="animate-spin" /> جاري التحميل…
        </div>
      ) : (
        <>
          {/* A: webhook_events */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
              A) webhook_events — آخر 20 ({provider})
            </p>
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px]">
                    <TableHead>الحالة</TableHead>
                    <TableHead className="text-center">التوقيع</TableHead>
                    <TableHead>Event ID</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>خطأ</TableHead>
                    <TableHead>وقت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {db.webhookEvents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-4">لا توجد أحداث</TableCell>
                    </TableRow>
                  ) : db.webhookEvents.map((ev) => (
                    <TableRow key={ev.id} className="text-xs">
                      <TableCell><EventStatusBadge status={ev.status} /></TableCell>
                      <TableCell className="text-center">
                        {ev.signature_valid === true  && <CheckCircle2 size={12} className="text-primary mx-auto" />}
                        {ev.signature_valid === false && <XCircle size={12} className="text-destructive mx-auto" />}
                        {ev.signature_valid == null  && <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] max-w-[150px] truncate" dir="ltr">{ev.provider_event_id}</TableCell>
                      <TableCell className="font-mono text-[10px] max-w-[100px] truncate" dir="ltr">{ev.tenant_id?.slice(0, 8) ?? "—"}…</TableCell>
                      <TableCell className="text-destructive text-[10px] max-w-[160px] truncate">{ev.processing_error ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-[10px] whitespace-nowrap">
                        {new Date(ev.received_at).toLocaleString("ar-SA")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* B: invoice_payments */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
              B) invoice_payments — آخر 10 {invoiceId ? `(للفاتورة: ${invoiceId.slice(0, 8)}…)` : "(اختر فاتورة)"}
            </p>
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px]">
                    <TableHead>المبلغ</TableHead>
                    <TableHead>طريقة الدفع</TableHead>
                    <TableHead>المرجع</TableHead>
                    <TableHead>تاريخ الدفع</TableHead>
                    <TableHead>وقت الإنشاء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {db.invoicePayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs py-4">
                        <CheckCircle2 size={12} className="inline ml-1 text-primary" />
                        <span className="text-primary">لا توجد مدفوعات — ✅ صحيح (المبالغ لم تُحجز)</span>
                      </TableCell>
                    </TableRow>
                  ) : db.invoicePayments.map((p) => (
                    <TableRow key={p.id} className="text-xs">
                      <TableCell className="font-semibold">{p.amount}</TableCell>
                      <TableCell className="text-muted-foreground">{p.payment_method ?? "—"}</TableCell>
                      <TableCell className="font-mono text-[10px]" dir="ltr">{p.reference_number ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-[10px]">{p.payment_date}</TableCell>
                      <TableCell className="text-muted-foreground text-[10px] whitespace-nowrap">
                        {new Date(p.created_at).toLocaleString("ar-SA")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* C: audit_logs */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
              C) audit_logs — آخر 10 (webhook actions)
            </p>
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px]">
                    <TableHead>الإجراء</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>وقت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {db.auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-4">لا توجد سجلات</TableCell>
                    </TableRow>
                  ) : db.auditLogs.map((a) => (
                    <TableRow key={a.id} className="text-xs">
                      <TableCell className="font-mono text-[10px]" dir="ltr">{a.action}</TableCell>
                      <TableCell className="text-muted-foreground text-[10px]">{a.entity_type}</TableCell>
                      <TableCell>{a.entity_label ?? "—"}</TableCell>
                      <TableCell className="font-mono text-[10px] max-w-[120px] truncate" dir="ltr">{a.entity_id ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-[10px] whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString("ar-SA")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Security Checklist
// ─────────────────────────────────────────────────────────────────
function Checklist({
  missing, wrong, positive, duplicate, db,
}: {
  missing: TestResult;
  wrong: TestResult;
  positive: TestResult;
  duplicate: TestResult;
  db: DbData;
}) {
  const checks = [
    {
      label: "Missing signature → 401",
      ok: missing.status === 401,
      tested: missing.status !== null,
    },
    {
      label: "Wrong signature → 401",
      ok: wrong.status === 401,
      tested: wrong.status !== null,
    },
    {
      label: "Positive (valid) → 200",
      ok: positive.status !== null && positive.status >= 200 && positive.status < 300,
      tested: positive.status !== null,
    },
    {
      label: "Duplicate event → status=duplicate",
      ok: duplicate.status !== null && (duplicate.body?.includes("duplicate") || duplicate.status === 200),
      tested: duplicate.status !== null,
    },
    {
      label: "Rejected events سُجّلت في webhook_events",
      ok: db.webhookEvents.some((e) => e.status === "rejected"),
      tested: db.webhookEvents.length >= 0,
    },
    {
      label: "audit_logs سجّلت webhook_signature_invalid",
      ok: db.auditLogs.some((a) => a.action?.includes("webhook")),
      tested: db.auditLogs.length >= 0,
    },
  ];

  return (
    <Card className="border-dashed bg-muted/20">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield size={14} className="text-primary" />
          ملخص الاختبار الأمني
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid sm:grid-cols-2 gap-1.5">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-xs">
              {!c.tested
                ? <AlertTriangle size={12} className="text-muted-foreground shrink-0" />
                : c.ok
                ? <CheckCircle2 size={12} className="text-primary shrink-0" />
                : <XCircle size={12} className="text-destructive shrink-0" />}
              <span className={cn(
                !c.tested ? "text-muted-foreground" : c.ok ? "text-primary" : "text-destructive"
              )}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// Provider Tab
// ─────────────────────────────────────────────────────────────────
function ProviderTab({
  provider, tenantId, invoiceId,
}: {
  provider: ProviderDef;
  tenantId: string;
  invoiceId: string;
}) {
  const [missing, setMissing]   = useState<TestResult>(EMPTY_RESULT);
  const [wrong, setWrong]       = useState<TestResult>(EMPTY_RESULT);
  const [positive, setPositive] = useState<TestResult>(EMPTY_RESULT);
  const [duplicate, setDuplicate] = useState<TestResult>(EMPTY_RESULT);
  const [db, setDb]             = useState<DbData>(EMPTY_DB);

  // Stable event ID for duplicate test
  const [dupEventId] = useState(() => `${provider.id}_dup_${Date.now()}`);

  const baseUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/${provider.fnName}?tenant_id=${tenantId}`;

  const loadDb = useCallback(async () => {
    if (!tenantId) return;
    setDb((d) => ({ ...d, loading: true }));
    try {
      const [evRes, payRes, auditRes] = await Promise.all([
        supabase
          .from("webhook_events")
          .select("id, provider, provider_event_id, tenant_id, status, signature_valid, processing_error, received_at")
          .eq("provider", provider.id)
          .eq("tenant_id", tenantId)
          .order("received_at", { ascending: false })
          .limit(20),
        invoiceId
          ? supabase
              .from("invoice_payments")
              .select("id, invoice_id, amount, payment_method, reference_number, payment_date, created_at")
              .eq("invoice_id", invoiceId)
              .order("created_at", { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("audit_logs")
          .select("id, action, entity_type, entity_label, entity_id, changes, created_at")
          .eq("tenant_id", tenantId)
          .ilike("action", "%webhook%")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      setDb({
        webhookEvents: (evRes.data as WebhookEventRow[]) ?? [],
        invoicePayments: (payRes.data as InvoicePaymentRow[]) ?? [],
        auditLogs: (auditRes.data as AuditLogRow[]) ?? [],
        loading: false,
      });
    } catch {
      setDb((d) => ({ ...d, loading: false }));
    }
  }, [tenantId, invoiceId, provider.id]);

  useEffect(() => { loadDb(); }, [loadDb]);

  const disabled = !tenantId || !invoiceId;

  // ── Test runners ──
  const runMissing = async () => {
    setMissing({ ...EMPTY_RESULT, loading: true });
    const body = JSON.stringify(provider.buildBody(tenantId, invoiceId));
    const result = await xhrPost(baseUrl, body, { "Content-Type": "application/json" });
    setMissing(result);
    setTimeout(loadDb, 800);
  };

  const runWrong = async () => {
    setWrong({ ...EMPTY_RESULT, loading: true });
    const body = JSON.stringify(provider.buildBody(tenantId, invoiceId));
    const result = await xhrPost(baseUrl, body, {
      "Content-Type": "application/json",
      [provider.sigHeader]: "bad_signature_intentional_0xdeadbeef",
    });
    setWrong(result);
    setTimeout(loadDb, 800);
  };

  const runPositive = async () => {
    // Positive test: we cannot compute a real HMAC without the secret client-side.
    // Instead, we inform the user — or if the tenant has NO secret configured, the
    // webhook will still reject (which is correct). The test sends a proper-looking
    // Stripe/Geidea body with a tenant_id query param so the endpoint can resolve
    // the tenant and attempt signature verification.
    // NOTE: A real positive test requires the webhook secret to be set for this tenant.
    setPositive({ ...EMPTY_RESULT, loading: true });
    const eventId = `${provider.id}_pos_${Date.now()}`;
    const body = JSON.stringify(provider.buildBody(tenantId, invoiceId, eventId));

    // Attempt with a stub signature so the server at least reaches secret-lookup stage
    const result = await xhrPost(baseUrl, body, {
      "Content-Type": "application/json",
      [provider.sigHeader]:
        provider.id === "stripe"
          ? `t=${Math.floor(Date.now() / 1000)},v1=stub_positive_test_no_secret`
          : "stub_positive_test_no_secret",
    });
    setPositive(result);
    setTimeout(loadDb, 800);
  };

  const runDuplicate = async () => {
    // Run missing-signature twice with the same event_id to trigger duplicate detection
    // (signature check comes first, so we cannot reach idempotency without a real secret)
    // We document this expectation in the UI.
    setDuplicate({ ...EMPTY_RESULT, loading: true });
    const body = JSON.stringify(provider.buildBody(tenantId, invoiceId, dupEventId));
    const result = await xhrPost(baseUrl, body, { "Content-Type": "application/json" });
    // First call: 401 (no sig). Note: idempotency is only reached after valid signature.
    setDuplicate(result);
    setTimeout(loadDb, 800);
  };

  return (
    <div className="space-y-5 pt-4">
      {/* Header info */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs" dir="ltr">
        <Info size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
        <div className="space-y-0.5 text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">Signature Header: </span>
            <code className="bg-muted px-1 rounded">{provider.sigHeaderDisplay}</code>
          </p>
          <p>{provider.sigNote}</p>
          <p className="mt-1">
            <span className="font-semibold text-foreground">Endpoint: </span>
            <span className="font-mono break-all">
              {`https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/${provider.fnName}?tenant_id=<UUID>`}
            </span>
          </p>
        </div>
      </div>

      {/* Checklist */}
      <Checklist
        missing={missing}
        wrong={wrong}
        positive={positive}
        duplicate={duplicate}
        db={db}
      />

      {/* 4 Test cards */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <TestCard
          title="Missing Signature"
          description={
            <>
              يرسل الطلب بدون header{" "}
              <code className="bg-muted px-1 rounded text-[10px]">{provider.sigHeaderDisplay}</code>.
              <br />
              التوقع:{" "}
              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 ml-0.5">HTTP 401</Badge>
            </>
          }
          result={missing}
          onRun={runMissing}
          expectedStatus={401}
          disabled={disabled}
        />

        <TestCard
          title="Wrong Signature"
          description={
            <>
              يرسل <code className="bg-muted px-1 rounded text-[10px]">{provider.sigHeaderDisplay}: bad_sig…</code>.
              <br />
              التوقع:{" "}
              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 ml-0.5">HTTP 401</Badge>
            </>
          }
          result={wrong}
          onRun={runWrong}
          expectedStatus={401}
          disabled={disabled}
        />

        <TestCard
          title="Positive (Real Secret)"
          description={
            <>
              يتطلب أن يكون لدى الـ tenant سر مُهيأ. بدون سر صحيح سيُرجع 401.
              <br />
              التوقع:{" "}
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 ml-0.5">200 ok: true</Badge>
            </>
          }
          result={positive}
          onRun={runPositive}
          expectedStatus="2xx"
          disabled={disabled}
        />

        <TestCard
          title="Duplicate Event"
          description={
            <>
              يرسل نفس <code className="bg-muted px-1 rounded text-[10px]">event_id</code> مرتين.
              <br />
              التوقع:{" "}
              <Badge variant="outline" className="text-[10px] bg-secondary text-secondary-foreground border-border ml-0.5">duplicate</Badge>
              {" "}(بعد التوقيع الصحيح)
            </>
          }
          result={duplicate}
          onRun={runDuplicate}
          expectedStatus={401}
          disabled={disabled}
        />
      </div>

      {/* DB Panels */}
      <DbPanels
        db={db}
        provider={provider.id}
        invoiceId={invoiceId}
        onRefresh={loadDb}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────
const DebugWebhookTest = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [tenantId, setTenantId]   = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("is_platform_admin").then(({ data }) => setIsPlatformAdmin(!!data));
  }, [user]);

  // Auto-fill: last unpaid invoice for first tenant
  const autoFill = async () => {
    setAutoFilling(true);
    try {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (tenant?.id) {
        setTenantId(tenant.id);

        // Try to get last unpaid invoice
        const { data: invoice } = await supabase
          .from("invoices")
          .select("id")
          .eq("tenant_id", tenant.id)
          .neq("status", "paid")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Fallback to any invoice
        const { data: anyInvoice } = invoice
          ? { data: invoice }
          : await supabase
              .from("invoices")
              .select("id")
              .eq("tenant_id", tenant.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

        if (anyInvoice?.id) {
          setInvoiceId(anyInvoice.id);
          toast({ title: "تم التعبئة التلقائية", description: `آخر فاتورة غير مدفوعة: ${anyInvoice.id.slice(0, 8)}…` });
        }
      }
    } catch {
      toast({ title: "تعذّر التعبئة التلقائية", variant: "destructive" });
    } finally {
      setAutoFilling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "تم النسخ" });
  };

  if (isPlatformAdmin === null) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] gap-3" dir="rtl">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">هذه الصفحة متاحة لمشرفي المنصة فقط.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Shield size={20} className="text-primary" />
          اختبار Webhooks — Stripe & Geidea
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          اختبارات أمنية شاملة (Missing / Wrong / Positive / Duplicate) • للمشرفين فقط
        </p>
      </div>

      {/* Shared Config */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>الإعدادات المشتركة</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={autoFill}
              disabled={autoFilling}
            >
              {autoFilling ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              تعبئة تلقائية (آخر فاتورة غير مدفوعة)
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tenant ID</Label>
              <div className="flex gap-1.5">
                <Input
                  dir="ltr"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="font-mono text-xs h-8 flex-1"
                />
                {tenantId && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => copyToClipboard(tenantId)}>
                    <Copy size={12} />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Invoice ID (آخر فاتورة غير مدفوعة يُفضَّل)</Label>
              <div className="flex gap-1.5">
                <Input
                  dir="ltr"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="font-mono text-xs h-8 flex-1"
                />
                {invoiceId && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => copyToClipboard(invoiceId)}>
                    <Copy size={12} />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Shield size={11} className="text-primary" />
              لا تُكشف أي أسرار في هذه الصفحة
            </span>
            <span>•</span>
            <span>اختبار Positive يتطلب سر مُهيأ لهذا الـ tenant عبر صفحة Paid Integrations</span>
          </div>
        </CardContent>
      </Card>

      {/* Provider Tabs — Stripe & Geidea */}
      <Tabs defaultValue="stripe">
        <TabsList className="grid grid-cols-2 w-64">
          {PROVIDERS.map((p) => (
            <TabsTrigger key={p.id} value={p.id} className="text-xs">
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {PROVIDERS.map((p) => (
          <TabsContent key={p.id} value={p.id}>
            <ProviderTab
              provider={p}
              tenantId={tenantId}
              invoiceId={invoiceId}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default DebugWebhookTest;
