import { useState, useMemo, useCallback } from "react";
import { DASHBOARD_ROUTES } from "@/routes/dashboard-routes";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, Merge, EyeOff, Trash2, RefreshCw, Loader2,
  Search, Download, Shield, Flag, AlertTriangle, Zap,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──

type Decision = "KEEP" | "MERGE" | "HIDE" | "DELETE";

interface RouteEntry {
  route: string;
  label: string;
  category: "dashboard" | "admin" | "debug";
  module: string;
  gateSegment: string;
  dataSources: string[];
  featureKey: string;
  isOpenRoute: boolean;
  isSystemRoute: boolean;
}

interface DecisionRow extends RouteEntry {
  decision: Decision;
  reason: string;
  usage30d: number;
  lastUsed: string | null;
  mergeTarget: string | null;
  flaggedForCleanup: boolean;
}

// ── Protected routes that should never be HIDE/DELETE ──

const PROTECTED_SEGMENTS = new Set([
  "subscription", "settings", "help", "support", "company",
  "compliance", "branding", "team", "permissions",
]);

const SYSTEM_ADMIN_PATHS = new Set([
  "/admin", "/admin/companies", "/admin/subscriptions", "/admin/users",
  "/admin/features", "/admin/security", "/admin/finance",
  "/admin/system/full-audit", "/admin/system/usage",
  "/admin/system/duplicates", "/admin/system/cleanup",
]);

// ── Admin + Debug route lists ──

const ADMIN_ROUTES_LIST = [
  { path: "/admin", label: "Admin Dashboard" },
  { path: "/admin/companies", label: "Companies" },
  { path: "/admin/subscriptions", label: "Subscriptions" },
  { path: "/admin/users", label: "Users" },
  { path: "/admin/features", label: "Feature Toggles" },
  { path: "/admin/security", label: "Security Center" },
  { path: "/admin/finance", label: "Finance" },
  { path: "/admin/templates", label: "Templates" },
  { path: "/admin/email-templates", label: "Email Templates" },
  { path: "/admin/email-center", label: "Email Center" },
  { path: "/admin/ai", label: "AI Assistant" },
  { path: "/admin/infrastructure", label: "Infrastructure" },
  { path: "/admin/platform-health", label: "Platform Health" },
  { path: "/admin/monitoring", label: "Monitoring" },
  { path: "/admin/paylink-fees", label: "Paylink Fees" },
  { path: "/admin/paylink-management", label: "Paylink Management" },
  { path: "/admin/support", label: "Support Tickets" },
  { path: "/admin/wallet-requests", label: "Wallet Requests" },
  { path: "/admin/discount-codes", label: "Discount Codes" },
  { path: "/admin/affiliates", label: "Affiliate Management" },
  { path: "/admin/integrations/docs", label: "Integration Docs" },
  { path: "/admin/system/full-audit", label: "Full System Audit" },
  { path: "/admin/system/usage", label: "Usage Analytics" },
  { path: "/admin/system/duplicates", label: "Duplicate Detection" },
  { path: "/admin/system/cleanup", label: "Cleanup Engine" },
];

const DEBUG_ROUTES_LIST = [
  { path: "/debug/rtl-lab", label: "RTL Lab" },
  { path: "/debug/perf", label: "Performance" },
  { path: "/debug/entitlements", label: "Entitlements" },
  { path: "/debug/feature-gates", label: "Feature Gates" },
  { path: "/debug/access-map", label: "Access Map" },
  { path: "/debug/rls-check", label: "RLS Check" },
  { path: "/debug/payment-providers", label: "Payment Providers" },
  { path: "/debug/webhooks", label: "Webhooks" },
  { path: "/debug/webhook-test", label: "Webhook Test" },
  { path: "/debug/workflows", label: "Workflows" },
  { path: "/debug/system-audit", label: "System Audit" },
];

// ── Helpers ──

function inferDataSources(path: string): string[] {
  const sources: string[] = [];
  if (path.includes("billing") || path.includes("invoices")) sources.push("invoices", "invoice_payments");
  else if (path.includes("contracts")) sources.push("contracts");
  else if (path.includes("expenses")) sources.push("expenses");
  else if (path.includes("customers")) sources.push("customers");
  else if (path.includes("inventory")) sources.push("inventory_items");
  else if (path.includes("journal")) sources.push("journal_entries");
  else if (path.includes("quotations")) sources.push("quotations");
  else if (path.includes("integrations")) sources.push("tenant_integrations");
  else if (path.includes("team")) sources.push("profiles");
  else if (path.includes("audit")) sources.push("audit_logs");
  else if (path.includes("analytics")) sources.push("analytics_daily_revenue");
  else if (path.includes("budgets")) sources.push("budgets", "budget_lines");
  else if (path.includes("wallet")) sources.push("wallet_transactions");
  else if (path.includes("chat")) sources.push("chat_messages");
  else if (path.includes("enterprise")) sources.push("legal_entities");
  else if (path.includes("reports")) sources.push("invoices", "expenses");
  return sources;
}

function buildAllRouteEntries(): RouteEntry[] {
  const entries: RouteEntry[] = [];

  for (const r of DASHBOARD_ROUTES) {
    const seg = r.gateSegment ?? r.path.split("/")[0];
    const mapping = ROUTE_FEATURE_MAP[seg];
    const isProtected = PROTECTED_SEGMENTS.has(seg);
    entries.push({
      route: `/dashboard/${r.path}`,
      label: mapping?.label ?? r.path,
      category: "dashboard",
      module: r.module ?? "—",
      gateSegment: seg || "—",
      dataSources: inferDataSources(r.path),
      featureKey: mapping?.featureKey ?? "—",
      isOpenRoute: !!r.isOpenRoute,
      isSystemRoute: isProtected || !!r.isOpenRoute,
    });
  }

  for (const r of ADMIN_ROUTES_LIST) {
    entries.push({
      route: r.path,
      label: r.label,
      category: "admin",
      module: "platform_admin",
      gateSegment: "PlatformAdminRoute",
      dataSources: ["platform_admins"],
      featureKey: "—",
      isOpenRoute: false,
      isSystemRoute: SYSTEM_ADMIN_PATHS.has(r.path),
    });
  }

  for (const r of DEBUG_ROUTES_LIST) {
    entries.push({
      route: r.path,
      label: r.label,
      category: "debug",
      module: "dev_only",
      gateSegment: "PlatformAdminRoute",
      dataSources: [],
      featureKey: "—",
      isOpenRoute: false,
      isSystemRoute: false,
    });
  }

  return entries;
}

// ── Decision Engine core ──

function findMergeTarget(entry: RouteEntry, allEntries: RouteEntry[]): string | null {
  if (entry.dataSources.length === 0) return null;
  for (const other of allEntries) {
    if (other.route === entry.route) continue;
    if (other.category !== entry.category) continue;
    // Same dataSources overlap
    const overlap = entry.dataSources.filter((d) => other.dataSources.includes(d));
    if (overlap.length > 0 && overlap.length >= entry.dataSources.length * 0.5) {
      // Prefer shorter route (more "primary")
      if (other.route.length < entry.route.length) return other.route;
    }
  }
  return null;
}

function runDecisionEngine(
  entries: RouteEntry[],
  usageMap: Record<string, number>,
  lastUsedMap: Record<string, string | null>,
): DecisionRow[] {
  const HIGH_USAGE_THRESHOLD = 5;

  return entries.map((entry) => {
    const usage = usageMap[entry.route] ?? 0;
    const lastUsed = lastUsedMap[entry.route] ?? null;
    const mergeTarget = findMergeTarget(entry, entries);
    let decision: Decision = "KEEP";
    let reason = "";

    // Rule 1: System/protected routes always KEEP
    if (entry.isSystemRoute) {
      decision = "KEEP";
      reason = "مسار نظامي / أساسي — محمي من التغيير";
    }
    // Rule 2: High usage → KEEP
    else if (usage >= HIGH_USAGE_THRESHOLD) {
      decision = "KEEP";
      reason = `استخدام عالي (${usage} مشاهدة خلال 30 يوم)`;
    }
    // Rule 3: Has clear merge target + shares dataSources → MERGE
    else if (mergeTarget && usage < HIGH_USAGE_THRESHOLD) {
      decision = "MERGE";
      reason = `بديل واضح: ${mergeTarget} — نفس مصادر البيانات`;
    }
    // Rule 4: Zero usage in 30 days + not system route → HIDE
    else if (usage === 0 && !entry.isSystemRoute) {
      decision = "HIDE";
      reason = "لا يوجد استخدام خلال 30 يوم — مرشح للإخفاء";
    }
    // Rule 5: Low usage with no merge target → KEEP (borderline)
    else {
      decision = "KEEP";
      reason = `استخدام منخفض (${usage}) — لا يوجد بديل واضح`;
    }

    // Rule 6: DELETE suggestion (HIDE candidates that would have a merge target)
    // This is a "soft" suggestion — never auto-executed
    if (decision === "HIDE" && mergeTarget) {
      decision = "DELETE";
      reason = `مخفي + بديل واضح (${mergeTarget}) — اقتراح حذف فقط`;
    }

    return {
      ...entry,
      decision,
      reason,
      usage30d: usage,
      lastUsed,
      mergeTarget,
      flaggedForCleanup: false,
    };
  });
}

// ── UI Helpers ──

const decisionConfig: Record<Decision, { icon: typeof CheckCircle2; label: string; badgeCls: string }> = {
  KEEP: { icon: CheckCircle2, label: "إبقاء", badgeCls: "bg-primary/10 text-primary border-primary/20" },
  MERGE: { icon: Merge, label: "دمج", badgeCls: "bg-accent/20 text-accent-foreground border-accent/30" },
  HIDE: { icon: EyeOff, label: "إخفاء", badgeCls: "border-yellow-500/30 text-yellow-600 bg-yellow-500/10" },
  DELETE: { icon: Trash2, label: "اقتراح حذف", badgeCls: "border-destructive/30 text-destructive bg-destructive/10" },
};

// ── Component ──

const CleanupEngine = () => {
  const [rows, setRows] = useState<DecisionRow[]>([]);
  const [running, setRunning] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  // Fetch 30-day usage data
  const { data: usageSummary = [] } = useQuery({
    queryKey: ["cleanup-usage-30"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_usage_summary", { p_days: 30 });
      if (error) return [];
      return (data || []) as { route: string; view_count: number; last_used: string }[];
    },
  });

  const usageMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const u of usageSummary) m[u.route] = u.view_count;
    return m;
  }, [usageSummary]);

  const lastUsedMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const u of usageSummary) m[u.route] = u.last_used;
    return m;
  }, [usageSummary]);

  const runEngine = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const entries = buildAllRouteEntries();
      const decisions = runDecisionEngine(entries, usageMap, lastUsedMap);
      setRows(decisions);
      setRunning(false);
      toast.success(`تم تحليل ${decisions.length} مسار`);
    }, 400);
  }, [usageMap, lastUsedMap]);

  const toggleFlag = (route: string) => {
    setRows((prev) => prev.map((r) =>
      r.route === route ? { ...r, flaggedForCleanup: !r.flaggedForCleanup } : r
    ));
  };

  // Stats
  const stats = useMemo(() => {
    const s = { total: rows.length, keep: 0, merge: 0, hide: 0, delete: 0, flagged: 0 };
    for (const r of rows) {
      s[r.decision.toLowerCase() as "keep" | "merge" | "hide" | "delete"]++;
      if (r.flaggedForCleanup) s.flagged++;
    }
    return s;
  }, [rows]);

  // Filtered rows
  const filtered = useMemo(() => {
    let result = rows;
    if (activeTab !== "all") result = result.filter((r) => r.decision === activeTab.toUpperCase());
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((r) =>
        r.route.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.module.toLowerCase().includes(q) ||
        r.reason.includes(q)
      );
    }
    return result;
  }, [rows, activeTab, query]);

  // Export
  const handleExport = () => {
    const data = {
      generatedAt: new Date().toISOString(),
      stats,
      decisions: rows.map(({ route, label, category, module, decision, reason, usage30d, lastUsed, mergeTarget, flaggedForCleanup }) => ({
        route, label, category, module, decision, reason, usage30d, lastUsed, mergeTarget, flaggedForCleanup,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cleanup-decisions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">محرك قرارات التنظيف</h1>
            <p className="text-sm text-muted-foreground">تحليل ذكي لكل مسار مع توصيات KEEP / MERGE / HIDE / DELETE</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExport} disabled={rows.length === 0} className="gap-2">
            <Download size={14} /> تصدير
          </Button>
          <Button size="sm" onClick={runEngine} disabled={running} className="gap-2">
            {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {running ? "جاري التحليل..." : "شغّل المحرك"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {([
            { label: "إجمالي", value: stats.total, icon: Shield, cls: "text-foreground" },
            { label: "إبقاء", value: stats.keep, icon: CheckCircle2, cls: "text-primary" },
            { label: "دمج", value: stats.merge, icon: Merge, cls: "text-accent-foreground" },
            { label: "إخفاء", value: stats.hide, icon: EyeOff, cls: "text-muted-foreground" },
            { label: "اقتراح حذف", value: stats.delete, icon: Trash2, cls: "text-destructive" },
            { label: "مرشح", value: stats.flagged, icon: Flag, cls: "text-primary" },
          ] as const).map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 flex items-center gap-2">
                <s.icon className={`h-4 w-4 shrink-0 ${s.cls}`} />
                <div>
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 && !running && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <Zap className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>اضغط "شغّل المحرك" لتحليل جميع المسارات واتخاذ القرارات</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs + Search + Table */}
      {rows.length > 0 && (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
              <TabsList>
                <TabsTrigger value="all">الكل ({stats.total})</TabsTrigger>
                <TabsTrigger value="keep">إبقاء ({stats.keep})</TabsTrigger>
                <TabsTrigger value="merge">دمج ({stats.merge})</TabsTrigger>
                <TabsTrigger value="hide">إخفاء ({stats.hide})</TabsTrigger>
                <TabsTrigger value="delete">حذف ({stats.delete})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pr-9"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>القرار</TableHead>
                    <TableHead>المسار</TableHead>
                    <TableHead>القسم</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead className="text-center">الاستخدام</TableHead>
                    <TableHead>الدمج مع</TableHead>
                    <TableHead>السبب</TableHead>
                    <TableHead className="text-center">ترشيح</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        لا توجد نتائج
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((row) => {
                      const cfg = decisionConfig[row.decision];
                      const Icon = cfg.icon;
                      return (
                        <TableRow key={row.route} className={row.flaggedForCleanup ? "bg-primary/5" : ""}>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] gap-1 ${cfg.badgeCls}`}>
                              <Icon size={11} />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{row.route}</code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[9px]">{row.category}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{row.module}</TableCell>
                          <TableCell className="text-center">
                            <span className={`font-semibold text-sm ${row.usage30d === 0 ? "text-destructive" : ""}`}>
                              {row.usage30d}
                            </span>
                          </TableCell>
                          <TableCell>
                            {row.mergeTarget ? (
                              <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{row.mergeTarget}</code>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <p className="text-xs text-muted-foreground max-w-[250px] truncate" title={row.reason}>
                              {row.reason}
                            </p>
                          </TableCell>
                          <TableCell className="text-center">
                            {row.decision !== "KEEP" && (
                              <Button
                                size="sm"
                                variant={row.flaggedForCleanup ? "default" : "ghost"}
                                className="h-7 w-7 p-0"
                                onClick={() => toggleFlag(row.route)}
                                title={row.flaggedForCleanup ? "إلغاء الترشيح" : "ترشيح للتنظيف"}
                              >
                                <Flag size={13} />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 rounded-lg border border-muted bg-muted/30 p-3">
            <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              هذا المحرك يقدم <strong>توصيات فقط</strong> — لا يتم تنفيذ أي حذف أو إخفاء فعلي.
              القرارات النهائية تتطلب مراجعة يدوية وموافقة الفريق التقني.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default CleanupEngine;
