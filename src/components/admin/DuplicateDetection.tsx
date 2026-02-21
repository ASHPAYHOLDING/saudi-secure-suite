import { useState, useMemo, useCallback } from "react";
import { DASHBOARD_ROUTES, type DashboardRouteConfig } from "@/routes/dashboard-routes";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Copy, Merge, EyeOff, Trash2, AlertTriangle, CheckCircle2,
  RefreshCw, Loader2, ChevronDown, ChevronRight, Flag,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──

type Recommendation = "merge" | "keep" | "hide" | "delete";
type RiskLevel = "low" | "medium" | "high";

interface RouteInfo {
  route: string;
  label: string;
  category: "dashboard" | "admin" | "debug";
  module: string;
  gateSegment: string;
  permissionKey: string;
  dataSources: string[];
  featureKey: string;
  componentPath: string;
}

interface DuplicateGroup {
  id: string;
  reason: string;
  similarity: number; // 0-100
  routes: RouteInfo[];
  recommendation: Recommendation;
  risk: RiskLevel;
  markedForCleanup: boolean;
}

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

// ── Helpers to extract component import path from lazy loaders ──

function getComponentName(el: React.LazyExoticComponent<any>): string {
  const str = el?.toString?.() || "";
  // Try extracting from _payload or displayName
  try {
    const payload = (el as any)?._payload;
    const init = (el as any)?._init;
    if (payload?._result?.default?.name) return payload._result.default.name;
  } catch {}
  return "Unknown";
}

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

// ── Build all RouteInfo entries ──

function buildAllRoutes(): RouteInfo[] {
  const routes: RouteInfo[] = [];

  // Dashboard routes (with rich metadata)
  for (const r of DASHBOARD_ROUTES) {
    const seg = r.gateSegment ?? r.path.split("/")[0];
    const mapping = ROUTE_FEATURE_MAP[seg];
    routes.push({
      route: `/dashboard/${r.path}`,
      label: mapping?.label ?? r.path,
      category: "dashboard",
      module: r.module ?? "—",
      gateSegment: seg || "—",
      permissionKey: r.permissionKey ?? mapping?.permissionKeys?.[0] ?? "—",
      dataSources: inferDataSources(r.path),
      featureKey: mapping?.featureKey ?? "—",
      componentPath: r.path,
    });
  }

  // Admin routes
  for (const r of ADMIN_ROUTES_LIST) {
    routes.push({
      route: r.path,
      label: r.label,
      category: "admin",
      module: "platform_admin",
      gateSegment: "PlatformAdminRoute",
      permissionKey: "is_platform_admin()",
      dataSources: ["platform_admins"],
      featureKey: "—",
      componentPath: r.label.replace(/\s/g, ""),
    });
  }

  // Debug routes
  for (const r of DEBUG_ROUTES_LIST) {
    routes.push({
      route: r.path,
      label: r.label,
      category: "debug",
      module: "dev_only",
      gateSegment: "PlatformAdminRoute",
      permissionKey: "is_platform_admin()",
      dataSources: [],
      featureKey: "—",
      componentPath: r.label.replace(/\s/g, ""),
    });
  }

  return routes;
}

// ── Similarity detection engine ──

function computeSimilarity(a: RouteInfo, b: RouteInfo): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Route name similarity (path segments)
  const aSegs = a.route.split("/").filter(Boolean);
  const bSegs = b.route.split("/").filter(Boolean);
  const commonSegs = aSegs.filter((s) => bSegs.includes(s));
  if (commonSegs.length >= 2) {
    score += 20;
    reasons.push(`مسارات مشتركة: ${commonSegs.join("/")}`);
  }

  // 2. Same gateSegment
  if (a.gateSegment === b.gateSegment && a.gateSegment !== "—") {
    score += 25;
    reasons.push(`نفس Gate: ${a.gateSegment}`);
  }

  // 3. Same module
  if (a.module === b.module && a.module !== "—") {
    score += 15;
    reasons.push(`نفس Module: ${a.module}`);
  }

  // 4. Same featureKey
  if (a.featureKey === b.featureKey && a.featureKey !== "—") {
    score += 15;
    reasons.push(`نفس FeatureKey: ${a.featureKey}`);
  }

  // 5. Same permissionKey
  if (a.permissionKey === b.permissionKey && a.permissionKey !== "—" && a.permissionKey !== "is_platform_admin()") {
    score += 10;
    reasons.push(`نفس Permission: ${a.permissionKey}`);
  }

  // 6. Overlapping dataSources
  const commonDS = a.dataSources.filter((d) => b.dataSources.includes(d));
  if (commonDS.length > 0) {
    score += Math.min(15, commonDS.length * 8);
    reasons.push(`بيانات مشتركة: ${commonDS.join(", ")}`);
  }

  return { score: Math.min(100, score), reasons };
}

function detectDuplicateGroups(routes: RouteInfo[]): DuplicateGroup[] {
  const THRESHOLD = 40;
  const groups: DuplicateGroup[] = [];
  const used = new Set<string>();

  for (let i = 0; i < routes.length; i++) {
    if (used.has(routes[i].route)) continue;
    const members: { route: RouteInfo; score: number; reasons: string[] }[] = [];

    for (let j = i + 1; j < routes.length; j++) {
      if (used.has(routes[j].route)) continue;
      // Skip comparing across categories (admin vs dashboard won't be duplicates)
      if (routes[i].category !== routes[j].category) continue;
      
      const { score, reasons } = computeSimilarity(routes[i], routes[j]);
      if (score >= THRESHOLD) {
        members.push({ route: routes[j], score, reasons });
      }
    }

    if (members.length > 0) {
      const allRoutes = [routes[i], ...members.map((m) => m.route)];
      const avgScore = Math.round(members.reduce((s, m) => s + m.score, 0) / members.length);
      const allReasons = [...new Set(members.flatMap((m) => m.reasons))];

      used.add(routes[i].route);
      members.forEach((m) => used.add(m.route.route));

      const recommendation = getRecommendation(allRoutes, avgScore);
      const risk = getRiskLevel(allRoutes, avgScore);

      groups.push({
        id: `grp-${i}`,
        reason: allReasons.join(" | "),
        similarity: avgScore,
        routes: allRoutes,
        recommendation,
        risk,
        markedForCleanup: false,
      });
    }
  }

  return groups.sort((a, b) => b.similarity - a.similarity);
}

function getRecommendation(routes: RouteInfo[], score: number): Recommendation {
  // Same component or very high similarity → merge
  if (score >= 70) return "merge";
  // Moderate similarity with same data sources → hide one
  if (score >= 50) return "hide";
  // Low similarity → keep both
  return "keep";
}

function getRiskLevel(routes: RouteInfo[], score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  return "low";
}

// ── UI Helpers ──

const recIcon = (r: Recommendation) => {
  switch (r) {
    case "merge": return <Merge size={14} className="text-primary" />;
    case "keep": return <CheckCircle2 size={14} className="text-muted-foreground" />;
    case "hide": return <EyeOff size={14} className="text-yellow-500" />;
    case "delete": return <Trash2 size={14} className="text-destructive" />;
  }
};

const recLabel: Record<Recommendation, string> = {
  merge: "دمج",
  keep: "إبقاء",
  hide: "إخفاء",
  delete: "حذف",
};

const riskBadge = (r: RiskLevel) => {
  const cls = r === "high" ? "border-destructive/30 text-destructive"
    : r === "medium" ? "border-yellow-500/30 text-yellow-600"
    : "border-muted text-muted-foreground";
  const label = r === "high" ? "عالي" : r === "medium" ? "متوسط" : "منخفض";
  return <Badge variant="outline" className={`text-[10px] ${cls}`}>{label}</Badge>;
};

// ── Component ──

const DuplicateDetection = () => {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [running, setRunning] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Usage data for enrichment
  const { data: usageData = [] } = useQuery({
    queryKey: ["usage-summary-dup", 30],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_usage_summary", { p_days: 30 });
      if (error) return [];
      return (data || []) as { route: string; view_count: number }[];
    },
  });

  const usageMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const u of usageData) m[u.route] = u.view_count;
    return m;
  }, [usageData]);

  const runDetection = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const allRoutes = buildAllRoutes();
      const detected = detectDuplicateGroups(allRoutes);
      // Refine recommendations based on usage
      for (const g of detected) {
        const usages = g.routes.map((r) => usageMap[r.route] ?? 0);
        const hasZeroUsage = usages.some((u) => u === 0);
        const allZero = usages.every((u) => u === 0);
        if (allZero && g.recommendation !== "keep") {
          g.recommendation = "delete";
          g.risk = "low";
        } else if (hasZeroUsage && g.similarity >= 50) {
          g.recommendation = "merge";
        }
      }
      setGroups(detected);
      setRunning(false);
      toast.success(`تم اكتشاف ${detected.length} مجموعة تكرار`);
    }, 300);
  }, [usageMap]);

  const toggleGroup = (id: string) => setExpandedGroups((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const markForCleanup = (id: string) => {
    setGroups((prev) => prev.map((g) =>
      g.id === id ? { ...g, markedForCleanup: !g.markedForCleanup } : g
    ));
    toast.success("تم تحديث حالة المرشح للتنظيف");
  };

  const stats = useMemo(() => ({
    total: groups.length,
    merge: groups.filter((g) => g.recommendation === "merge").length,
    hide: groups.filter((g) => g.recommendation === "hide").length,
    delete: groups.filter((g) => g.recommendation === "delete").length,
    keep: groups.filter((g) => g.recommendation === "keep").length,
    marked: groups.filter((g) => g.markedForCleanup).length,
  }), [groups]);

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Copy className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">كشف التكرارات</h1>
            <p className="text-sm text-muted-foreground">تحليل ذكي للمسارات المتشابهة والمكررة</p>
          </div>
        </div>
        <Button size="sm" onClick={runDetection} disabled={running} className="gap-2">
          {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {running ? "جاري الفحص..." : "ابدأ الفحص"}
        </Button>
      </div>

      {/* Stats */}
      {groups.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: "مجموعات", value: stats.total, icon: Copy },
            { label: "دمج", value: stats.merge, icon: Merge },
            { label: "إخفاء", value: stats.hide, icon: EyeOff },
            { label: "حذف", value: stats.delete, icon: Trash2 },
            { label: "إبقاء", value: stats.keep, icon: CheckCircle2 },
            { label: "مرشح للتنظيف", value: stats.marked, icon: Flag },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 flex items-center gap-2">
                <s.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Groups */}
      {groups.length === 0 && !running && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            اضغط "ابدأ الفحص" لتحليل جميع المسارات واكتشاف التكرارات
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.id);
          return (
            <Card key={group.id} className={group.markedForCleanup ? "border-primary/50 bg-primary/5" : ""}>
              <CardHeader className="p-4 cursor-pointer" onClick={() => toggleGroup(group.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <div className="flex items-center gap-2">
                      {recIcon(group.recommendation)}
                      <span className="font-semibold text-sm">
                        {group.routes.length} مسارات متشابهة
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      تشابه {group.similarity}%
                    </Badge>
                    {riskBadge(group.risk)}
                    <Badge variant="outline" className="text-[10px]">
                      {recLabel[group.recommendation]}
                    </Badge>
                    {group.markedForCleanup && (
                      <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">
                        <Flag size={10} className="ml-1" /> مرشح للتنظيف
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={group.markedForCleanup ? "default" : "outline"}
                    className="gap-1 text-xs"
                    onClick={(e) => { e.stopPropagation(); markForCleanup(group.id); }}
                  >
                    <Flag size={12} />
                    {group.markedForCleanup ? "إلغاء" : "ترشيح"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1 mr-7">{group.reason}</p>
              </CardHeader>
              {isExpanded && (
                <CardContent className="p-0 pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المسار</TableHead>
                        <TableHead>القسم</TableHead>
                        <TableHead>Module</TableHead>
                        <TableHead>Gate</TableHead>
                        <TableHead>Permission</TableHead>
                        <TableHead>مصادر البيانات</TableHead>
                        <TableHead className="text-center">الاستخدام (30 يوم)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.routes.map((r) => (
                        <TableRow key={r.route}>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.route}</code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[9px]">{r.category}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{r.module}</TableCell>
                          <TableCell className="text-xs font-mono">{r.gateSegment}</TableCell>
                          <TableCell className="text-xs font-mono">{r.permissionKey}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {r.dataSources.length > 0
                                ? r.dataSources.map((d) => (
                                    <Badge key={d} variant="outline" className="text-[9px]">{d}</Badge>
                                  ))
                                : <span className="text-xs text-muted-foreground">—</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-semibold text-sm ${(usageMap[r.route] ?? 0) === 0 ? "text-destructive" : ""}`}>
                              {usageMap[r.route] ?? 0}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default DuplicateDetection;
