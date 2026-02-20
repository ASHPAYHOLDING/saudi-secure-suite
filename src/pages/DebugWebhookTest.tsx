import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
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
  Shield, CheckCircle2, XCircle, Loader2, Play, AlertTriangle, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
interface TestResult {
  status: number | null;
  body: string;
  ok: boolean | null;
  loading: boolean;
  error?: string;
}

interface WebhookEventRow {
  provider: string;
  provider_event_id: string;
  status: string;
  signature_valid: boolean | null;
  processing_error: string | null;
  created_at: string;
}

interface InvoicePaymentRow {
  invoice_id: string;
  amount: number;
  reference_number: string | null;
  created_at: string;
}

interface AuditLogRow {
  action: string;
  entity_label: string | null;
  entity_id: string | null;
  created_at: string;
}

interface QueryResults {
  webhookEvents: WebhookEventRow[];
  invoicePayments: InvoicePaymentRow[];
  auditLogs: AuditLogRow[];
  loading: boolean;
}

const EMPTY_RESULT: TestResult = { status: null, body: "", ok: null, loading: false };
const EMPTY_QUERIES: QueryResults = { webhookEvents: [], invoicePayments: [], auditLogs: [], loading: false };

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
const statusColor = (s: string) => {
  if (s === "processed") return "bg-primary/10 text-primary border-primary/30";
  if (s === "rejected" || s === "failed") return "bg-destructive/10 text-destructive border-destructive/30";
  if (s === "duplicate") return "bg-secondary text-secondary-foreground border-border";
  return "bg-muted text-muted-foreground border-border";
};

function ResultBadge({ status }: { status: number | null }) {
  if (status === null) return null;
  const ok = status >= 200 && status < 300;
  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-base px-3 py-1", ok ? "bg-primary/10 text-primary border-primary/30" : "bg-destructive/10 text-destructive border-destructive/30")}
    >
      {ok ? <CheckCircle2 size={14} className="ml-1.5" /> : <XCircle size={14} className="ml-1.5" />}
      HTTP {status}
    </Badge>
  );
}

// ──────────────────────────────────────────────────────────────
// Checklist
// ──────────────────────────────────────────────────────────────
interface ChecklistProps {
  missingResult: TestResult;
  wrongResult: TestResult;
  queries: QueryResults;
  invoiceId: string;
}

function Checklist({ missingResult, wrongResult, queries, invoiceId }: ChecklistProps) {
  const missingOk = missingResult.status === 401;
  const wrongOk = wrongResult.status === 401;
  const noNewPayments = queries.invoicePayments.length === 0;
  const hasRejected = queries.webhookEvents.some((e) => e.status === "rejected");
  const hasAudit = queries.auditLogs.some(
    (e) => e.action?.includes("webhook") || e.action?.includes("signature"),
  );

  const items = [
    { label: "Missing signature → يرجع 401", ok: missingOk, tested: missingResult.status !== null },
    { label: "Wrong signature → يرجع 401", ok: wrongOk, tested: wrongResult.status !== null },
    { label: "لا توجد invoice_payments جديدة", ok: noNewPayments, tested: queries.invoicePayments !== undefined },
    { label: "webhook_events سجّلت حالة rejected", ok: hasRejected, tested: queries.webhookEvents.length >= 0 },
    { label: "audit_logs سجّلت webhook_rejected أو signature_invalid", ok: hasAudit, tested: queries.auditLogs.length >= 0 },
  ];

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield size={14} className="text-primary" />
          ملخص الاختبار الأمني
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            {!item.tested ? (
              <AlertTriangle size={14} className="text-muted-foreground shrink-0" />
            ) : item.ok ? (
              <CheckCircle2 size={14} className="text-primary shrink-0" />
            ) : (
              <XCircle size={14} className="text-destructive shrink-0" />
            )}
            <span className={cn(!item.tested ? "text-muted-foreground" : item.ok ? "text-primary" : "text-destructive")}>
              {item.label}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────
// Query Tables
// ──────────────────────────────────────────────────────────────
function QueryTables({ queries }: { queries: QueryResults }) {
  if (queries.loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
        <Loader2 size={16} className="animate-spin" />
        جاري تحميل نتائج قاعدة البيانات…
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* A) webhook_events */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1.5">A) webhook_events (آخر 5)</p>
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-[11px]">
                <TableHead>المزود</TableHead>
                <TableHead>Event ID</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-center">التوقيع</TableHead>
                <TableHead>خطأ</TableHead>
                <TableHead>وقت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queries.webhookEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-4">لا توجد أحداث</TableCell>
                </TableRow>
              ) : queries.webhookEvents.map((ev, i) => (
                <TableRow key={i} className="text-xs">
                  <TableCell className="font-semibold capitalize">{ev.provider}</TableCell>
                  <TableCell className="font-mono text-[10px]" dir="ltr">{ev.provider_event_id}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[10px]", statusColor(ev.status ?? ""))}>
                      {ev.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {ev.signature_valid === true && <CheckCircle2 size={12} className="text-primary mx-auto" />}
                    {ev.signature_valid === false && <XCircle size={12} className="text-destructive mx-auto" />}
                    {(ev.signature_valid === null || ev.signature_valid === undefined) && <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-destructive text-[10px] max-w-[180px] truncate">{ev.processing_error ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-[10px]">{ev.created_at ? new Date(ev.created_at).toLocaleString("ar-SA") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* B) invoice_payments */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1.5">B) invoice_payments (للفاتورة المحددة)</p>
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-[11px]">
                <TableHead>Invoice ID</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>المرجع</TableHead>
                <TableHead>وقت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queries.invoicePayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-primary text-xs py-4">
                    <CheckCircle2 size={12} className="inline ml-1" />
                    لا توجد مدفوعات — ✅ صحيح (المبالغ لم تُحجز)
                  </TableCell>
                </TableRow>
              ) : queries.invoicePayments.map((p, i) => (
                <TableRow key={i} className="text-xs">
                  <TableCell className="font-mono text-[10px]" dir="ltr">{p.invoice_id}</TableCell>
                  <TableCell>{p.amount}</TableCell>
                  <TableCell className="font-mono text-[10px]" dir="ltr">{p.reference_number ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-[10px]">{p.created_at ? new Date(p.created_at).toLocaleString("ar-SA") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* C) audit_logs */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1.5">C) audit_logs (آخر 5)</p>
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-[11px]">
                <TableHead>الإجراء</TableHead>
                <TableHead>Entity Label</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>وقت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queries.auditLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-4">لا توجد سجلات</TableCell>
                </TableRow>
              ) : queries.auditLogs.map((a, i) => (
                <TableRow key={i} className="text-xs">
                  <TableCell className="font-mono text-[10px]" dir="ltr">{a.action}</TableCell>
                  <TableCell>{a.entity_label ?? "—"}</TableCell>
                  <TableCell className="font-mono text-[10px]" dir="ltr">{a.entity_id ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-[10px]">{a.created_at ? new Date(a.created_at).toLocaleString("ar-SA") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Provider Tab
// ──────────────────────────────────────────────────────────────
interface ProviderConfig {
  name: string;
  fnName: string;
  sigHeader: string;
  buildBody: (tenantId: string, invoiceId: string) => object;
  eventIdMissing: string;
  eventIdWrong: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: "Tap",
    fnName: "tap-webhook",
    sigHeader: "hashid",
    buildBody: (tenantId, invoiceId) => ({
      id: `evt_ui_test_tap_${Date.now()}`,
      status: "CAPTURED",
      amount: 100,
      currency: "SAR",
      metadata: { tenant_id: tenantId, invoice_id: invoiceId },
    }),
    eventIdMissing: "evt_ui_test_tap_missing",
    eventIdWrong: "evt_ui_test_tap_wrong",
  },
  {
    name: "Moyasar",
    fnName: "moyasar-webhook",
    sigHeader: "x-moyasar-signature",
    buildBody: (tenantId, invoiceId) => {
      const id = `evt_ui_test_moyasar_${Date.now()}`;
      return {
        id,
        data: {
          id,
          status: "paid",
          amount: 10000,
          currency: "SAR",
          metadata: { tenant_id: tenantId, invoice_id: invoiceId },
        },
      };
    },
    eventIdMissing: "evt_ui_test_moyasar_missing",
    eventIdWrong: "evt_ui_test_moyasar_wrong",
  },
  {
    name: "HyperPay",
    fnName: "hyperpay-webhook",
    sigHeader: "x-webhook-signature",
    buildBody: (tenantId, invoiceId) => ({
      id: `hp_ui_test_${Date.now()}`,
      merchantTransactionId: `hp_ui_test_${Date.now()}`,
      result: { code: "000.000.100" },
      amount: "100.00",
      currency: "SAR",
      customParameters: { tenant_id: tenantId, invoice_id: invoiceId },
    }),
    eventIdMissing: "hp_ui_test_missing",
    eventIdWrong: "hp_ui_test_wrong",
  },
];

interface ProviderTabProps {
  provider: ProviderConfig;
  projectRef: string;
  tenantId: string;
  invoiceId: string;
}

function ProviderTab({ provider, projectRef, tenantId, invoiceId }: ProviderTabProps) {
  const [missingResult, setMissingResult] = useState<TestResult>(EMPTY_RESULT);
  const [wrongResult, setWrongResult] = useState<TestResult>(EMPTY_RESULT);
  const [queries, setQueries] = useState<QueryResults>(EMPTY_QUERIES);

  const ref = projectRef.trim() || SUPABASE_PROJECT_ID;
  const baseUrl = `https://${ref}.supabase.co/functions/v1/${provider.fnName}?tenant_id=${tenantId}`;

  const runQueries = async () => {
    setQueries((q) => ({ ...q, loading: true }));
    try {
      const [evRes, payRes, auditRes] = await Promise.all([
        supabase
          .from("webhook_events")
          .select("provider, provider_event_id, status, signature_valid, processing_error, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("invoice_payments")
          .select("invoice_id, amount, reference_number, created_at")
          .eq("invoice_id", invoiceId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("audit_logs")
          .select("action, entity_label, entity_id, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      setQueries({
        webhookEvents: (evRes.data as WebhookEventRow[]) ?? [],
        invoicePayments: (payRes.data as InvoicePaymentRow[]) ?? [],
        auditLogs: (auditRes.data as AuditLogRow[]) ?? [],
        loading: false,
      });
    } catch (err) {
      console.error("[runQueries]", err);
      setQueries((q) => ({ ...q, loading: false }));
    }
  };

  const callWebhook = async (
    type: "missing" | "wrong",
    setter: React.Dispatch<React.SetStateAction<TestResult>>,
  ) => {
    if (!tenantId || !invoiceId) {
      setter({ status: null, body: "⚠️ يرجى إدخال Tenant ID و Invoice ID", ok: false, loading: false });
      return;
    }
    setter({ status: null, body: "", ok: null, loading: true });

    const body = JSON.stringify(provider.buildBody(tenantId, invoiceId));
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (type === "wrong") headers[provider.sigHeader] = "bad_signature_intentional";

    try {
      const res = await fetch(baseUrl, { method: "POST", headers, body });
      const text = await res.text();
      setter({ status: res.status, body: text, ok: res.ok, loading: false });
    } catch (e: any) {
      const msg = e?.message ?? String(e) ?? "Network error (CORS or connection refused)";
      setter({ status: null, body: msg, ok: false, loading: false, error: msg });
    }

    // Run DB queries after invocation — in its own try-catch so it never crashes the page
    try { await runQueries(); } catch { /* non-critical */ }
  };

  return (
    <div className="space-y-5 pt-4">
      {/* Checklist */}
      <Checklist
        missingResult={missingResult}
        wrongResult={wrongResult}
        queries={queries}
        invoiceId={invoiceId}
      />

      {/* Controls */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Missing Signature */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <XCircle size={12} className="text-destructive" />
              اختبار: Missing Signature
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              يرسل الطلب بدون header <code className="bg-muted px-1 rounded">{provider.sigHeader}</code>.
              التوقع: <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">HTTP 401</Badge>
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={missingResult.loading || !tenantId || !invoiceId}
              onClick={() => callWebhook("missing", setMissingResult)}
              className="w-full gap-2 text-xs"
            >
              {missingResult.loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Run — Missing Signature
            </Button>

            {(missingResult.status !== null || missingResult.error) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ResultBadge status={missingResult.status} />
                  {missingResult.status === 401
                    ? <span className="text-xs text-primary font-medium">✅ صحيح</span>
                    : missingResult.error
                    ? <span className="text-xs text-destructive font-medium">⚠️ خطأ شبكة</span>
                    : <span className="text-xs text-destructive font-medium">❌ غير متوقع</span>}
                </div>
                <pre className="text-[10px] bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-24" dir="ltr">
                  {missingResult.body || missingResult.error || ""}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wrong Signature */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <XCircle size={12} className="text-destructive" />
              اختبار: Wrong Signature
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              يرسل <code className="bg-muted px-1 rounded">{provider.sigHeader}: bad_signature_intentional</code>.
              التوقع: <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">HTTP 401</Badge>
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={wrongResult.loading || !tenantId || !invoiceId}
              onClick={() => callWebhook("wrong", setWrongResult)}
              className="w-full gap-2 text-xs"
            >
              {wrongResult.loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Run — Wrong Signature
            </Button>

            {(wrongResult.status !== null || wrongResult.error) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ResultBadge status={wrongResult.status} />
                  {wrongResult.status === 401
                    ? <span className="text-xs text-primary font-medium">✅ صحيح</span>
                    : wrongResult.error
                    ? <span className="text-xs text-destructive font-medium">⚠️ خطأ شبكة</span>
                    : <span className="text-xs text-destructive font-medium">❌ غير متوقع</span>}
                </div>
                <pre className="text-[10px] bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-24" dir="ltr">
                  {wrongResult.body || wrongResult.error || ""}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Refresh queries manually */}
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={runQueries} disabled={queries.loading} className="gap-1.5 text-xs h-7">
          <RefreshCw size={11} className={cn(queries.loading && "animate-spin")} />
          تحديث نتائج قاعدة البيانات
        </Button>
      </div>

      {/* DB Results */}
      <QueryTables queries={queries} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────
const DebugWebhookTest = () => {
  const { user } = useAuth();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [projectRef, setProjectRef] = useState(SUPABASE_PROJECT_ID);
  const [autoFilling, setAutoFilling] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("is_platform_admin").then(({ data }) => setIsPlatformAdmin(!!data));
  }, [user]);

  // Auto-fill tenantId + invoiceId from DB
  const autoFill = async () => {
    setAutoFilling(true);
    try {
      // Get first tenant
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (tenant?.id) {
        setTenantId(tenant.id);
        // Get first invoice for that tenant
        const { data: invoice } = await supabase
          .from("invoices")
          .select("id")
          .eq("tenant_id", tenant.id)
          .limit(1)
          .maybeSingle();
        if (invoice?.id) setInvoiceId(invoice.id);
      }
    } finally {
      setAutoFilling(false);
    }
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
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Shield size={20} className="text-primary" />
          اختبار أمان Webhooks — بوابات الدفع
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          اختبار سلبي (Negative Tests) للتحقق من رفض الطلبات غير الموقّعة • للمشرفين فقط
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
              تعبئة تلقائية
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Project Ref</Label>
              <Input
                dir="ltr"
                value={projectRef}
                onChange={(e) => setProjectRef(e.target.value)}
                placeholder="abcdefghijklmnop"
                className="font-mono text-xs h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tenant ID</Label>
              <Input
                dir="ltr"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="font-mono text-xs h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Invoice ID</Label>
              <Input
                dir="ltr"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="font-mono text-xs h-8"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            لا تُخزن أي أسرار هنا — يتم اختبار الرفض فقط (توقيع مفقود أو خاطئ)
          </p>
        </CardContent>
      </Card>

      {/* Provider Tabs */}
      <Tabs defaultValue="tap">
      <TabsList className="grid grid-cols-3 w-full max-w-sm">
          {PROVIDERS.map((p) => (
            <TabsTrigger key={p.fnName} value={p.name.toLowerCase().replace(/\s+/g, "")} className="text-xs">
              {p.name}
            </TabsTrigger>
          ))}
        </TabsList>

      {PROVIDERS.map((p) => (
          <TabsContent key={p.fnName} value={p.name.toLowerCase().replace(/\s+/g, "")}>
            <ProviderTab
              provider={p}
              projectRef={projectRef}
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
