import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Download, Search, AlertTriangle, CheckCircle2, XCircle,
  Shield, Users, Crown, Eye, EyeOff, Merge, Trash2, ArrowRight,
  BarChart3, Activity, TrendingDown, Clock,
} from "lucide-react";
import { DASHBOARD_ROUTES, type DashboardRouteConfig } from "@/routes/dashboard-routes";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";

/* ────────────────────────────────────────────────
   Types
──────────────────────────────────────────────── */
type GateStatus = "OK" | "WARN" | "FAIL";
type Zone = "dashboard" | "admin" | "debug";
type Visibility = "client" | "admin" | "super";
type Decision = "KEEP_CLIENT" | "KEEP_ADMIN" | "KEEP_SUPER" | "HIDE" | "MERGE" | "DELETE";

interface AuditRow {
  route: string;
  label: string;
  zone: Zone;
  visibility: Visibility;
  gateSegment?: string;
  module?: string;
  featureKey?: string;
  permissionKey?: string;
  isOpenRoute?: boolean;
  gateStatus: GateStatus;
  warnings: string[];
  componentPath: string;
  sidebarGroup?: string;
  inSidebar: boolean;
  proposedZone: "Client" | "Admin" | "Super Admin";
  decision: Decision;
  decisionReason: string;
}

/* ────────────────────────────────────────────────
   Admin Routes (from Admin.tsx)
──────────────────────────────────────────────── */
const ADMIN_ROUTES = [
  { path: "/admin", label: "لوحة التحكم" },
  { path: "/admin/companies", label: "الشركات" },
  { path: "/admin/subscriptions", label: "الاشتراكات" },
  { path: "/admin/users", label: "المستخدمين" },
  { path: "/admin/features", label: "المميزات" },
  { path: "/admin/security", label: "الأمان والتدقيق" },
  { path: "/admin/finance", label: "المراقبة المالية" },
  { path: "/admin/templates", label: "إدارة القوالب" },
  { path: "/admin/email-templates", label: "قوالب البريد" },
  { path: "/admin/email-center", label: "مركز البريد" },
  { path: "/admin/ai", label: "المستشار الذكي" },
  { path: "/admin/infrastructure", label: "البنية التحتية" },
  { path: "/admin/platform-health", label: "صحة المنصة" },
  { path: "/admin/monitoring", label: "مركز المراقبة" },
  { path: "/admin/paylink-fees", label: "رسوم الدفع" },
  { path: "/admin/paylink-management", label: "إدارة نيوماكسيو باي" },
  { path: "/admin/support", label: "تذاكر الدعم" },
  { path: "/admin/wallet-requests", label: "طلبات شحن المحفظة" },
  { path: "/admin/discount-codes", label: "أكواد الخصم" },
  { path: "/admin/affiliates", label: "إدارة الشركاء" },
  { path: "/admin/integrations/docs", label: "توثيق التكاملات" },
  { path: "/admin/system/full-audit", label: "تدقيق النظام" },
  { path: "/admin/system/usage", label: "تحليلات الاستخدام" },
  { path: "/admin/system/duplicates", label: "كشف التكرارات" },
  { path: "/admin/system/architecture-audit", label: "تدقيق الهيكلة" },
  { path: "/admin/system/storage", label: "تقرير التخزين (Phase A)" },
  { path: "/admin/system/migrations", label: "لوحة الترحيلات (Phase A)" },
  { path: "/admin/system/infrastructure", label: "البنية التحتية للنظام (Phase A)" },
];

const DEBUG_ROUTES = [
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

/* Dashboard sidebar items for cross-reference */
const DASHBOARD_SIDEBAR_PATHS = new Set([
  "/dashboard", "/dashboard/customers", "/dashboard/billing", "/dashboard/credit-notes",
  "/dashboard/quotations", "/dashboard/sales-orders", "/dashboard/contracts",
  "/dashboard/purchase-orders", "/dashboard/delivery-notes", "/dashboard/supplier-inbox",
  "/dashboard/inventory", "/dashboard/expenses", "/dashboard/finance",
  "/dashboard/journal-entries", "/dashboard/period-lock", "/dashboard/cost-profit-centers",
  "/dashboard/finance/corporate-structure", "/dashboard/finance/coa",
  "/dashboard/finance/journal", "/dashboard/finance/period-close",
  "/dashboard/finance/statements", "/dashboard/enterprise/approvals/journal",
  "/dashboard/enterprise/finance-repair", "/dashboard/budgets",
  "/dashboard/payment-reminders", "/dashboard/data-quality", "/dashboard/vat-return",
  "/dashboard/wallet", "/dashboard/numaxio-pay", "/dashboard/affiliate",
  "/dashboard/reports", "/dashboard/report-builder", "/dashboard/scheduled-reports",
  "/dashboard/analytics", "/dashboard/analytics/executive", "/dashboard/forecasting",
  "/dashboard/smart-query", "/dashboard/sheet-view",
  "/dashboard/productivity", "/dashboard/approvals", "/dashboard/my-approvals",
  "/dashboard/workflows/designer", "/dashboard/chat", "/dashboard/team",
  "/dashboard/integrations", "/dashboard/integrations/marketplace",
  "/dashboard/integrations/payments", "/dashboard/api-keys", "/dashboard/subscription",
  "/dashboard/enterprise", "/dashboard/enterprise/security-policies",
  "/dashboard/enterprise/sessions", "/dashboard/enterprise/ip-restrictions",
  "/dashboard/enterprise/role-templates", "/dashboard/enterprise/audit-export",
  "/dashboard/governance", "/dashboard/system/storage", "/dashboard/system/migrations",
  "/dashboard/company", "/dashboard/branches", "/dashboard/group",
  "/dashboard/branding", "/dashboard/compliance", "/dashboard/stamp",
  "/dashboard/audit", "/dashboard/audit/intelligence", "/dashboard/sso-settings",
  "/dashboard/permissions", "/dashboard/settings", "/dashboard/support", "/dashboard/help",
]);

const ADMIN_SIDEBAR_PATHS = new Set(ADMIN_ROUTES.map(r => r.path));

/* ────────────────────────────────────────────────
   Sidebar group mapping for dashboard routes
──────────────────────────────────────────────── */
function getDashboardSidebarGroup(path: string): string | undefined {
  const salesPaths = ["/dashboard/customers", "/dashboard/billing", "/dashboard/credit-notes", "/dashboard/quotations", "/dashboard/sales-orders", "/dashboard/contracts"];
  const purchasingPaths = ["/dashboard/purchase-orders", "/dashboard/delivery-notes", "/dashboard/supplier-inbox", "/dashboard/inventory"];
  const financePaths = ["/dashboard/expenses", "/dashboard/finance", "/dashboard/journal-entries", "/dashboard/period-lock", "/dashboard/cost-profit-centers", "/dashboard/finance/corporate-structure", "/dashboard/finance/coa", "/dashboard/finance/journal", "/dashboard/finance/period-close", "/dashboard/finance/statements", "/dashboard/enterprise/approvals/journal", "/dashboard/enterprise/finance-repair", "/dashboard/budgets", "/dashboard/payment-reminders", "/dashboard/data-quality", "/dashboard/vat-return", "/dashboard/wallet", "/dashboard/numaxio-pay", "/dashboard/affiliate"];
  const reportsPaths = ["/dashboard/reports", "/dashboard/report-builder", "/dashboard/scheduled-reports", "/dashboard/analytics", "/dashboard/analytics/executive", "/dashboard/forecasting", "/dashboard/smart-query", "/dashboard/sheet-view"];
  const managementPaths = ["/dashboard/productivity", "/dashboard/approvals", "/dashboard/my-approvals", "/dashboard/workflows/designer", "/dashboard/chat", "/dashboard/team", "/dashboard/integrations", "/dashboard/integrations/marketplace", "/dashboard/integrations/payments", "/dashboard/api-keys", "/dashboard/subscription"];
  const enterprisePaths = ["/dashboard/enterprise", "/dashboard/enterprise/security-policies", "/dashboard/enterprise/sessions", "/dashboard/enterprise/ip-restrictions", "/dashboard/enterprise/role-templates", "/dashboard/enterprise/audit-export", "/dashboard/governance", "/dashboard/system/storage", "/dashboard/system/migrations"];
  const settingsPaths = ["/dashboard/company", "/dashboard/branches", "/dashboard/group", "/dashboard/branding", "/dashboard/compliance", "/dashboard/stamp", "/dashboard/audit", "/dashboard/audit/intelligence", "/dashboard/sso-settings", "/dashboard/permissions", "/dashboard/settings", "/dashboard/support", "/dashboard/help"];

  if (path === "/dashboard") return "الرئيسية";
  if (salesPaths.includes(path)) return "المبيعات";
  if (purchasingPaths.includes(path)) return "المشتريات";
  if (financePaths.includes(path)) return "المالية";
  if (reportsPaths.includes(path)) return "التقارير";
  if (managementPaths.includes(path)) return "الإدارة";
  if (enterprisePaths.includes(path)) return "المؤسسات";
  if (settingsPaths.includes(path)) return "الإعدادات";
  return undefined;
}

/* System / operational route detection */
const SYSTEM_SEGMENTS = ["system", "debug", "audit", "governance", "enterprise", "security", "infrastructure", "monitoring", "migrations", "storage"];
const isOperationalRoute = (path: string) => SYSTEM_SEGMENTS.some(s => path.includes(s));

/* ────────────────────────────────────────────────
   Decision engine
──────────────────────────────────────────────── */
function classifyDecision(route: string, zone: Zone, gateSegment?: string, module?: string, isOpen?: boolean): { decision: Decision; reason: string; proposedZone: "Client" | "Admin" | "Super Admin" } {
  // Debug → Super Admin
  if (zone === "debug") return { decision: "KEEP_SUPER", reason: "أداة تشخيص فني — Super Admin فقط", proposedZone: "Super Admin" };
  
  // Admin routes
  if (zone === "admin") {
    if (route.includes("/system/")) return { decision: "KEEP_SUPER", reason: "أداة نظام تشغيلية — Super Admin", proposedZone: "Super Admin" };
    return { decision: "KEEP_ADMIN", reason: "صفحة إدارة منصة", proposedZone: "Admin" };
  }

  // Dashboard routes — determine if they should stay or move
  const path = `/dashboard/${route}`;
  
  // Operational/system routes visible to client → should move to admin
  if (isOperationalRoute(path) && !["enterprise", "governance"].some(s => route.startsWith(s))) {
    return { decision: "HIDE", reason: "صفحة تشغيلية ظاهرة للعميل — يجب نقلها للأدمن", proposedZone: "Admin" };
  }

  // Enterprise module → Client (gated by entitlement)
  if (module === "enterprise") return { decision: "KEEP_CLIENT", reason: "ميزة مؤسسية محمية بالاشتراك", proposedZone: "Client" };
  
  // Open routes (help, support, subscription)
  if (isOpen) return { decision: "KEEP_CLIENT", reason: "مسار مفتوح (دعم/اشتراك/مساعدة)", proposedZone: "Client" };

  // Core ERP
  return { decision: "KEEP_CLIENT", reason: "ميزة ERP أساسية للعميل", proposedZone: "Client" };
}

/* ────────────────────────────────────────────────
   Build audit data
──────────────────────────────────────────────── */
function buildAuditRows(): AuditRow[] {
  const rows: AuditRow[] = [];

  // 1) Dashboard routes
  for (const r of DASHBOARD_ROUTES) {
    const fullPath = `/dashboard/${r.path}`;
    const seg = r.gateSegment ?? r.path.split("/")[0];
    const mapping = ROUTE_FEATURE_MAP[seg];
    const warnings: string[] = [];
    let gateStatus: GateStatus = "OK";

    if (!r.gateSegment && !r.isOpenRoute) {
      warnings.push("لا يوجد gateSegment معرّف");
      gateStatus = "WARN";
    }
    if (r.gateSegment && !mapping && !r.isOpenRoute) {
      warnings.push(`gateSegment "${r.gateSegment}" غير موجود في ROUTE_FEATURE_MAP`);
      gateStatus = "FAIL";
    }
    if (isOperationalRoute(fullPath) && !r.module?.includes("enterprise")) {
      warnings.push("صفحة تشغيلية/نظامية ظاهرة للعميل");
    }

    const { decision, reason, proposedZone } = classifyDecision(r.path, "dashboard", r.gateSegment, r.module, r.isOpenRoute);

    rows.push({
      route: fullPath,
      label: mapping?.label ?? r.path,
      zone: "dashboard",
      visibility: "client",
      gateSegment: r.gateSegment,
      module: r.module,
      featureKey: mapping?.featureKey,
      permissionKey: r.permissionKey ?? mapping?.permissionKeys?.[0],
      isOpenRoute: r.isOpenRoute,
      gateStatus,
      warnings,
      componentPath: r.element?.toString() ?? "",
      sidebarGroup: getDashboardSidebarGroup(fullPath),
      inSidebar: DASHBOARD_SIDEBAR_PATHS.has(fullPath),
      proposedZone,
      decision,
      decisionReason: reason,
    });
  }

  // 2) Admin routes
  for (const r of ADMIN_ROUTES) {
    const { decision, reason, proposedZone } = classifyDecision(r.path, "admin");
    rows.push({
      route: r.path,
      label: r.label,
      zone: "admin",
      visibility: "admin",
      gateStatus: "OK",
      warnings: [],
      componentPath: "",
      sidebarGroup: "Admin",
      inSidebar: ADMIN_SIDEBAR_PATHS.has(r.path),
      proposedZone,
      decision,
      decisionReason: reason,
    });
  }

  // 3) Debug routes
  for (const r of DEBUG_ROUTES) {
    const { decision, reason, proposedZone } = classifyDecision(r.path, "debug");
    rows.push({
      route: r.path,
      label: r.label,
      zone: "debug",
      visibility: "super",
      gateStatus: "OK",
      warnings: [],
      componentPath: "",
      inSidebar: false,
      proposedZone,
      decision,
      decisionReason: reason,
    });
  }

  return rows;
}

/* ────────────────────────────────────────────────
   Duplicate detection
──────────────────────────────────────────────── */
function findDuplicates(rows: AuditRow[]): { group: string; routes: string[]; reason: string }[] {
  const groups: { group: string; routes: string[]; reason: string }[] = [];
  const byFeature: Record<string, string[]> = {};
  
  for (const r of rows) {
    if (r.featureKey) {
      if (!byFeature[r.featureKey]) byFeature[r.featureKey] = [];
      byFeature[r.featureKey].push(r.route);
    }
  }
  
  for (const [fk, routes] of Object.entries(byFeature)) {
    if (routes.length > 2) {
      groups.push({ group: fk, routes, reason: `${routes.length} مسارات تشارك نفس featureKey` });
    }
  }

  // Check similar names
  const nameGroups: Record<string, string[]> = {};
  for (const r of rows) {
    const base = r.route.split("/").pop()?.replace(/-/g, "") ?? "";
    if (base.length > 3) {
      if (!nameGroups[base]) nameGroups[base] = [];
      nameGroups[base].push(r.route);
    }
  }
  for (const [, routes] of Object.entries(nameGroups)) {
    if (routes.length > 1) {
      groups.push({ group: routes[0], routes, reason: "تشابه في اسم المسار" });
    }
  }

  return groups;
}

/* ────────────────────────────────────────────────
   Phase B consolidation data (module-level for reuse)
──────────────────────────────────────────────── */
const PHASE_B_CONSOLIDATIONS_STATIC = [
  {
    group: "الفواتير",
    canonical: "/dashboard/billing",
    hidden: ["/dashboard/invoices"],
    reason: "نفس المكوّن (InvoicesPage) — redirect مُفعّل",
  },
  {
    group: "المؤسسات والحوكمة",
    canonical: "/dashboard/enterprise",
    hidden: [
      "/dashboard/enterprise/security-policies",
      "/dashboard/enterprise/sessions",
      "/dashboard/enterprise/ip-restrictions",
      "/dashboard/enterprise/role-templates",
      "/dashboard/enterprise/audit-export",
      "/dashboard/governance",
    ],
    reason: "صفحات فرعية — الوصول من داخل لوحة المؤسسات",
  },
  {
    group: "التكاملات",
    canonical: "/dashboard/integrations",
    hidden: ["/dashboard/integrations/marketplace", "/dashboard/integrations/payments"],
    reason: "صفحات فرعية — الوصول من صفحة التكاملات الرئيسية",
  },
  {
    group: "التحليلات",
    canonical: "/dashboard/analytics",
    hidden: ["/dashboard/analytics/executive"],
    reason: "صفحة فرعية — الوصول من لوحة التحليلات",
  },
  {
    group: "سجل التدقيق",
    canonical: "/dashboard/audit",
    hidden: ["/dashboard/audit/intelligence"],
    reason: "صفحة فرعية — الوصول من سجل التدقيق",
  },
];

/* ────────────────────────────────────────────────
   Component
──────────────────────────────────────────────── */
interface RouteUsageStat {
  route: string;
  visit_count: number;
  unique_users: number;
  last_visited: string;
}

const ArchitectureAudit = () => {
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState<Zone | "all">("all");
  const [statusFilter, setStatusFilter] = useState<GateStatus | "all">("all");
  const [usageStats, setUsageStats] = useState<RouteUsageStat[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  const allRows = useMemo(() => buildAuditRows(), []);
  const duplicates = useMemo(() => findDuplicates(allRows), [allRows]);

  // Fetch usage stats
  useEffect(() => {
    const fetchUsage = async () => {
      setUsageLoading(true);
      const { data } = await supabase.rpc("get_route_usage_stats" as any);
      if (data) setUsageStats(data as RouteUsageStat[]);
      setUsageLoading(false);
    };
    fetchUsage();
  }, []);

  // Routes with 0 usage (registered but never visited)
  const allRegisteredRoutes = useMemo(() => allRows.map(r => r.route), [allRows]);
  const visitedRoutes = useMemo(() => new Set(usageStats.map(s => s.route)), [usageStats]);
  const zeroUsageRoutes = useMemo(() => 
    allRegisteredRoutes.filter(r => !visitedRoutes.has(r)),
  [allRegisteredRoutes, visitedRoutes]);

  // Hidden routes from Phase B that also have 0 usage
  const PHASE_B_HIDDEN = useMemo(() => {
    const hidden: string[] = [];
    for (const c of PHASE_B_CONSOLIDATIONS_STATIC) {
      hidden.push(...c.hidden);
    }
    return hidden;
  }, []);
  const hiddenUnused = useMemo(() => 
    PHASE_B_HIDDEN.filter(r => !visitedRoutes.has(r)),
  [PHASE_B_HIDDEN, visitedRoutes]);

  // Suggested deletion list
  const deletionCandidates = useMemo(() => {
    const candidates: { route: string; reason: string }[] = [];
    for (const r of zeroUsageRoutes) {
      candidates.push({ route: r, reason: "0 زيارات خلال 30 يوم" });
    }
    for (const r of hiddenUnused) {
      if (!candidates.some(c => c.route === r)) {
        candidates.push({ route: r, reason: "مخفي (Phase B) + 0 زيارات" });
      }
    }
    return candidates;
  }, [zeroUsageRoutes, hiddenUnused]);

  const filtered = useMemo(() => {
    return allRows.filter((r) => {
      if (zoneFilter !== "all" && r.zone !== zoneFilter) return false;
      if (statusFilter !== "all" && r.gateStatus !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.route.toLowerCase().includes(q) || r.label.toLowerCase().includes(q) ||
          (r.gateSegment?.toLowerCase().includes(q) ?? false) ||
          (r.featureKey?.toLowerCase().includes(q) ?? false);
      }
      return true;
    });
  }, [allRows, zoneFilter, statusFilter, search]);

  // Stats
  const stats = useMemo(() => {
    const noGate = allRows.filter(r => r.zone === "dashboard" && !r.gateSegment && !r.isOpenRoute).length;
    const missingMap = allRows.filter(r => r.gateSegment && !ROUTE_FEATURE_MAP[r.gateSegment] && !r.isOpenRoute).length;
    const operationalVisible = allRows.filter(r => r.zone === "dashboard" && r.warnings.some(w => w.includes("تشغيلية"))).length;
    const okCount = allRows.filter(r => r.gateStatus === "OK").length;
    const warnCount = allRows.filter(r => r.gateStatus === "WARN").length;
    const failCount = allRows.filter(r => r.gateStatus === "FAIL").length;
    const keepClient = allRows.filter(r => r.decision === "KEEP_CLIENT").length;
    const keepAdmin = allRows.filter(r => r.decision === "KEEP_ADMIN").length;
    const keepSuper = allRows.filter(r => r.decision === "KEEP_SUPER").length;
    const hideCount = allRows.filter(r => r.decision === "HIDE").length;
    const notInSidebar = allRows.filter(r => r.zone === "dashboard" && !r.inSidebar).length;
    return { noGate, missingMap, operationalVisible, okCount, warnCount, failCount, keepClient, keepAdmin, keepSuper, hideCount, total: allRows.length, duplicateGroups: duplicates.length, notInSidebar };
  }, [allRows, duplicates]);

  const exportJSON = () => {
    const data = {
      generatedAt: new Date().toISOString(),
      summary: stats,
      routes: allRows,
      duplicateGroups: duplicates,
      phases: {
        "Phase A": "نقل الصفحات التشغيلية من العميل إلى الأدمن",
        "Phase B": "تنظيف Sidebar وإخفاء المكرر",
        "Phase C": "حذف/دمج الأقسام بعد التحقق من الاستخدام",
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `architecture-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const gateIcon = (s: GateStatus) => {
    if (s === "OK") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (s === "WARN") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const visIcon = (v: Visibility) => {
    if (v === "client") return <Users className="h-3.5 w-3.5" />;
    if (v === "admin") return <Shield className="h-3.5 w-3.5" />;
    return <Crown className="h-3.5 w-3.5" />;
  };

  const decisionBadge = (d: Decision) => {
    const map: Record<Decision, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      KEEP_CLIENT: { label: "إبقاء — عميل", variant: "default" },
      KEEP_ADMIN: { label: "إبقاء — أدمن", variant: "secondary" },
      KEEP_SUPER: { label: "إبقاء — سوبر", variant: "outline" },
      HIDE: { label: "إخفاء", variant: "destructive" },
      MERGE: { label: "دمج", variant: "secondary" },
      DELETE: { label: "حذف (اقتراح)", variant: "destructive" },
    };
    const m = map[d];
    return <Badge variant={m.variant}>{m.label}</Badge>;
  };

  const PHASE_B_CONSOLIDATIONS = PHASE_B_CONSOLIDATIONS_STATIC;

  const PHASE_A_MIGRATIONS = [
    { from: "/dashboard/system/storage", to: "/admin/system/storage", label: "تقرير التخزين" },
    { from: "/dashboard/system/migrations", to: "/admin/system/migrations", label: "لوحة الترحيلات" },
    { from: "/dashboard/system/infrastructure", to: "/admin/system/infrastructure", label: "البنية التحتية للنظام" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* Phase A Applied Banner */}
      <Card className="border-emerald-300 bg-emerald-500/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <h3 className="text-lg font-bold text-emerald-700">Phase A Applied ✅</h3>
            <Badge variant="outline" className="border-emerald-400 text-emerald-700">مُطبّقة</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            تم نقل {PHASE_A_MIGRATIONS.length} صفحات تشغيلية من لوحة العميل إلى لوحة الأدمن مع حماية PlatformAdminRoute وإعادة توجيه مؤقتة.
          </p>
          <div className="space-y-2">
            {PHASE_A_MIGRATIONS.map((m) => (
              <div key={m.from} className="flex items-center gap-2 text-sm font-mono bg-card/50 rounded-md px-3 py-2">
                <span className="text-muted-foreground line-through">{m.from}</span>
                <ArrowRight className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-emerald-700 font-semibold">{m.to}</span>
                <span className="text-xs text-muted-foreground mr-auto">({m.label})</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">✓ أُزيلت من Sidebar العميل</Badge>
            <Badge variant="secondary">✓ أُضيفت لـ Admin Sidebar</Badge>
            <Badge variant="secondary">✓ Deprecation redirects فعّالة</Badge>
            <Badge variant="secondary">✓ PlatformAdminRoute محمية</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Phase B Applied Banner */}
      <Card className="border-blue-300 bg-blue-500/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-bold text-blue-700">Phase B Applied ✅</h3>
            <Badge variant="outline" className="border-blue-400 text-blue-700">مُطبّقة</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            تم توحيد Sidebar العميل إلى 7 أقسام، وإخفاء {PHASE_B_CONSOLIDATIONS.reduce((sum, g) => sum + g.hidden.length, 0)} مسار مكرر/فرعي مع إعادة التوجيه.
          </p>
          <div className="space-y-3">
            {PHASE_B_CONSOLIDATIONS.map((c) => (
              <div key={c.group} className="bg-card/50 rounded-md px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <Merge className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="font-semibold text-sm">{c.group}</span>
                  <Badge variant="secondary" className="text-xs">{c.reason}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-blue-700 font-semibold">canonical: {c.canonical}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.hidden.map(h => (
                    <Badge key={h} variant="outline" className="text-xs font-mono line-through text-muted-foreground">{h}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">✓ Sidebar → 7 أقسام فقط</Badge>
            <Badge variant="secondary">✓ المؤسسات → دُمجت في الإعدادات</Badge>
            <Badge variant="secondary">✓ الفرعيات أُخفيت من القائمة</Badge>
            <Badge variant="secondary">✓ Redirects للمكررات</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Phase C Applied Banner */}
      <Card className="border-orange-300 bg-orange-500/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="h-6 w-6 text-orange-600" />
            <h3 className="text-lg font-bold text-orange-700">Phase C Active 📊</h3>
            <Badge variant="outline" className="border-orange-400 text-orange-700">قيد التجميع</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            تم تفعيل تتبع استخدام المسارات (آخر 30 يوم). بعد أسبوع سيظهر تقرير Top/Bottom routes مع قائمة حذف نهائية.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="bg-card/50 rounded-md px-3 py-2 text-center">
              <p className="text-2xl font-bold text-orange-700">{usageStats.length}</p>
              <p className="text-xs text-muted-foreground">مسارات مُتتبَّعة</p>
            </div>
            <div className="bg-card/50 rounded-md px-3 py-2 text-center">
              <p className="text-2xl font-bold text-orange-700">{usageStats.reduce((s, r) => s + r.visit_count, 0)}</p>
              <p className="text-xs text-muted-foreground">إجمالي الزيارات</p>
            </div>
            <div className="bg-card/50 rounded-md px-3 py-2 text-center">
              <p className="text-2xl font-bold text-destructive">{zeroUsageRoutes.length}</p>
              <p className="text-xs text-muted-foreground">مسارات بدون زيارات</p>
            </div>
            <div className="bg-card/50 rounded-md px-3 py-2 text-center">
              <p className="text-2xl font-bold text-destructive">{deletionCandidates.length}</p>
              <p className="text-xs text-muted-foreground">مرشحة للحذف</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">✓ Tracking مُفعّل</Badge>
            <Badge variant="secondary">✓ تنظيف تلقائي كل 30 يوم</Badge>
            <Badge variant="secondary">✓ Soft-delete جاهز</Badge>
            <Badge variant="secondary">✓ deprecated_routes جدول مُفعّل</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">تدقيق الهيكلة المعمارية</h1>
          <p className="text-sm text-muted-foreground mt-1">
            تحليل شامل لجميع المسارات والأقسام والصلاحيات — {stats.total} مسار
          </p>
        </div>
        <Button onClick={exportJSON} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> تصدير JSON
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="إجمالي المسارات" value={stats.total} icon={<BarChart3 className="h-4 w-4" />} />
        <StatCard label="بدون Gate" value={stats.noGate} icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} alert={stats.noGate > 0} />
        <StatCard label="Gate مفقود من Map" value={stats.missingMap} icon={<XCircle className="h-4 w-4 text-destructive" />} alert={stats.missingMap > 0} />
        <StatCard label="تشغيلية للعميل" value={stats.operationalVisible} icon={<Eye className="h-4 w-4 text-amber-500" />} alert={stats.operationalVisible > 0} />
        <StatCard label="مجموعات مكررة" value={stats.duplicateGroups} icon={<Merge className="h-4 w-4" />} />
        <StatCard label="خارج Sidebar" value={stats.notInSidebar} icon={<EyeOff className="h-4 w-4" />} />
      </div>

      {/* Proposed IA Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">التوزيع المقترح (Proposed IA)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ZoneCard zone="Client" icon={<Users className="h-5 w-5" />} count={stats.keepClient} desc="ERP محاسبي — فواتير، عملاء، مخزون، تقارير" color="bg-emerald-500/10 text-emerald-700 border-emerald-200" />
            <ZoneCard zone="Admin" icon={<Shield className="h-5 w-5" />} count={stats.keepAdmin + stats.hideCount} desc="إدارة المنصة — شركات، اشتراكات، قوالب، دعم" color="bg-blue-500/10 text-blue-700 border-blue-200" />
            <ZoneCard zone="Super Admin" icon={<Crown className="h-5 w-5" />} count={stats.keepSuper} desc="تشغيل وتدقيق — monitoring، debug، حوكمة" color="bg-purple-500/10 text-purple-700 border-purple-200" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="routes" className="space-y-4">
        <TabsList>
         <TabsTrigger value="routes">جدول المسارات ({filtered.length})</TabsTrigger>
          <TabsTrigger value="usage">الاستخدام 📊</TabsTrigger>
          <TabsTrigger value="duplicates">التكرارات ({duplicates.length})</TabsTrigger>
          <TabsTrigger value="decisions">قائمة القرارات</TabsTrigger>
          <TabsTrigger value="phases">خطة الترتيب</TabsTrigger>
        </TabsList>

        {/* ── Routes Table ── */}
        <TabsContent value="routes" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
            </div>
            <div className="flex gap-1">
              {(["all", "dashboard", "admin", "debug"] as const).map(z => (
                <Button key={z} size="sm" variant={zoneFilter === z ? "default" : "outline"} onClick={() => setZoneFilter(z)}>
                  {z === "all" ? "الكل" : z}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              {(["all", "OK", "WARN", "FAIL"] as const).map(s => (
                <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)}>
                  {s === "all" ? "الكل" : s}
                </Button>
              ))}
            </div>
          </div>

          <div className="border rounded-lg overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 bg-card z-10">المسار</TableHead>
                  <TableHead className="sticky top-0 bg-card z-10">المنطقة</TableHead>
                  <TableHead className="sticky top-0 bg-card z-10">مرئي لـ</TableHead>
                  <TableHead className="sticky top-0 bg-card z-10">Gate</TableHead>
                  <TableHead className="sticky top-0 bg-card z-10">featureKey</TableHead>
                  <TableHead className="sticky top-0 bg-card z-10">permissionKey</TableHead>
                  <TableHead className="sticky top-0 bg-card z-10">Module</TableHead>
                  <TableHead className="sticky top-0 bg-card z-10">Sidebar</TableHead>
                  <TableHead className="sticky top-0 bg-card z-10">القرار</TableHead>
                  <TableHead className="sticky top-0 bg-card z-10">تحذيرات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.route} className={r.gateStatus === "FAIL" ? "bg-destructive/5" : r.gateStatus === "WARN" ? "bg-amber-500/5" : ""}>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate" title={r.route}>
                      {r.route}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{r.zone}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-xs">
                        {visIcon(r.visibility)}
                        {r.visibility}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        {gateIcon(r.gateStatus)}
                        <span className="text-xs">{r.gateSegment ?? "—"}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{r.featureKey ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{r.permissionKey ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.module ?? "—"}</TableCell>
                    <TableCell>
                      {r.inSidebar ? (
                        <Badge variant="outline" className="text-xs bg-emerald-500/10">{r.sidebarGroup ?? "✓"}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">✗</span>
                      )}
                    </TableCell>
                    <TableCell>{decisionBadge(r.decision)}</TableCell>
                    <TableCell>
                      {r.warnings.length > 0 ? (
                        <span className="text-xs text-amber-600">{r.warnings.join(" | ")}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Usage Report ── */}
        <TabsContent value="usage" className="space-y-4">
          {usageLoading ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">جاري تحميل بيانات الاستخدام...</CardContent></Card>
          ) : (
            <>
              {/* Top Routes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 rotate-180 text-emerald-600" />
                    أعلى المسارات استخداماً (Top 15)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-auto max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky top-0 bg-card">#</TableHead>
                          <TableHead className="sticky top-0 bg-card">المسار</TableHead>
                          <TableHead className="sticky top-0 bg-card">الزيارات</TableHead>
                          <TableHead className="sticky top-0 bg-card">مستخدمين فريدين</TableHead>
                          <TableHead className="sticky top-0 bg-card">آخر زيارة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usageStats.slice(0, 15).map((s, i) => (
                          <TableRow key={s.route}>
                            <TableCell className="font-bold">{i + 1}</TableCell>
                            <TableCell className="font-mono text-xs">{s.route}</TableCell>
                            <TableCell><Badge variant="secondary">{s.visit_count}</Badge></TableCell>
                            <TableCell>{s.unique_users}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {new Date(s.last_visited).toLocaleDateString("ar-SA")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Bottom Routes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-destructive" />
                    أقل المسارات استخداماً (Bottom 10)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-auto max-h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky top-0 bg-card">المسار</TableHead>
                          <TableHead className="sticky top-0 bg-card">الزيارات</TableHead>
                          <TableHead className="sticky top-0 bg-card">مستخدمين</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...usageStats].reverse().slice(0, 10).map((s) => (
                          <TableRow key={s.route}>
                            <TableCell className="font-mono text-xs">{s.route}</TableCell>
                            <TableCell><Badge variant="destructive">{s.visit_count}</Badge></TableCell>
                            <TableCell>{s.unique_users}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Deletion Candidates */}
              <Card className="border-destructive/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-destructive" />
                    قائمة الحذف المقترحة ({deletionCandidates.length} مسار)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {deletionCandidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">لا توجد مسارات مرشحة للحذف حالياً — انتظر تجميع بيانات أسبوع كامل</p>
                  ) : (
                    <div className="space-y-2">
                      {deletionCandidates.map(c => (
                        <div key={c.route} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                          <code className="text-xs font-mono">{c.route}</code>
                          <Badge variant="destructive" className="text-xs shrink-0">{c.reason}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 p-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
                    <p className="font-semibold mb-1">⚠️ خطوات الحذف التدريجي:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Soft Delete: إضافة المسار لجدول deprecated_routes مع redirect + تحذير</li>
                      <li>مراقبة أسبوع إضافي للتأكد من عدم وجود استخدام</li>
                      <li>Hard Delete: حذف الكود والمكونات نهائياً</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Duplicates ── */}
        <TabsContent value="duplicates" className="space-y-3">
          {duplicates.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">لا توجد تكرارات</CardContent></Card>
          ) : (
            duplicates.map((d, i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Merge className="h-4 w-4 text-amber-500" />
                    <span className="font-medium text-sm">{d.group}</span>
                    <Badge variant="secondary" className="text-xs">{d.reason}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {d.routes.map(r => (
                      <Badge key={r} variant="outline" className="font-mono text-xs">{r}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Decisions ── */}
        <TabsContent value="decisions" className="space-y-4">
          <DecisionGroup title="إبقاء للعميل (Client ERP)" icon={<Users className="h-5 w-5 text-emerald-600" />} rows={allRows.filter(r => r.decision === "KEEP_CLIENT")} />
          <DecisionGroup title="إبقاء للأدمن (Platform Admin)" icon={<Shield className="h-5 w-5 text-blue-600" />} rows={allRows.filter(r => r.decision === "KEEP_ADMIN")} />
          <DecisionGroup title="إبقاء لـ Super Admin" icon={<Crown className="h-5 w-5 text-purple-600" />} rows={allRows.filter(r => r.decision === "KEEP_SUPER")} />
          <DecisionGroup title="إخفاء / نقل" icon={<EyeOff className="h-5 w-5 text-amber-600" />} rows={allRows.filter(r => r.decision === "HIDE")} />
          <DecisionGroup title="حذف (اقتراح)" icon={<Trash2 className="h-5 w-5 text-destructive" />} rows={allRows.filter(r => r.decision === "DELETE")} />
        </TabsContent>

        {/* ── Phases ── */}
        <TabsContent value="phases" className="space-y-4">
          <PhaseCard
            phase="A"
            title="نقل الصفحات التشغيلية من العميل إلى الأدمن"
            items={[
              "نقل /dashboard/system/* إلى /admin/system/*",
              "نقل صفحات Debug من /debug/* المحمية بـ DEV فقط إلى /admin/debug/*",
              "إزالة الصفحات التشغيلية من sidebar العميل",
            ]}
            risk="منخفض"
            effort="متوسط"
          />
          <PhaseCard
            phase="B"
            title="تنظيف Sidebar وإخفاء المكرر"
            items={[
              "دمج billing/invoices (نفس المكون)",
              "تجميع integration sub-routes تحت مدخل واحد",
              "إخفاء المسارات ذات الاستخدام الصفري من Sidebar",
              "ترتيب مجموعات Sidebar حسب الأولوية",
            ]}
            risk="منخفض"
            effort="منخفض"
          />
          <PhaseCard
            phase="C"
            title="حذف/دمج الأقسام بعد التحقق من الاستخدام"
            items={[
              "تحليل بيانات الاستخدام 30 يوم قبل أي حذف",
              "دمج الصفحات المتشابهة (مثل report-builder + reports)",
              "حذف المسارات المهجورة (usage=0 + بديل متاح)",
              "توحيد Guards غير المتسقة",
            ]}
            risk="متوسط"
            effort="عالي"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ── Sub-components ── */
function StatCard({ label, value, icon, alert }: { label: string; value: number; icon: React.ReactNode; alert?: boolean }) {
  return (
    <Card className={alert ? "border-amber-300 bg-amber-500/5" : ""}>
      <CardContent className="p-3 flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ZoneCard({ zone, icon, count, desc, color }: { zone: string; icon: React.ReactNode; count: number; desc: string; color: string }) {
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-bold">{zone}</span>
        <Badge variant="secondary">{count} مسار</Badge>
      </div>
      <p className="text-xs opacity-80">{desc}</p>
    </div>
  );
}

function DecisionGroup({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: AuditRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon} {title} ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.route} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <code className="text-xs font-mono truncate max-w-[250px]">{r.route}</code>
                <span className="text-xs text-muted-foreground hidden md:inline">— {r.label}</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{r.decisionReason}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PhaseCard({ phase, title, items, risk, effort }: { phase: string; title: string; items: string[]; risk: string; effort: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">{phase}</span>
          {title}
          <div className="flex gap-2 mr-auto">
            <Badge variant="outline">مخاطرة: {risk}</Badge>
            <Badge variant="outline">جهد: {effort}</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <ArrowRight className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default ArchitectureAudit;
