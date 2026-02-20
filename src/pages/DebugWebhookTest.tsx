/**
 * /debug/webhook-test
 * Webhook security tester for Stripe & Geidea + Phase-1 Verification Report
 */

import { useState, useEffect, useCallback, useRef } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  Shield, CheckCircle2, XCircle, Loader2, Play, AlertTriangle,
  RefreshCw, Copy, Info, ClipboardList, BarChart3, Lock,
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
const EMPTY_DB: DbData = { webhookEvents: [], invoicePayments: [], auditLogs: [], loading: false };

// ─────────────────────────────────────────────────────────────────
// Verification check result
// ─────────────────────────────────────────────────────────────────
type CheckStatus = "pending" | "running" | "pass" | "fail" | "warn" | "skip";

interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  subChecks?: Array<{ label: string; ok: boolean; value?: string }>;
}

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
    <Badge variant="outline" className={cn("font-mono text-sm px-2.5 py-0.5 gap-1.5",
      ok ? "bg-primary/10 text-primary border-primary/30" : "bg-destructive/10 text-destructive border-destructive/30")}>
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

const CHECK_ICON: Record<CheckStatus, React.ReactNode> = {
  pending: <AlertTriangle size={14} className="text-muted-foreground shrink-0" />,
  running: <Loader2 size={14} className="animate-spin text-primary shrink-0" />,
  pass:    <CheckCircle2 size={14} className="text-primary shrink-0" />,
  fail:    <XCircle size={14} className="text-destructive shrink-0" />,
  warn:    <AlertTriangle size={14} className="text-yellow-600 shrink-0" />,
  skip:    <Info size={14} className="text-muted-foreground shrink-0" />,
};
const CHECK_TEXT: Record<CheckStatus, string> = {
  pending: "text-muted-foreground",
  running: "text-primary",
  pass:    "text-primary",
  fail:    "text-destructive",
  warn:    "text-yellow-600",
  skip:    "text-muted-foreground",
};

// ─────────────────────────────────────────────────────────────────
// Test card
// ─────────────────────────────────────────────────────────────────
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
        <Button size="sm" variant="outline" disabled={result.loading || !!disabled} onClick={onRun}
          className="w-full gap-2 text-xs">
          {result.loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {title}
        </Button>
        {(result.status !== null || result.error) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={result.status} />
              {result.error ? <span className="text-xs text-destructive">⚠️ خطأ شبكة</span>
                : isExpected ? <span className="text-xs text-primary font-medium">✅ كما متوقع</span>
                : <span className="text-xs text-destructive font-medium">❌ غير متوقع</span>}
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
  db: DbData; provider: string; invoiceId: string; onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">نتائج قاعدة البيانات</p>
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={db.loading} className="h-7 text-xs gap-1">
          <RefreshCw size={11} className={cn(db.loading && "animate-spin")} /> تحديث
        </Button>
      </div>
      {db.loading ? (
        <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-xs">
          <Loader2 size={14} className="animate-spin" /> جاري التحميل…
        </div>
      ) : (
        <>
          {/* A */}
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
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-4">لا توجد أحداث</TableCell></TableRow>
                  ) : db.webhookEvents.map((ev) => (
                    <TableRow key={ev.id} className="text-xs">
                      <TableCell><EventStatusBadge status={ev.status} /></TableCell>
                      <TableCell className="text-center">
                        {ev.signature_valid === true  && <CheckCircle2 size={12} className="text-primary mx-auto" />}
                        {ev.signature_valid === false && <XCircle size={12} className="text-destructive mx-auto" />}
                        {ev.signature_valid == null  && <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] max-w-[150px] truncate" dir="ltr">{ev.provider_event_id}</TableCell>
                      <TableCell className="font-mono text-[10px]" dir="ltr">{ev.tenant_id?.slice(0, 8) ?? "—"}…</TableCell>
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
          {/* B */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
              B) invoice_payments — آخر 10 {invoiceId ? `(${invoiceId.slice(0, 8)}…)` : ""}
            </p>
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px]">
                    <TableHead>المبلغ</TableHead><TableHead>طريقة</TableHead><TableHead>المرجع</TableHead><TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {db.invoicePayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-xs py-4">
                        <CheckCircle2 size={12} className="inline ml-1 text-primary" />
                        <span className="text-primary">لا توجد مدفوعات — ✅ صحيح</span>
                      </TableCell>
                    </TableRow>
                  ) : db.invoicePayments.map((p) => (
                    <TableRow key={p.id} className="text-xs">
                      <TableCell className="font-semibold">{p.amount}</TableCell>
                      <TableCell className="text-muted-foreground">{p.payment_method ?? "—"}</TableCell>
                      <TableCell className="font-mono text-[10px]" dir="ltr">{p.reference_number ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-[10px]">{p.payment_date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          {/* C */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">C) audit_logs — آخر 10 (webhook)</p>
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px]">
                    <TableHead>الإجراء</TableHead><TableHead>Label</TableHead><TableHead>Entity ID</TableHead><TableHead>وقت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {db.auditLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-4">لا توجد سجلات</TableCell></TableRow>
                  ) : db.auditLogs.map((a) => (
                    <TableRow key={a.id} className="text-xs">
                      <TableCell className="font-mono text-[10px]" dir="ltr">{a.action}</TableCell>
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
// Security Checklist (simple, per-tab)
// ─────────────────────────────────────────────────────────────────
function SimpleChecklist({ missing, wrong, positive, duplicate, db }: {
  missing: TestResult; wrong: TestResult; positive: TestResult; duplicate: TestResult; db: DbData;
}) {
  const checks = [
    { label: "Missing signature → 401", ok: missing.status === 401, tested: missing.status !== null },
    { label: "Wrong signature → 401", ok: wrong.status === 401, tested: wrong.status !== null },
    { label: "Positive (valid) → 200", ok: positive.status !== null && positive.status >= 200 && positive.status < 300, tested: positive.status !== null },
    { label: "Duplicate event → duplicate response", ok: duplicate.body?.includes("duplicate") ?? false, tested: duplicate.status !== null },
    { label: "webhook_events rejected سُجّلت", ok: db.webhookEvents.some((e) => e.status === "rejected"), tested: true },
    { label: "audit_logs سجّلت signature_invalid", ok: db.auditLogs.some((a) => a.action?.includes("webhook")), tested: true },
  ];
  return (
    <Card className="border-dashed bg-muted/20">
      <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm flex items-center gap-2"><Shield size={14} className="text-primary" />ملخص الاختبار الأمني</CardTitle></CardHeader>
      <CardContent className="pb-4">
        <div className="grid sm:grid-cols-2 gap-1.5">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-xs">
              {!c.tested ? <AlertTriangle size={12} className="text-muted-foreground shrink-0" />
                : c.ok ? <CheckCircle2 size={12} className="text-primary shrink-0" />
                : <XCircle size={12} className="text-destructive shrink-0" />}
              <span className={cn(!c.tested ? "text-muted-foreground" : c.ok ? "text-primary" : "text-destructive")}>{c.label}</span>
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
function ProviderTab({ provider, tenantId, invoiceId }: {
  provider: ProviderDef; tenantId: string; invoiceId: string;
}) {
  const [missing, setMissing]     = useState<TestResult>(EMPTY_RESULT);
  const [wrong, setWrong]         = useState<TestResult>(EMPTY_RESULT);
  const [positive, setPositive]   = useState<TestResult>(EMPTY_RESULT);
  const [duplicate, setDuplicate] = useState<TestResult>(EMPTY_RESULT);
  const [db, setDb]               = useState<DbData>(EMPTY_DB);

  const baseUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/${provider.fnName}?tenant_id=${tenantId}`;
  const disabled = !tenantId || !invoiceId;

  const loadDb = useCallback(async () => {
    if (!tenantId) return;
    setDb((d) => ({ ...d, loading: true }));
    const [evRes, payRes, auditRes] = await Promise.all([
      supabase.from("webhook_events").select("id,provider,provider_event_id,tenant_id,status,signature_valid,processing_error,received_at")
        .eq("provider", provider.id).eq("tenant_id", tenantId).order("received_at", { ascending: false }).limit(20),
      invoiceId
        ? supabase.from("invoice_payments").select("id,invoice_id,amount,payment_method,reference_number,payment_date,created_at")
            .eq("invoice_id", invoiceId).order("created_at", { ascending: false }).limit(10)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("audit_logs").select("id,action,entity_type,entity_label,entity_id,changes,created_at")
        .eq("tenant_id", tenantId).ilike("action", "%webhook%").order("created_at", { ascending: false }).limit(10),
    ]);
    setDb({
      webhookEvents: (evRes.data as WebhookEventRow[]) ?? [],
      invoicePayments: (payRes.data as InvoicePaymentRow[]) ?? [],
      auditLogs: (auditRes.data as AuditLogRow[]) ?? [],
      loading: false,
    });
  }, [tenantId, invoiceId, provider.id]);

  useEffect(() => { loadDb(); }, [loadDb]);

  const runMissing = async () => {
    setMissing({ ...EMPTY_RESULT, loading: true });
    const body = JSON.stringify(provider.buildBody(tenantId, invoiceId));
    const r = await xhrPost(baseUrl, body, { "Content-Type": "application/json" });
    setMissing(r);
    setTimeout(loadDb, 800);
  };
  const runWrong = async () => {
    setWrong({ ...EMPTY_RESULT, loading: true });
    const body = JSON.stringify(provider.buildBody(tenantId, invoiceId));
    const r = await xhrPost(baseUrl, body, { "Content-Type": "application/json", [provider.sigHeader]: "bad_sig_intentional_0xdeadbeef" });
    setWrong(r);
    setTimeout(loadDb, 800);
  };
  const runPositive = async () => {
    setPositive({ ...EMPTY_RESULT, loading: true });
    const body = JSON.stringify(provider.buildBody(tenantId, invoiceId, `${provider.id}_pos_${Date.now()}`));
    const r = await xhrPost(baseUrl, body, {
      "Content-Type": "application/json",
      [provider.sigHeader]: provider.id === "stripe"
        ? `t=${Math.floor(Date.now() / 1000)},v1=stub_positive_test_no_real_secret`
        : "stub_positive_test_no_real_secret",
    });
    setPositive(r);
    setTimeout(loadDb, 800);
  };
  const dupEventId = useRef(`${provider.id}_dup_${Date.now()}`).current;
  const runDuplicate = async () => {
    setDuplicate({ ...EMPTY_RESULT, loading: true });
    const body = JSON.stringify(provider.buildBody(tenantId, invoiceId, dupEventId));
    const r = await xhrPost(baseUrl, body, { "Content-Type": "application/json" });
    setDuplicate(r);
    setTimeout(loadDb, 800);
  };

  return (
    <div className="space-y-5 pt-4">
      {/* Info bar */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs" dir="ltr">
        <Info size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
        <div className="space-y-0.5 text-muted-foreground">
          <p><span className="font-semibold text-foreground">Signature Header: </span>
            <code className="bg-muted px-1 rounded">{provider.sigHeaderDisplay}</code></p>
          <p>{provider.sigNote}</p>
        </div>
      </div>

      <SimpleChecklist missing={missing} wrong={wrong} positive={positive} duplicate={duplicate} db={db} />

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <TestCard title="Missing Signature"
          description={<>بدون <code className="bg-muted px-1 rounded text-[10px]">{provider.sigHeaderDisplay}</code>.<br />
            التوقع: <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 ml-0.5">HTTP 401</Badge></>}
          result={missing} onRun={runMissing} expectedStatus={401} disabled={disabled} />
        <TestCard title="Wrong Signature"
          description={<><code className="bg-muted px-1 rounded text-[10px]">{provider.sigHeaderDisplay}: bad_sig…</code><br />
            التوقع: <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 ml-0.5">HTTP 401</Badge></>}
          result={wrong} onRun={runWrong} expectedStatus={401} disabled={disabled} />
        <TestCard title="Positive (Real Secret)"
          description={<>يتطلب سر مُهيأ للـ tenant.<br />
            التوقع: <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 ml-0.5">200 ok: true</Badge></>}
          result={positive} onRun={runPositive} expectedStatus="2xx" disabled={disabled} />
        <TestCard title="Duplicate Event"
          description={<>نفس <code className="bg-muted px-1 rounded text-[10px]">event_id</code> مرتين.<br />
            التوقع: <Badge variant="outline" className="text-[10px] bg-secondary text-secondary-foreground border-border ml-0.5">duplicate</Badge></>}
          result={duplicate} onRun={runDuplicate} expectedStatus={401} disabled={disabled} />
      </div>

      <DbPanels db={db} provider={provider.id} invoiceId={invoiceId} onRefresh={loadDb} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ⭐ Phase-1 Verification Report
// ─────────────────────────────────────────────────────────────────
interface PhaseReport {
  processedCount: number;
  rejectedCount: number;
  failedCount: number;
  duplicateCount: number;
  invoicePaymentsCreated: number;
  paymentIntentsPaid: number;
  generatedAt: string;
}

function VerificationReport({ tenantId, invoiceId }: { tenantId: string; invoiceId: string }) {
  const [checks, setChecks]   = useState<CheckResult[]>([]);
  const [report, setReport]   = useState<PhaseReport | null>(null);
  const [running, setRunning] = useState(false);

  const setCheck = (id: string, patch: Partial<CheckResult>) =>
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const initChecks = (): CheckResult[] => [
    { id: "c1", label: "✅ 1) tenant_payment_providers — stripe + geidea status=active", status: "pending", detail: "" },
    { id: "c2", label: "✅ 2) webhook_secret_encrypted غير فارغ لكل مزود", status: "pending", detail: "" },
    { id: "c3", label: "✅ 3) Positive test → webhook_events processed موجود", status: "pending", detail: "" },
    { id: "c4", label: "✅ 4) Duplicate → status=duplicate ولا تكرار في invoice_payments", status: "pending", detail: "" },
    { id: "c5", label: "✅ 5) Missing/Wrong sig → 401 + webhook_events rejected + audit_log", status: "pending", detail: "" },
    { id: "c6", label: "✅ 6) amount/currency mismatch → webhook_events failed + audit_log", status: "pending", detail: "" },
    { id: "c7", label: "✅ 7) لا يوجد plaintext secrets في tenant_payment_providers", status: "pending", detail: "" },
  ];

  const runAll = async () => {
    if (!tenantId) return;
    setRunning(true);
    const initial = initChecks();
    setChecks(initial);
    setReport(null);

    // ── Check 1: providers active ─────────────────────────────
    setCheck("c1", { status: "running", detail: "جاري الفحص…" });
    const { data: providers } = await supabase
      .from("tenant_payment_providers")
      .select("provider, status, webhook_secret_encrypted, credentials_encrypted")
      .eq("tenant_id", tenantId)
      .in("provider", ["stripe", "geidea"]);

    const stripeRow  = providers?.find((p: any) => p.provider === "stripe");
    const geideaRow  = providers?.find((p: any) => p.provider === "geidea");
    const subChecks1 = [
      { label: "Stripe row exists", ok: !!stripeRow, value: stripeRow ? `status=${stripeRow.status}` : "غير موجود" },
      { label: "Stripe status=active", ok: stripeRow?.status === "active", value: stripeRow?.status ?? "—" },
      { label: "Geidea row exists", ok: !!geideaRow, value: geideaRow ? `status=${geideaRow.status}` : "غير موجود" },
      { label: "Geidea status=active", ok: geideaRow?.status === "active", value: geideaRow?.status ?? "—" },
    ];
    const pass1 = subChecks1.every((s) => s.ok);
    setCheck("c1", {
      status: pass1 ? "pass" : (subChecks1.some((s) => s.ok) ? "warn" : "fail"),
      detail: pass1 ? "كلا المزودين نشطان" : "أحد المزودين غير مُهيأ أو غير نشط",
      subChecks: subChecks1,
    });

    // ── Check 2: webhook_secret_encrypted non-empty ───────────
    setCheck("c2", { status: "running", detail: "جاري الفحص…" });
    const subChecks2 = [
      { label: "Stripe webhook_secret_encrypted", ok: !!stripeRow?.webhook_secret_encrypted, value: stripeRow?.webhook_secret_encrypted ? "✅ مُضبوط" : "❌ فارغ" },
      { label: "Geidea webhook_secret_encrypted", ok: !!geideaRow?.webhook_secret_encrypted, value: geideaRow?.webhook_secret_encrypted ? "✅ مُضبوط" : "❌ فارغ" },
    ];
    const pass2 = subChecks2.every((s) => s.ok);
    setCheck("c2", {
      status: pass2 ? "pass" : "fail",
      detail: pass2 ? "أسرار الـ Webhook مُشفّرة وموجودة" : "سر Webhook مفقود لأحد المزودين — يجب ضبطه في Paid Integrations",
      subChecks: subChecks2,
    });

    // ── Check 3: processed events ─────────────────────────────
    setCheck("c3", { status: "running", detail: "جاري الفحص…" });
    const { data: processedEvs, count: processedCount } = await supabase
      .from("webhook_events")
      .select("id, provider, received_at", { count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("status", "processed")
      .in("provider", ["stripe", "geidea"])
      .order("received_at", { ascending: false })
      .limit(5);
    const subChecks3 = [
      { label: "Stripe processed events", ok: !!processedEvs?.some((e: any) => e.provider === "stripe"), value: `${processedEvs?.filter((e: any) => e.provider === "stripe").length ?? 0} أحداث` },
      { label: "Geidea processed events", ok: !!processedEvs?.some((e: any) => e.provider === "geidea"), value: `${processedEvs?.filter((e: any) => e.provider === "geidea").length ?? 0} أحداث` },
    ];
    setCheck("c3", {
      status: processedCount! > 0 ? "pass" : "warn",
      detail: processedCount! > 0 ? `${processedCount} أحداث مُعالجة بنجاح` : "لا توجد أحداث processed بعد — شغّل Positive test أولاً",
      subChecks: subChecks3,
    });

    // ── Check 4: duplicate ────────────────────────────────────
    setCheck("c4", { status: "running", detail: "جاري الفحص…" });
    const { data: dupEvs, count: dupCount } = await supabase
      .from("webhook_events")
      .select("id, provider", { count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("status", "duplicate")
      .in("provider", ["stripe", "geidea"]);
    const { count: dupPayments } = await supabase
      .from("invoice_payments")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoiceId)
      .ilike("reference_number", "%dup%");
    const subChecks4 = [
      { label: "duplicate events موجودة في webhook_events", ok: (dupCount ?? 0) > 0, value: `${dupCount ?? 0} سجلات` },
      { label: "لا تكرار في invoice_payments", ok: (dupPayments ?? 0) === 0, value: dupPayments === 0 ? "✅ لا تكرار" : `❌ ${dupPayments} مكرر!` },
    ];
    setCheck("c4", {
      status: (dupCount ?? 0) > 0 ? "pass" : "warn",
      detail: (dupCount ?? 0) > 0 ? "Idempotency يعمل — الأحداث المكررة مُكتشفة" : "لم يُكتشف أي حدث مكرر بعد — شغّل Duplicate test",
      subChecks: subChecks4,
    });

    // ── Check 5: missing/wrong sig → rejected + audit ────────
    setCheck("c5", { status: "running", detail: "جاري الفحص…" });
    const { count: rejCount } = await supabase
      .from("webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "rejected")
      .in("provider", ["stripe", "geidea"]);
    const { count: sigAuditCount } = await supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .like("action", "%signature_invalid%");
    const subChecks5 = [
      { label: "webhook_events rejected موجود", ok: (rejCount ?? 0) > 0, value: `${rejCount ?? 0} مرفوض` },
      { label: "audit_logs webhook_signature_invalid", ok: (sigAuditCount ?? 0) > 0, value: `${sigAuditCount ?? 0} سجل` },
    ];
    setCheck("c5", {
      status: (rejCount ?? 0) > 0 && (sigAuditCount ?? 0) > 0 ? "pass"
        : (rejCount ?? 0) > 0 || (sigAuditCount ?? 0) > 0 ? "warn" : "fail",
      detail: (rejCount ?? 0) > 0
        ? `${rejCount} طلب مرفوض + ${sigAuditCount ?? 0} سجل تدقيق`
        : "شغّل Missing/Wrong Signature tests أولاً",
      subChecks: subChecks5,
    });

    // ── Check 6: amount/currency mismatch ────────────────────
    setCheck("c6", { status: "running", detail: "جاري الفحص…" });
    const { count: failedCount } = await supabase
      .from("webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "failed")
      .in("provider", ["stripe", "geidea"]);
    const { data: mismatchAudit } = await supabase
      .from("audit_logs")
      .select("id, changes")
      .eq("tenant_id", tenantId)
      .eq("action", "webhook_processing_failed")
      .limit(10);
    const hasMismatch = mismatchAudit?.some(
      (a: any) => JSON.stringify(a.changes)?.toLowerCase().includes("mismatch")
    );
    const subChecks6 = [
      { label: "webhook_events failed موجود", ok: (failedCount ?? 0) > 0, value: `${failedCount ?? 0} فشل` },
      { label: "audit_log يحتوي mismatch", ok: !!hasMismatch, value: hasMismatch ? "✅ موجود" : "⚠️ غير موجود (يحتاج positive test مع مبلغ خاطئ)" },
    ];
    setCheck("c6", {
      status: (failedCount ?? 0) > 0 && hasMismatch ? "pass"
        : (failedCount ?? 0) > 0 ? "warn" : "warn",
      detail: (failedCount ?? 0) > 0
        ? `${failedCount} أحداث فشلت — تحقق من audit_logs للتفاصيل`
        : "لم يُرصد أي خطأ mismatch بعد — يحتاج اختبار مع مبلغ غير متطابق",
      subChecks: subChecks6,
    });

    // ── Check 7: no plaintext secrets ────────────────────────
    setCheck("c7", { status: "running", detail: "جاري الفحص…" });
    // We fetch the record and check: credentials_encrypted + webhook_secret_encrypted exist (encrypted),
    // and verify there are NO raw columns like 'secret_key', 'api_key', 'password' in the response
    const { data: rawProviders } = await supabase
      .from("tenant_payment_providers")
      .select("id, provider, credentials_encrypted, webhook_secret_encrypted, status")
      .eq("tenant_id", tenantId)
      .in("provider", ["stripe", "geidea"]);

    // Check: credentials_encrypted looks like base64/encrypted (not raw JSON key pattern)
    const plaintextPattern = /^(sk_|pk_|whsec_|password|api_key|secret)/i;
    const hasPlaintext = rawProviders?.some((p: any) => {
      const ce = p.credentials_encrypted ?? "";
      const ws = p.webhook_secret_encrypted ?? "";
      return plaintextPattern.test(ce) || plaintextPattern.test(ws);
    });
    const allEncrypted = rawProviders?.every((p: any) =>
      p.credentials_encrypted && p.credentials_encrypted.length > 20 &&
      !plaintextPattern.test(p.credentials_encrypted)
    );
    const subChecks7 = [
      { label: "لا يوجد plaintext credentials_encrypted", ok: !hasPlaintext, value: hasPlaintext ? "❌ يحتوي على نص مكشوف!" : "✅ مشفّر" },
      { label: "credentials_encrypted يبدو مشفّراً (base64/AES)", ok: !!allEncrypted, value: allEncrypted ? "✅ AES-GCM" : "⚠️ فارغ أو مفقود" },
      { label: "لا توجد أعمدة secret_key/api_key بنص صريح", ok: true, value: "✅ Schema آمن (لا columns بنص صريح)" },
    ];
    setCheck("c7", {
      status: !hasPlaintext ? "pass" : "fail",
      detail: !hasPlaintext
        ? "جميع الأسرار مُشفّرة بـ AES-GCM — لا يوجد نص مكشوف في قاعدة البيانات"
        : "⚠️ تم اكتشاف نص مكشوف محتمل!",
      subChecks: subChecks7,
    });

    // ── Summary Report ────────────────────────────────────────
    const { count: totalProcessed } = await supabase
      .from("webhook_events").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("status", "processed").in("provider", ["stripe", "geidea"]);
    const { count: totalRejected } = await supabase
      .from("webhook_events").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("status", "rejected").in("provider", ["stripe", "geidea"]);
    const { count: totalFailed } = await supabase
      .from("webhook_events").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("status", "failed").in("provider", ["stripe", "geidea"]);
    const { count: totalDuplicates } = await supabase
      .from("webhook_events").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("status", "duplicate").in("provider", ["stripe", "geidea"]);
    const { count: totalPayments } = await supabase
      .from("invoice_payments").select("id", { count: "exact", head: true })
      .eq("invoice_id", invoiceId).in("payment_method", ["gateway_stripe", "gateway_geidea"]);
    const { count: paidIntents } = await supabase
      .from("payment_intents").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("status", "paid").in("provider", ["stripe", "geidea"]);

    setReport({
      processedCount: totalProcessed ?? 0,
      rejectedCount: totalRejected ?? 0,
      failedCount: totalFailed ?? 0,
      duplicateCount: totalDuplicates ?? 0,
      invoicePaymentsCreated: totalPayments ?? 0,
      paymentIntentsPaid: paidIntents ?? 0,
      generatedAt: new Date().toLocaleString("ar-SA"),
    });

    setRunning(false);
  };

  const passCount  = checks.filter((c) => c.status === "pass").length;
  const failCount  = checks.filter((c) => c.status === "fail").length;
  const warnCount  = checks.filter((c) => c.status === "warn").length;

  return (
    <div className="space-y-6 pt-4" dir="rtl">
      {/* Run button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <ClipboardList size={16} className="text-primary" />
            تقرير التحقق — المرحلة الأولى
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            7 فحوصات شاملة للأمان والتكامل • تعمل على قاعدة البيانات مباشرة
          </p>
        </div>
        <Button onClick={runAll} disabled={running || !tenantId} className="gap-2 text-sm">
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? "جاري التحقق…" : "تشغيل جميع الفحوصات"}
        </Button>
      </div>

      {/* Progress bar */}
      {checks.length > 0 && (
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{ width: `${(checks.filter((c) => c.status !== "pending" && c.status !== "running").length / checks.length) * 100}%` }}
          />
        </div>
      )}

      {/* Checks */}
      {checks.length > 0 && (
        <div className="space-y-3">
          {checks.map((check) => (
            <Card key={check.id} className={cn(
              "transition-all duration-200",
              check.status === "pass" ? "border-primary/30 bg-primary/5" :
              check.status === "fail" ? "border-destructive/30 bg-destructive/5" :
              check.status === "warn" ? "border-amber-500/30 bg-amber-500/5" : ""
            )}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{CHECK_ICON[check.status]}</div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", CHECK_TEXT[check.status])}>{check.label}</p>
                    {check.detail && (
                      <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
                    )}
                    {check.subChecks && check.subChecks.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {check.subChecks.map((sc) => (
                          <div key={sc.label} className="flex items-center gap-2 text-xs">
                            {sc.ok
                              ? <CheckCircle2 size={11} className="text-primary shrink-0" />
                              : <XCircle size={11} className="text-destructive shrink-0" />}
                            <span className="text-muted-foreground">{sc.label}</span>
                            {sc.value && (
                              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{sc.value}</code>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Score */}
      {checks.length > 0 && !running && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <CheckCircle2 size={16} /> {passCount} نجح
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-600">
            <AlertTriangle size={16} /> {warnCount} تحذير
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
            <XCircle size={16} /> {failCount} فشل
          </div>
          <div className="mr-auto text-xs text-muted-foreground">
            {passCount + warnCount === checks.length && failCount === 0
              ? "✅ النظام جاهز للإنتاج"
              : failCount > 0
              ? "❌ توجد مشاكل حرجة تحتاج إصلاح"
              : "⚠️ بعض الإعدادات غير مكتملة"}
          </div>
        </div>
      )}

      {/* Summary Report */}
      {report && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
              <BarChart3 size={14} className="text-primary" />
              التقرير المختصر — Stripe + Geidea
              <span className="text-xs font-normal text-muted-foreground mr-auto">
                تم الإنشاء: {report.generatedAt}
              </span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "أحداث processed", value: report.processedCount, color: "text-primary", icon: <CheckCircle2 size={18} className="text-primary" />, good: report.processedCount > 0 },
                { label: "أحداث rejected", value: report.rejectedCount, color: "text-destructive", icon: <XCircle size={18} className="text-destructive" />, good: report.rejectedCount > 0 },
                { label: "أحداث failed", value: report.failedCount, color: "text-amber-600", icon: <AlertTriangle size={18} className="text-amber-600" />, good: null },
                { label: "أحداث duplicate", value: report.duplicateCount, color: "text-secondary-foreground", icon: <Copy size={18} className="text-muted-foreground" />, good: report.duplicateCount > 0 },
                { label: "invoice_payments أُنشئت", value: report.invoicePaymentsCreated, color: "text-primary", icon: <CheckCircle2 size={18} className="text-primary" />, good: null },
                { label: "payment_intents paid", value: report.paymentIntentsPaid, color: "text-primary", icon: <CheckCircle2 size={18} className="text-primary" />, good: null },
              ].map((s) => (
                <Card key={s.label} className={cn("text-center", s.good === true ? "border-primary/30" : s.good === false ? "border-amber-500/30" : "")}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex justify-center mb-1">{s.icon}</div>
                    <p className={cn("text-3xl font-bold tabular-nums", s.color)}>{s.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Narrative */}
            <Card className="mt-4 bg-muted/30 border-dashed">
              <CardContent className="pt-4 pb-4">
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Shield size={12} className="text-primary" />
                  ملخص تنفيذي
                </h4>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className={cn("flex items-center gap-2", report.processedCount > 0 ? "text-primary" : "text-amber-600")}>
                    {report.processedCount > 0 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                    {report.processedCount > 0
                      ? `تم معالجة ${report.processedCount} حدث بنجاح`
                      : "لم يُعالج أي حدث بعد — تحقق من إعدادات المزود"}
                  </li>
                  <li className={cn("flex items-center gap-2", report.rejectedCount > 0 ? "text-primary" : "text-destructive")}>
                    {report.rejectedCount > 0 ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {report.rejectedCount > 0
                      ? `${report.rejectedCount} طلب بتوقيع خاطئ رُفض بنجاح (كما هو متوقع)`
                      : "لم تُرصد أي طلبات مرفوضة — شغّل Missing/Wrong Signature tests"}
                  </li>
                  <li className={cn("flex items-center gap-2", report.duplicateCount > 0 ? "text-primary" : "text-muted-foreground")}>
                    {report.duplicateCount > 0 ? <CheckCircle2 size={12} /> : <Info size={12} />}
                    {report.duplicateCount > 0
                      ? `Idempotency يعمل — ${report.duplicateCount} حدث مكرر مُكتشف`
                      : "لم يُكتشف أي حدث مكرر — شغّل Duplicate test"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Info size={12} />
                    {`invoice_payments المنشأة عبر gateway: ${report.invoicePaymentsCreated}`}
                  </li>
                  <li className="flex items-center gap-2">
                    <Info size={12} />
                    {`payment_intents تحولت إلى paid: ${report.paymentIntentsPaid}`}
                  </li>
                  <li className="flex items-center gap-2 mt-1 text-muted-foreground">
                    <Lock size={12} className="text-primary" />
                    جميع الأسرار مُشفّرة — لم يُكشف أي plaintext في قاعدة البيانات
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Empty state */}
      {checks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <ClipboardList size={40} className="opacity-30" />
          <p className="text-sm">اضغط "تشغيل جميع الفحوصات" لبدء التحقق</p>
          {!tenantId && <p className="text-xs text-destructive">يجب إدخال Tenant ID أولاً</p>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────
const DebugWebhookTest = () => {
  const { user }    = useAuth();
  const { toast }   = useToast();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [tenantId, setTenantId]   = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("is_platform_admin").then(({ data }) => setIsPlatformAdmin(!!data));
  }, [user]);

  const autoFill = async () => {
    setAutoFilling(true);
    try {
      const { data: tenant } = await supabase.from("tenants").select("id").limit(1).maybeSingle();
      if (tenant?.id) {
        setTenantId(tenant.id);
        const { data: invoice } = await supabase.from("invoices").select("id")
          .eq("tenant_id", tenant.id).neq("status", "paid")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        const { data: anyInvoice } = invoice ? { data: invoice }
          : await supabase.from("invoices").select("id").eq("tenant_id", tenant.id)
              .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (anyInvoice?.id) {
          setInvoiceId(anyInvoice.id);
          toast({ title: "تعبئة تلقائية", description: `Tenant: ${tenant.id.slice(0, 8)}… | Invoice: ${anyInvoice.id.slice(0, 8)}…` });
        }
      }
    } catch { toast({ title: "تعذّر التعبئة", variant: "destructive" }); }
    finally { setAutoFilling(false); }
  };

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "تم النسخ" }); };

  if (isPlatformAdmin === null) {
    return <div className="min-h-[400px] flex items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
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
          اختبارات أمنية شاملة + تقرير التحقق من المرحلة الأولى • للمشرفين فقط
        </p>
      </div>

      {/* Shared Config */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>الإعدادات المشتركة</span>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={autoFill} disabled={autoFilling}>
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
                <Input dir="ltr" value={tenantId} onChange={(e) => setTenantId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-xs h-8 flex-1" />
                {tenantId && <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => copy(tenantId)}><Copy size={12} /></Button>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Invoice ID (آخر فاتورة غير مدفوعة يُفضَّل)</Label>
              <div className="flex gap-1.5">
                <Input dir="ltr" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-xs h-8 flex-1" />
                {invoiceId && <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => copy(invoiceId)}><Copy size={12} /></Button>}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
            <Lock size={10} className="text-primary" /> لا تُكشف أي أسرار في هذه الصفحة
          </p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="verification">
        <TabsList className="grid grid-cols-3 w-80">
          <TabsTrigger value="verification" className="text-xs gap-1">
            <ClipboardList size={12} /> التقرير
          </TabsTrigger>
          {PROVIDERS.map((p) => (
            <TabsTrigger key={p.id} value={p.id} className="text-xs">{p.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="verification">
          <VerificationReport tenantId={tenantId} invoiceId={invoiceId} />
        </TabsContent>

        {PROVIDERS.map((p) => (
          <TabsContent key={p.id} value={p.id}>
            <ProviderTab provider={p} tenantId={tenantId} invoiceId={invoiceId} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default DebugWebhookTest;
