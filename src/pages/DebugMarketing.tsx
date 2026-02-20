/**
 * DebugMarketing — صفحة تشخيص تسويق للمشرف
 * آخر 50 سجل لكل provider + أزرار إرسال واختبار
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Loader2, RefreshCw, Send, TestTube, History, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Plug, AlertCircle, Database, Activity,
} from "lucide-react";

// ── Providers ─────────────────────────────────────────────────────────────────
const PROVIDERS = [
  { id: "meta_pixel_capi", name: "Meta Pixel + CAPI", logo: "/brands/marketing/meta.svg", color: "bg-blue-500/10" },
  { id: "facebook_capi", name: "Facebook CAPI", logo: "/brands/marketing/facebook.svg", color: "bg-blue-600/10" },
  { id: "meta_catalog", name: "Meta Catalog", logo: "/brands/marketing/meta.svg", color: "bg-blue-500/10" },
  { id: "x_pixel", name: "X Pixel", logo: "/brands/marketing/x.svg", color: "bg-gray-800/10" },
  { id: "x_catalog", name: "X Catalog", logo: "/brands/marketing/x.svg", color: "bg-gray-800/10" },
  { id: "gtm", name: "Google Tag Manager", logo: "/brands/marketing/google-tag-manager.svg", color: "bg-blue-400/10" },
  { id: "google_ads", name: "Google Ads", logo: "/brands/marketing/google-ads.svg", color: "bg-green-400/10" },
  { id: "tiktok_capi", name: "TikTok CAPI", logo: "/brands/marketing/tiktok.svg", color: "bg-pink-500/10" },
] as const;

type ProviderId = typeof PROVIDERS[number]["id"];

interface LogEntry {
  id: string;
  provider: string;
  action: string;
  event_name: string | null;
  status_code: number | null;
  response_body: string | null;
  duration_ms: number | null;
  idempotency_key: string | null;
  created_at: string;
}

interface Integration {
  provider: string;
  status: string;
  environment: string;
  updated_at: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; class: string }> = {
    active: { label: "نشط", class: "bg-green-500/10 text-green-600 border-green-500/20" },
    disabled: { label: "معطّل", class: "bg-muted text-muted-foreground" },
    disconnected: { label: "غير مُعدّ", class: "bg-muted/30 text-muted-foreground border-border/30" },
    draft: { label: "مسودة", class: "bg-amber-500/10 text-amber-600" },
  };
  const s = map[status] ?? map.disconnected;
  return <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5", s.class)}>{s.label}</Badge>;
};

const LogRow = ({ log }: { log: LogEntry }) => {
  const [open, setOpen] = useState(false);
  const ok = log.status_code != null && log.status_code < 300;
  return (
    <div className="border-b border-border/30 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/20 transition-colors text-start"
      >
        <span className={cn("h-2 w-2 rounded-full shrink-0", ok ? "bg-green-500" : log.status_code ? "bg-destructive" : "bg-amber-500")} />
        <span className="font-mono font-medium min-w-[140px]">{log.event_name ?? log.action}</span>
        <span className="text-muted-foreground font-mono">{log.status_code ? `HTTP ${log.status_code}` : "—"}</span>
        <span className="text-muted-foreground">{log.duration_ms ? `${log.duration_ms}ms` : "—"}</span>
        <span className="text-muted-foreground ms-auto whitespace-nowrap shrink-0">{new Date(log.created_at).toLocaleString("ar-SA")}</span>
        {open ? <ChevronUp size={12} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={12} className="shrink-0 text-muted-foreground" />}
      </button>
      {open && log.response_body && (
        <div className="px-3 pb-3">
          <pre className="text-[10px] bg-muted/40 rounded p-2 overflow-x-auto font-mono text-start max-h-32" dir="ltr">
            {log.response_body}
          </pre>
          {log.idempotency_key && (
            <p className="text-[10px] text-muted-foreground mt-1" dir="ltr">idempotency: {log.idempotency_key}</p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Provider Panel ─────────────────────────────────────────────────────────────
const ProviderPanel = ({ providerId, tenantId, supabaseUrl }: { providerId: ProviderId; tenantId: string; supabaseUrl: string }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [testingConn, setTestingConn] = useState(false);
  const [sendingEvent, setSendingEvent] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoadingLogs(true);
    const [logsRes, intRes] = await Promise.all([
      supabase
        .from("marketing_events_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider", providerId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("marketing_integrations")
        .select("provider, status, environment, updated_at")
        .eq("tenant_id", tenantId)
        .eq("provider", providerId)
        .single(),
    ]);
    setLogs((logsRes.data ?? []) as LogEntry[]);
    setIntegration((intRes.data as Integration) ?? null);
    setLoadingLogs(false);
  }, [tenantId, providerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTestConnection = async () => {
    setTestingConn(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/marketing-test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ provider: providerId }),
      });
      const data = await res.json() as { success: boolean; message: string };
      setTestResult(data);
      toast({ title: data.success ? "✅ اتصال ناجح" : "❌ فشل الاتصال", description: data.message });
      await fetchData();
    } catch (err) {
      setTestResult({ success: false, message: String(err) });
    } finally { setTestingConn(false); }
  };

  const handleSendTestEvent = async () => {
    setSendingEvent(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/marketing-send-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          provider: providerId,
          event_name: "Purchase",
          payload: { value: 1, currency: "SAR", order_id: `DEBUG-${Date.now()}` },
          idempotency_key: `debug-${providerId}-${Date.now()}`,
        }),
      });
      const data = await res.json() as { success: boolean; duration_ms?: number; error?: string };
      setTestResult({
        success: data.success,
        message: data.success ? `✅ تم الإرسال — ${data.duration_ms ?? 0}ms` : `❌ ${data.error ?? "فشل"}`,
      });
      toast({ title: data.success ? "✅ حدث تجريبي أُرسل" : "❌ فشل الإرسال" });
      await fetchData();
    } catch (err) {
      setTestResult({ success: false, message: String(err) });
    } finally { setSendingEvent(false); }
  };

  const isConfigured = integration !== null;
  const isActive = integration?.status === "active";

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40 flex-wrap">
        <StatusBadge status={integration?.status ?? "disconnected"} />
        {integration && (
          <>
            <span className="text-xs text-muted-foreground">{integration.environment === "live" ? "🚀 إنتاج" : "🧪 اختبار"}</span>
            <span className="text-xs text-muted-foreground">آخر تحديث: {new Date(integration.updated_at).toLocaleString("ar-SA")}</span>
          </>
        )}
        {!isConfigured && <span className="text-xs text-muted-foreground">لم يُعدّ هذا التكامل بعد</span>}
        <div className="flex gap-2 ms-auto flex-wrap">
          <Button size="sm" variant="outline" onClick={handleTestConnection} disabled={testingConn || !isConfigured} className="gap-1 text-xs h-7">
            {testingConn ? <Loader2 size={12} className="animate-spin" /> : <TestTube size={12} />}
            اختبار الاتصال
          </Button>
          <Button size="sm" variant="outline" onClick={handleSendTestEvent} disabled={sendingEvent || !isActive} className="gap-1 text-xs h-7">
            {sendingEvent ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            إرسال حدث تجريبي
          </Button>
          <Button size="sm" variant="ghost" onClick={fetchData} disabled={loadingLogs} className="gap-1 text-xs h-7">
            {loadingLogs ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </Button>
        </div>
      </div>

      {testResult && (
        <div className={cn("flex items-start gap-2 p-3 rounded-lg text-sm", testResult.success ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive")}>
          {testResult.success ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
          {testResult.message}
        </div>
      )}

      {/* Logs */}
      <div className="border border-border/40 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border/30">
          <History size={13} className="text-muted-foreground" />
          <span className="text-xs font-medium">آخر {logs.length} سجل</span>
        </div>
        {loadingLogs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8">
            <History size={28} className="text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">لا توجد سجلات لهذا المزود</p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-80">
            {logs.map((log) => <LogRow key={log.id} log={log} />)}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const DebugMarketing = () => {
  const { user } = useAuth();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [activeTab, setActiveTab] = useState(PROVIDERS[0].id as string);

  // Load tenant
  useEffect(() => {
    if (!user) return;
    supabase.from("tenant_members").select("tenant_id").limit(1).then(({ data }) => {
      if (data?.[0]) setTenantId((data[0] as { tenant_id: string }).tenant_id);
    });
  }, [user?.id]);

  // Load all data
  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoadingAll(true);
    const [logsRes, intRes] = await Promise.all([
      supabase
        .from("marketing_events_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("marketing_integrations")
        .select("provider, status, environment, updated_at")
        .eq("tenant_id", tenantId),
    ]);
    setAllLogs((logsRes.data ?? []) as LogEntry[]);
    setIntegrations((intRes.data ?? []) as Integration[]);
    setLoadingAll(false);
  }, [tenantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredLogs = selectedProvider === "all" ? allLogs : allLogs.filter((l) => l.provider === selectedProvider);

  const activeCount = integrations.filter((i) => i.status === "active").length;
  const configuredCount = integrations.length;
  const totalLogs = allLogs.length;
  const successLogs = allLogs.filter((l) => l.status_code && l.status_code < 300).length;

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Activity size={20} className="text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">مركز تشخيص التسويق</h1>
          <p className="text-sm text-muted-foreground">سجلات الأحداث + اختبار الاتصال + إرسال تجريبي لجميع مزودي التسويق</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loadingAll} className="gap-1.5 ms-auto">
          {loadingAll ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          تحديث الكل
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي السجلات", value: totalLogs, icon: Database, color: "text-accent" },
          { label: "إجمالي النجاح", value: `${successLogs}/${totalLogs}`, icon: CheckCircle2, color: "text-green-500" },
          { label: "تكاملات مُعدّة", value: configuredCount, icon: Plug, color: "text-blue-500" },
          { label: "نشطة", value: activeCount, icon: Activity, color: "text-emerald-500" },
        ].map((stat) => (
          <Card key={stat.label} className="p-3">
            <div className="flex items-center gap-2">
              <stat.icon size={18} className={stat.color} />
              <div>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs: per-provider + all-logs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center gap-3 flex-wrap">
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            {PROVIDERS.map((p) => {
              const int = integrations.find((i) => i.provider === p.id);
              const logCount = allLogs.filter((l) => l.provider === p.id).length;
              return (
                <TabsTrigger key={p.id} value={p.id} className="gap-1.5 text-xs">
                  <img src={p.logo} alt={p.name} className="w-4 h-4 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  {p.name.split(" ")[0]}
                  {int?.status === "active" && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                  {logCount > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">{logCount}</Badge>}
                </TabsTrigger>
              );
            })}
            <TabsTrigger value="all_logs" className="gap-1.5 text-xs">
              <History size={12} />
              كل السجلات
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Per-provider tabs */}
        {PROVIDERS.map((p) => (
          <TabsContent key={p.id} value={p.id} className="space-y-4 mt-4">
            <div className="flex items-center gap-3 mb-4">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border border-border/30", p.color)}>
                <img src={p.logo} alt={p.name} className="w-6 h-6 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
              <h2 className="font-bold text-foreground">{p.name}</h2>
              <Badge variant="outline" className="text-xs font-mono" dir="ltr">{p.id}</Badge>
            </div>
            <ProviderPanel providerId={p.id as ProviderId} tenantId={tenantId} supabaseUrl={supabaseUrl} />
          </TabsContent>
        ))}

        {/* All logs */}
        <TabsContent value="all_logs" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-bold text-foreground">جميع السجلات</h2>
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="w-48 text-xs h-8" dir="rtl">
                <SelectValue placeholder="فلتر حسب المزود" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">كل المزودين</SelectItem>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-xs">{filteredLogs.length} سجل</Badge>
          </div>

          {loadingAll ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle size={32} className="text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">لا توجد سجلات</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="grid grid-cols-[auto_1fr_80px_80px_80px_140px] items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border/30 text-[10px] font-semibold text-muted-foreground">
                  <span />
                  <span>الحدث / العملية</span>
                  <span>المزود</span>
                  <span>HTTP</span>
                  <span>المدة</span>
                  <span>التوقيت</span>
                </div>
                <div className="overflow-y-auto max-h-[500px] divide-y divide-border/20">
                  {filteredLogs.map((log) => {
                    const ok = log.status_code != null && log.status_code < 300;
                    const provider = PROVIDERS.find((p) => p.id === log.provider);
                    return (
                      <div key={log.id} className="grid grid-cols-[auto_1fr_80px_80px_80px_140px] items-center gap-2 px-3 py-2 text-xs hover:bg-muted/10">
                        <span className={cn("h-2 w-2 rounded-full shrink-0", ok ? "bg-green-500" : log.status_code ? "bg-destructive" : "bg-amber-500")} />
                        <div>
                          <p className="font-mono font-medium truncate">{log.event_name ?? log.action}</p>
                          {log.response_body && <p className="text-muted-foreground truncate text-[10px]" dir="ltr">{log.response_body.slice(0, 60)}</p>}
                        </div>
                        <span className="text-muted-foreground text-[10px] font-mono truncate">{provider?.name.split(" ")[0] ?? log.provider}</span>
                        <span className="text-muted-foreground font-mono">{log.status_code ? `${log.status_code}` : "—"}</span>
                        <span className="text-muted-foreground">{log.duration_ms ? `${log.duration_ms}ms` : "—"}</span>
                        <span className="text-muted-foreground text-[10px] whitespace-nowrap">{new Date(log.created_at).toLocaleString("ar-SA")}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DebugMarketing;
