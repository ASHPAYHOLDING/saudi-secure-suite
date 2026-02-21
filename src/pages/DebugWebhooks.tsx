import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, Shield,
  Copy, ChevronDown, ChevronUp, Loader2, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "";
const FUNCTIONS_BASE = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

const WEBHOOK_URLS = [
  { provider: "Tap", fn: "tap-webhook", header: "hashid", note: "HMAC-SHA256(raw_body, secret)" },
  { provider: "Moyasar", fn: "moyasar-webhook", header: "x-moyasar-signature", note: "HMAC-SHA256(raw_body, secret)" },
  { provider: "HyperPay", fn: "hyperpay-webhook", header: "x-webhook-signature", note: "HMAC-SHA256(raw_body, secret)" },
  { provider: "Stripe", fn: "stripe-webhook", header: "Stripe-Signature", note: "t=<ts>,v1=HMAC-SHA256('<ts>.<body>', whsec_…) — 5-min replay" },
  { provider: "Geidea", fn: "geidea-webhook", header: "X-Geidea-Signature", note: "HMAC-SHA256(raw_body, webhook_secret)" },
  { provider: "PayTabs", fn: "paytabs-webhook", header: "x-paytabs-signature", note: "HMAC-SHA256(raw_body, server_key)" },
  { provider: "MyFatoorah", fn: "myfatoorah-webhook", header: "—", note: "API verification (GetPaymentStatus)" },
  { provider: "PayPal", fn: "paypal-webhook", header: "paypal-transmission-sig", note: "PayPal /verify-webhook-signature API" },
  { provider: "Tabby", fn: "tabby-webhook", header: "x-tabby-signature", note: "HMAC-SHA256(raw_body, secret)" },
  { provider: "Tamara", fn: "tamara-webhook", header: "tamara-signature", note: "HMAC-SHA256(raw_body, secret)" },
  { provider: "Telr", fn: "telr-webhook", header: "x-telr-signature", note: "HMAC-SHA256(raw_body, secret)" },
  { provider: "MISPAY", fn: "mispay-webhook", header: "x-mispay-signature", note: "HMAC-SHA256(raw_body, secret)" },

  // Unified fallback handler (used when provider doesn't have a dedicated endpoint)
  { provider: "Unified", fn: "payment-webhook", header: "per-provider", note: "Shared handler — ?provider=tap|moyasar|hyperpay|stripe|geidea" },
];
// ── Expanded row: shows headers, related invoice_payments, payment_intents ──
const ExpandedEventDetails = ({ event: ev }: { event: WebhookEvent }) => {
  const [relatedPayments, setRelatedPayments] = useState<any[]>([]);
  const [relatedIntents, setRelatedIntents] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(true);

  useEffect(() => {
    const loadRelated = async () => {
      setLoadingRelated(true);
      const eventId = ev.provider_event_id;

      // Fetch invoice_payments with this reference_number
      const { data: payments } = await supabase
        .from("invoice_payments")
        .select("id, invoice_id, amount, payment_method, payment_date, reference_number, status, currency")
        .eq("reference_number", eventId)
        .limit(5);

      // Fetch payment_intents linked to this event
      const { data: intents } = await supabase
        .from("payment_intents")
        .select("id, invoice_id, amount, currency, provider, status, created_at, updated_at, provider_session_id")
        .eq("provider_session_id", eventId)
        .limit(5);

      setRelatedPayments(payments ?? []);
      setRelatedIntents(intents ?? []);
      setLoadingRelated(false);
    };
    loadRelated();
  }, [ev.provider_event_id]);

  return (
    <div className="space-y-4 text-xs">
      {/* Event details + headers */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <p className="font-semibold text-foreground">تفاصيل الحدث</p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Hash:</span>{" "}
            <span className="font-mono" dir="ltr">{ev.payload_hash ?? "—"}</span>
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Processed at:</span>{" "}
            {ev.processed_at ? new Date(ev.processed_at).toLocaleString("ar-SA") : "—"}
          </p>
          {ev.processing_error && (
            <p className="text-destructive mt-1 bg-destructive/5 rounded p-2">
              <span className="font-medium">خطأ:</span> {ev.processing_error}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <p className="font-semibold text-foreground">Headers المستلمة</p>
          {ev.raw_headers
            ? Object.entries(ev.raw_headers).map(([k, v]) => (
              <p key={k} className="font-mono text-[10px] break-all" dir="ltr">
                <span className="text-primary">{k}:</span>{" "}
                <span className="text-muted-foreground">{v}</span>
              </p>
            ))
            : <p className="text-muted-foreground">لا توجد headers محفوظة</p>}
        </div>
      </div>

      {/* Related invoice_payments */}
      <div className="border-t border-border pt-3">
        <p className="font-semibold text-foreground mb-2">💳 الدفعات المرتبطة (invoice_payments)</p>
        {loadingRelated ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : relatedPayments.length === 0 ? (
          <p className="text-muted-foreground">لا توجد دفعات مرتبطة بهذا الحدث</p>
        ) : (
          <div className="space-y-1">
            {relatedPayments.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 bg-muted/30 rounded p-2 font-mono text-[10px]" dir="ltr">
                <Badge variant="outline" className="text-[9px]">{p.payment_method}</Badge>
                <span>{p.amount} {p.currency}</span>
                <span className="text-muted-foreground">{p.payment_date}</span>
                <Badge variant={p.status === "completed" ? "default" : "secondary"} className="text-[9px]">
                  {p.status ?? "—"}
                </Badge>
                <span className="text-muted-foreground truncate max-w-[200px]">inv: {p.invoice_id}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Related payment_intents */}
      <div className="border-t border-border pt-3">
        <p className="font-semibold text-foreground mb-2">🔗 Payment Intents المرتبطة</p>
        {loadingRelated ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : relatedIntents.length === 0 ? (
          <p className="text-muted-foreground">لا توجد Payment Intents مرتبطة</p>
        ) : (
          <div className="space-y-1">
            {relatedIntents.map((pi: any) => (
              <div key={pi.id} className="flex items-center gap-3 bg-muted/30 rounded p-2 font-mono text-[10px]" dir="ltr">
                <span className="font-semibold capitalize">{pi.provider}</span>
                <span>{pi.amount} {pi.currency}</span>
                <Badge
                  variant={pi.status === "paid" ? "default" : pi.status === "failed" ? "destructive" : "secondary"}
                  className="text-[9px]"
                >
                  {pi.status}
                </Badge>
                <span className="text-muted-foreground">
                  {new Date(pi.created_at).toLocaleDateString("ar-SA")}
                  {pi.updated_at !== pi.created_at && ` → ${new Date(pi.updated_at).toLocaleDateString("ar-SA")}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


type WebhookStatus = "received" | "processing" | "processed" | "rejected" | "failed" | "duplicate";

interface WebhookEvent {
  id: string;
  provider: string;
  provider_event_id: string;
  tenant_id: string | null;
  status: WebhookStatus;
  signature_valid: boolean | null;
  payload_hash: string | null;
  received_at: string;
  processed_at: string | null;
  processing_error: string | null;
  raw_headers: Record<string, string> | null;
  payload: any;
}

const STATUS_CONFIG: Record<WebhookStatus, { label: string; icon: any; className: string }> = {
  received:   { label: "مستلم",   icon: Clock,        className: "bg-muted text-muted-foreground border-border" },
  processing: { label: "جاري",    icon: Loader2,      className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  processed:  { label: "ناجح ✓",  icon: CheckCircle2, className: "bg-green-500/10 text-green-600 border-green-500/20" },
  rejected:   { label: "مرفوض",   icon: XCircle,      className: "bg-destructive/10 text-destructive border-destructive/20" },
  failed:     { label: "فشل",     icon: AlertTriangle, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  duplicate:  { label: "مكرر",    icon: Copy,         className: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
};

const DebugWebhooks = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProvider, setFilterProvider] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTenant, setFilterTenant] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0, processed: 0, rejected: 0, failed: 0, duplicate: 0,
  });

  // Check platform admin
  useEffect(() => {
    if (!user) return;
    supabase.from("platform_admins").select("id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setIsPlatformAdmin(!!data));
  }, [user]);

  const load = useCallback(async () => {
    if (!isPlatformAdmin) return;
    setLoading(true);

    let query = supabase
      .from("webhook_events")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(100);

    if (filterProvider !== "all") query = query.eq("provider", filterProvider);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (filterTenant.trim()) query = query.eq("tenant_id", filterTenant.trim());

    const { data, error } = await query;
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      const rows = (data as WebhookEvent[]) || [];
      setEvents(rows);
      setStats({
        total: rows.length,
        processed: rows.filter((r) => r.status === "processed").length,
        rejected: rows.filter((r) => r.status === "rejected").length,
        failed: rows.filter((r) => r.status === "failed").length,
        duplicate: rows.filter((r) => r.status === "duplicate").length,
      });
    }
    setLoading(false);
  }, [isPlatformAdmin, filterProvider, filterStatus, filterTenant]);

  useEffect(() => { load(); }, [load]);

  if (!isPlatformAdmin) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] gap-4" dir="rtl">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">هذه الصفحة متاحة لمشرفي المنصة فقط.</p>
      </div>
    );
  }

  const StatusBadge = ({ status }: { status: WebhookStatus }) => {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.failed;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={cn("text-[10px] flex items-center gap-1 font-medium", cfg.className)}>
        <Icon size={10} className={status === "processing" ? "animate-spin" : ""} />
        {cfg.label}
      </Badge>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield size={20} className="text-primary" />
            تشخيص Webhook — بوابات الدفع
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">آخر 100 حدث • للمشرفين فقط</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          تحديث
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "الكل", value: stats.total, color: "text-foreground" },
          { label: "ناجح", value: stats.processed, color: "text-green-600" },
          { label: "مرفوض", value: stats.rejected, color: "text-destructive" },
          { label: "فشل", value: stats.failed, color: "text-amber-600" },
          { label: "مكرر", value: stats.duplicate, color: "text-purple-600" },
        ].map((s) => (
          <Card key={s.label} className="text-center py-3">
            <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={filterProvider} onValueChange={setFilterProvider}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="المزود" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المزودين</SelectItem>
                <SelectItem value="tap">Tap</SelectItem>
                <SelectItem value="moyasar">Moyasar</SelectItem>
                <SelectItem value="hyperpay">HyperPay</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="geidea">Geidea</SelectItem>
                <SelectItem value="paytabs">PayTabs</SelectItem>
                <SelectItem value="myfatoorah">MyFatoorah</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="tabby">Tabby</SelectItem>
                <SelectItem value="tamara">Tamara</SelectItem>
                <SelectItem value="telr">Telr</SelectItem>
                <SelectItem value="mispay">MISPAY</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {(Object.keys(STATUS_CONFIG) as WebhookStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="فلتر بـ Tenant ID"
              value={filterTenant}
              onChange={(e) => setFilterTenant(e.target.value)}
              className="h-8 text-xs w-72 font-mono"
              dir="ltr"
            />

            <Button size="sm" variant="outline" onClick={load} className="h-8 text-xs gap-1">
              <RefreshCw size={12} />
              بحث
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook URLs Reference */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Link2 size={14} className="text-primary" />
            روابط Webhooks — أعطها لكل مزود في لوحة تحكمه
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {WEBHOOK_URLS.map(({ provider, fn, header, note }) => {
            const url = `${FUNCTIONS_BASE}/${fn}?tenant_id=<UUID>`;
            return (
              <div key={fn} className="rounded-md border border-border bg-muted/30 p-3 space-y-1" dir="ltr">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">{provider}</span>
                  <button
                    className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                    onClick={() => { navigator.clipboard.writeText(url); toast({ title: "تم النسخ" }); }}
                  >
                    <Copy size={10} /> نسخ
                  </button>
                </div>
                <p className="font-mono text-[10px] text-primary break-all">{url}</p>
                <p className="text-[10px] text-muted-foreground">
                  Signature header: <code className="bg-muted px-1 rounded">{header}</code> — {note}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Security summary */}
      <Card className="border-dashed bg-muted/20">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-green-500" />
              التحقق من التوقيع: HMAC-SHA256 (per-provider, timing-safe)
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-green-500" />
              Idempotency: UNIQUE(provider, provider_event_id)
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-green-500" />
              Tenant isolation: tenant_id ← payment_intents lookup
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-green-500" />
              فحص المبلغ + العملة قبل تحديث الفاتورة
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              لا توجد أحداث بالفلاتر الحالية
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-[90px]">المزود</TableHead>
                    <TableHead className="w-[100px]">الحالة</TableHead>
                    <TableHead className="w-[80px] text-center">التوقيع</TableHead>
                    <TableHead>Event ID</TableHead>
                    <TableHead>Tenant ID</TableHead>
                    <TableHead>وقت الاستقبال</TableHead>
                    <TableHead>خطأ</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev) => (
                    <>
                      <TableRow
                        key={ev.id}
                        className="text-xs cursor-pointer hover:bg-muted/30"
                        onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                      >
                        <TableCell className="font-semibold capitalize">{ev.provider}</TableCell>
                        <TableCell><StatusBadge status={ev.status} /></TableCell>
                        <TableCell className="text-center">
                          {ev.signature_valid === true && <CheckCircle2 size={14} className="text-green-500 mx-auto" />}
                          {ev.signature_valid === false && <XCircle size={14} className="text-destructive mx-auto" />}
                          {ev.signature_valid === null && <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="font-mono text-[10px] max-w-[160px] truncate" dir="ltr">
                          {ev.provider_event_id}
                        </TableCell>
                        <TableCell className="font-mono text-[10px] max-w-[130px] truncate" dir="ltr">
                          {ev.tenant_id ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(ev.received_at).toLocaleString("ar-SA")}
                        </TableCell>
                        <TableCell className="text-destructive max-w-[200px] truncate text-[10px]">
                          {ev.processing_error ?? "—"}
                        </TableCell>
                        <TableCell>
                          {expandedId === ev.id
                            ? <ChevronUp size={14} className="text-muted-foreground" />
                            : <ChevronDown size={14} className="text-muted-foreground" />}
                        </TableCell>
                      </TableRow>

                      {expandedId === ev.id && (
                        <TableRow key={`${ev.id}-expanded`} className="bg-muted/20">
                          <TableCell colSpan={8} className="py-3 px-4">
                            <ExpandedEventDetails event={ev} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugWebhooks;
