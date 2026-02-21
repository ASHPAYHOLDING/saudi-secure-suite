import { useState, useCallback, useMemo } from "react";
import { DASHBOARD_ROUTES, type DashboardRouteConfig } from "@/routes/dashboard-routes";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2, XCircle, AlertTriangle, Search, RefreshCw, Loader2,
  Shield, Crown, LayoutDashboard, Plug, Database, Download, ChevronDown, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──

type AuditStatus = "OK" | "WARN" | "FAIL" | "PENDING" | "RUNNING";
type RouteCategory = "dashboard" | "admin" | "debug" | "integration";

interface AuditRow {
  route: string;
  label: string;
  category: RouteCategory;
  module: string;
  gateSegment: string;
  permissionKey: string;
  dataSources: string[];
  status: AuditStatus;
  errorSnippet: string;
  checks: {
    hasGate: boolean;
    hasPermission: boolean;
    hasModule: boolean;
    featureMapEntry: boolean;
    isOpenRoute: boolean;
  };
}

// ── Source of truth: Admin + Debug routes ──

const ADMIN_ROUTES = [
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

// ── Build all route entries ──

function buildDashboardRows(): AuditRow[] {
  return DASHBOARD_ROUTES.map((route) => {
    const seg = route.gateSegment ?? route.path.split("/")[0];
    const mapping = ROUTE_FEATURE_MAP[seg];
    const perm = route.permissionKey ?? mapping?.permissionKeys?.[0] ?? "";
    const warnings: string[] = [];

    const hasGate = !!mapping?.featureKey;
    const hasPerm = !!perm;
    const isOpen = !!route.isOpenRoute;

    if (!hasGate && !hasPerm && !isOpen) {
      warnings.push("No gate, no permission, not open → fail-closed");
    }
    if (seg && !mapping && !isOpen) {
      warnings.push(`Segment "${seg}" missing from ROUTE_FEATURE_MAP`);
    }

    return {
      route: `/dashboard/${route.path}`,
      label: mapping?.label ?? route.path,
      category: "dashboard" as RouteCategory,
      module: route.module ?? "—",
      gateSegment: seg || "—",
      permissionKey: perm || "—",
      dataSources: inferDataSources(route),
      status: "PENDING" as AuditStatus,
      errorSnippet: warnings.join("; ") || "—",
      checks: {
        hasGate,
        hasPermission: hasPerm,
        hasModule: !!route.module,
        featureMapEntry: !!mapping,
        isOpenRoute: isOpen,
      },
    };
  });
}

function buildAdminRows(): AuditRow[] {
  return ADMIN_ROUTES.map((r) => ({
    route: r.path,
    label: r.label,
    category: "admin" as RouteCategory,
    module: "platform_admin",
    gateSegment: "PlatformAdminRoute",
    permissionKey: "is_platform_admin()",
    dataSources: ["platform_admins"],
    status: "PENDING" as AuditStatus,
    errorSnippet: "—",
    checks: { hasGate: true, hasPermission: true, hasModule: true, featureMapEntry: false, isOpenRoute: false },
  }));
}

function buildDebugRows(): AuditRow[] {
  return DEBUG_ROUTES.map((r) => ({
    route: r.path,
    label: r.label,
    category: "debug" as RouteCategory,
    module: "dev_only",
    gateSegment: "PlatformAdminRoute + DEV",
    permissionKey: "is_platform_admin()",
    dataSources: [],
    status: "PENDING" as AuditStatus,
    errorSnippet: import.meta.env.PROD ? "Not registered in production ✓" : "Active in dev mode",
    checks: { hasGate: true, hasPermission: true, hasModule: true, featureMapEntry: false, isOpenRoute: false },
  }));
}

function inferDataSources(route: DashboardRouteConfig): string[] {
  const sources: string[] = [];
  const p = route.path;
  if (p.includes("billing") || p.includes("invoices")) sources.push("invoices", "invoice_payments");
  else if (p.includes("contracts")) sources.push("contracts");
  else if (p.includes("expenses")) sources.push("expenses");
  else if (p.includes("customers")) sources.push("customers");
  else if (p.includes("inventory")) sources.push("inventory_items");
  else if (p.includes("journal")) sources.push("journal_entries");
  else if (p.includes("quotations")) sources.push("quotations");
  else if (p.includes("integrations")) sources.push("tenant_integrations", "integration_manifests");
  else if (p.includes("team")) sources.push("profiles");
  else if (p.includes("audit")) sources.push("audit_logs");
  else if (p.includes("analytics")) sources.push("analytics_daily_revenue");
  else if (p.includes("budgets")) sources.push("budgets", "budget_lines");
  else if (p.includes("wallet")) sources.push("wallet_transactions");
  else if (p.includes("chat")) sources.push("chat_messages");
  return sources;
}

// ── Backend checks ──

interface BackendCheckResult {
  label: string;
  status: AuditStatus;
  detail: string;
  evidence: string[];
}

async function runBackendChecks(): Promise<BackendCheckResult[]> {
  const results: BackendCheckResult[] = [];

  // 1. RLS audit
  try {
    const { data, error } = await supabase.rpc("audit_rls_status");
    if (error) throw error;
    const rows = (data as any[]) ?? [];
    const noRls = rows.filter((r: any) => !r.is_rls_enabled);
    const zeroPolicies = rows.filter((r: any) => r.is_rls_enabled && Number(r.policy_count) === 0);
    results.push({
      label: "RLS Audit",
      status: noRls.length > 0 ? "FAIL" : zeroPolicies.length > 0 ? "WARN" : "OK",
      detail: noRls.length > 0
        ? `${noRls.length} table(s) without RLS`
        : zeroPolicies.length > 0
        ? `${zeroPolicies.length} table(s) with RLS but 0 policies`
        : `All ${rows.length} tables have RLS + policies`,
      evidence: noRls.length > 0
        ? noRls.slice(0, 8).map((r: any) => r.table_name)
        : zeroPolicies.slice(0, 8).map((r: any) => r.table_name),
    });
  } catch {
    results.push({ label: "RLS Audit", status: "WARN", detail: "Could not call audit_rls_status", evidence: [] });
  }

  // 2. Critical indexes
  const indexChecks = [
    { table: "webhook_events", pattern: /unique/i, label: "webhook_events idempotency" },
    { table: "invoice_payments", pattern: /unique.*tenant_id.*reference|unique.*reference.*tenant/i, label: "invoice_payments uniqueness" },
    { table: "payment_intents", pattern: /provider_session_id/i, label: "payment_intents session index" },
  ];

  for (const ic of indexChecks) {
    try {
      const { data, error } = await (supabase.rpc as any)("audit_table_indexes", { p_table_name: ic.table });
      if (error) throw error;
      const rows = (data as any[]) ?? [];
      const matches = rows.filter((r: any) => ic.pattern.test(r.indexdef));
      results.push({
        label: ic.label,
        status: matches.length > 0 ? "OK" : "FAIL",
        detail: matches.length > 0 ? `${matches.length} matching index(es)` : `No matching index on ${ic.table}`,
        evidence: matches.map((r: any) => r.indexname),
      });
    } catch {
      results.push({ label: ic.label, status: "WARN", detail: `Could not audit ${ic.table}`, evidence: [] });
    }
  }

  // 3. Table row counts for key tables
  const tablesToCheck = ["invoices", "customers", "expenses", "contracts", "profiles", "tenants"];
  for (const t of tablesToCheck) {
    try {
      const { count, error } = await (supabase.from as any)(t).select("id", { count: "exact", head: true });
      if (error) throw error;
      results.push({ label: `Table: ${t}`, status: "OK", detail: `${count ?? 0} rows`, evidence: [] });
    } catch (e: any) {
      results.push({ label: `Table: ${t}`, status: "WARN", detail: e?.message?.slice(0, 80) ?? "Query failed", evidence: [] });
    }
  }

  return results;
}

// ── Status helpers ──

const statusIcon = (s: AuditStatus) => {
  switch (s) {
    case "OK": return <CheckCircle2 size={14} className="text-green-500 shrink-0" />;
    case "FAIL": return <XCircle size={14} className="text-destructive shrink-0" />;
    case "WARN": return <AlertTriangle size={14} className="text-yellow-500 shrink-0" />;
    case "RUNNING": return <Loader2 size={14} className="animate-spin text-muted-foreground shrink-0" />;
    default: return <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />;
  }
};

const statusBadge = (s: AuditStatus) => {
  switch (s) {
    case "OK": return <Badge variant="secondary" className="text-[9px] gap-1 bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 size={10} /> OK</Badge>;
    case "FAIL": return <Badge variant="destructive" className="text-[9px] gap-1"><XCircle size={10} /> FAIL</Badge>;
    case "WARN": return <Badge variant="outline" className="text-[9px] gap-1 text-yellow-500 border-yellow-500/30"><AlertTriangle size={10} /> WARN</Badge>;
    case "RUNNING": return <Badge variant="outline" className="text-[9px] gap-1"><Loader2 size={10} className="animate-spin" /> …</Badge>;
    default: return <Badge variant="outline" className="text-[9px]">PENDING</Badge>;
  }
};

const categoryBadge = (c: RouteCategory) => {
  const cls = c === "dashboard" ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
    : c === "admin" ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
    : c === "debug" ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
    : "bg-green-500/10 text-green-600 border-green-500/20";
  return <Badge variant="outline" className={`text-[9px] ${cls}`}>{c}</Badge>;
};

// ── Component ──

const FullSystemAudit = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [backendResults, setBackendResults] = useState<BackendCheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (route: string) => setExpandedRows((prev) => {
    const next = new Set(prev);
    next.has(route) ? next.delete(route) : next.add(route);
    return next;
  });

  const runAudit = useCallback(async () => {
    setRunning(true);
    setProgress(0);
    setBackendResults([]);
    setExpandedRows(new Set());

    // Phase 1: Build frontend route analysis
    const dashRows = buildDashboardRows();
    const adminRows = buildAdminRows();
    const debugRows = buildDebugRows();
    const allRows = [...dashRows, ...adminRows, ...debugRows];

    // Set initial status
    allRows.forEach((r) => { r.status = "RUNNING"; });
    setRows([...allRows]);
    setProgress(20);

    // Phase 2: Frontend gate checks
    await new Promise((r) => setTimeout(r, 200)); // visual feedback
    allRows.forEach((row) => {
      if (row.category === "dashboard") {
        const hasAnyGate = row.checks.hasGate || row.checks.hasPermission || row.checks.isOpenRoute;
        const hasFmEntry = row.checks.featureMapEntry || row.checks.isOpenRoute;
        if (!hasAnyGate) {
          row.status = "FAIL";
          row.errorSnippet = "No gate, no permission, not open → fail-closed risk";
        } else if (!hasFmEntry && !row.checks.isOpenRoute) {
          row.status = "WARN";
          row.errorSnippet = `Segment "${row.gateSegment}" missing from ROUTE_FEATURE_MAP`;
        } else {
          row.status = "OK";
          row.errorSnippet = "—";
        }
      } else if (row.category === "admin") {
        row.status = "OK";
      } else if (row.category === "debug") {
        row.status = import.meta.env.PROD ? "OK" : "WARN";
      }
    });
    setRows([...allRows]);
    setProgress(50);

    // Phase 3: Backend checks
    const backend = await runBackendChecks();
    setBackendResults(backend);
    setProgress(100);

    setRunning(false);
    toast.success("Full system audit completed");
  }, []);

  // ── Stats ──
  const stats = useMemo(() => {
    const s = { total: rows.length, ok: 0, warn: 0, fail: 0, pending: 0 };
    rows.forEach((r) => {
      if (r.status === "OK") s.ok++;
      else if (r.status === "WARN") s.warn++;
      else if (r.status === "FAIL") s.fail++;
      else s.pending++;
    });
    return s;
  }, [rows]);

  // ── Filter ──
  const filtered = useMemo(() => {
    let result = rows;
    if (tab !== "all") result = result.filter((r) => r.category === tab);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((r) =>
        r.route.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.module.toLowerCase().includes(q) ||
        r.gateSegment.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, tab, query]);

  // ── Export ──
  const handleExport = () => {
    const data = {
      generatedAt: new Date().toISOString(),
      stats,
      routes: rows.map(({ route, label, category, module, gateSegment, permissionKey, dataSources, status, errorSnippet, checks }) => ({
        route, label, category, module, gateSegment, permissionKey, dataSources, status, errorSnippet, checks,
      })),
      backendChecks: backendResults,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `full-system-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div dir="ltr" className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Database size={20} /> Full System Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Comprehensive operational audit of all routes, gates, and backend health
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleExport} disabled={rows.length === 0} className="gap-2">
            <Download size={14} /> Export JSON
          </Button>
          <Button size="sm" onClick={runAudit} disabled={running} className="gap-2">
            {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {running ? "Running…" : "Run Audit"}
          </Button>
        </div>
      </div>

      {/* Progress */}
      {running && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress < 50 ? "Analyzing routes…" : "Running backend checks…"}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Stats cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, cls: "text-foreground" },
            { label: "OK", value: stats.ok, cls: "text-green-500" },
            { label: "WARN", value: stats.warn, cls: "text-yellow-500" },
            { label: "FAIL", value: stats.fail, cls: "text-destructive" },
            { label: "Pending", value: stats.pending, cls: "text-muted-foreground" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 text-center">
                <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs + Search */}
      {rows.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all" className="gap-1.5 text-xs"><Database size={12} /> All ({rows.length})</TabsTrigger>
              <TabsTrigger value="dashboard" className="gap-1.5 text-xs"><LayoutDashboard size={12} /> Dashboard</TabsTrigger>
              <TabsTrigger value="admin" className="gap-1.5 text-xs"><Crown size={12} /> Admin</TabsTrigger>
              <TabsTrigger value="debug" className="gap-1.5 text-xs"><Shield size={12} /> Debug</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input
              placeholder="Filter routes…"
              className="pl-9 h-8 text-xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Route audit table (desktop) */}
      {filtered.length > 0 && (
        <div className="hidden md:block rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[10px] font-medium w-10">St</TableHead>
                  <TableHead className="text-[10px] font-medium">Route</TableHead>
                  <TableHead className="text-[10px] font-medium w-20">Category</TableHead>
                  <TableHead className="text-[10px] font-medium">Module</TableHead>
                  <TableHead className="text-[10px] font-medium">GateSegment</TableHead>
                  <TableHead className="text-[10px] font-medium">PermissionKey</TableHead>
                  <TableHead className="text-[10px] font-medium">Data Sources</TableHead>
                  <TableHead className="text-[10px] font-medium w-16">Status</TableHead>
                  <TableHead className="text-[10px] font-medium">Error / Notes</TableHead>
                  <TableHead className="text-[10px] w-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <>
                    <TableRow
                      key={row.route}
                      className={`cursor-pointer hover:bg-muted/30 ${row.status === "FAIL" ? "bg-destructive/5" : row.status === "WARN" ? "bg-yellow-500/5" : ""}`}
                      onClick={() => toggleRow(row.route)}
                    >
                      <TableCell>{statusIcon(row.status)}</TableCell>
                      <TableCell className="font-mono text-[10px] text-foreground max-w-[200px] truncate">{row.route}</TableCell>
                      <TableCell>{categoryBadge(row.category)}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{row.module}</TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground">{row.gateSegment}</TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground">{row.permissionKey}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-0.5">
                          {row.dataSources.length > 0
                            ? row.dataSources.map((ds) => (
                                <code key={ds} className="px-1 py-0 bg-muted rounded text-[8px] font-mono">{ds}</code>
                              ))
                            : <span className="text-[9px] text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell className="text-[9px] text-muted-foreground max-w-[200px] truncate">{row.errorSnippet}</TableCell>
                      <TableCell>{expandedRows.has(row.route) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</TableCell>
                    </TableRow>
                    {expandedRows.has(row.route) && (
                      <TableRow key={`${row.route}-detail`} className="bg-muted/20">
                        <TableCell colSpan={10} className="py-3 px-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <p className="font-medium text-muted-foreground mb-1">Gate Checks</p>
                              <ul className="space-y-0.5">
                                <li className="flex items-center gap-1">{row.checks.hasGate ? <CheckCircle2 size={10} className="text-green-500" /> : <XCircle size={10} className="text-destructive" />} Feature Gate</li>
                                <li className="flex items-center gap-1">{row.checks.hasPermission ? <CheckCircle2 size={10} className="text-green-500" /> : <XCircle size={10} className="text-muted-foreground" />} Permission Key</li>
                                <li className="flex items-center gap-1">{row.checks.hasModule ? <CheckCircle2 size={10} className="text-green-500" /> : <XCircle size={10} className="text-muted-foreground" />} Module Guard</li>
                                <li className="flex items-center gap-1">{row.checks.featureMapEntry ? <CheckCircle2 size={10} className="text-green-500" /> : <AlertTriangle size={10} className="text-yellow-500" />} Feature Map Entry</li>
                                <li className="flex items-center gap-1">{row.checks.isOpenRoute ? <CheckCircle2 size={10} className="text-green-500" /> : <span className="text-muted-foreground text-[9px]">—</span>} Open Route</li>
                              </ul>
                            </div>
                            <div>
                              <p className="font-medium text-muted-foreground mb-1">Route Info</p>
                              <p className="text-muted-foreground">Label: <span className="text-foreground">{row.label}</span></p>
                              <p className="text-muted-foreground">Category: <span className="text-foreground">{row.category}</span></p>
                            </div>
                            <div>
                              <p className="font-medium text-muted-foreground mb-1">Data Sources</p>
                              {row.dataSources.length > 0
                                ? row.dataSources.map((ds) => <code key={ds} className="block px-1 py-0.5 bg-muted rounded text-[9px] font-mono mb-0.5">{ds}</code>)
                                : <span className="text-muted-foreground">None inferred</span>}
                            </div>
                            <div>
                              <p className="font-medium text-muted-foreground mb-1">Notes</p>
                              <p className="text-muted-foreground">{row.errorSnippet}</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Mobile cards */}
      {filtered.length > 0 && (
        <div className="md:hidden space-y-2">
          {filtered.map((row) => (
            <Card
              key={row.route}
              className={`cursor-pointer ${row.status === "FAIL" ? "border-destructive/30" : row.status === "WARN" ? "border-yellow-500/30" : ""}`}
              onClick={() => toggleRow(row.route)}
            >
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {statusIcon(row.status)}
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] text-foreground truncate">{row.route}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {categoryBadge(row.category)}
                        <span className="text-[9px] text-muted-foreground">{row.module}</span>
                      </div>
                    </div>
                  </div>
                  {statusBadge(row.status)}
                </div>
                {expandedRows.has(row.route) && (
                  <div className="pt-2 border-t border-border text-[10px] space-y-1">
                    <p><span className="text-muted-foreground">Gate:</span> {row.gateSegment}</p>
                    <p><span className="text-muted-foreground">Perm:</span> {row.permissionKey}</p>
                    <p><span className="text-muted-foreground">Sources:</span> {row.dataSources.join(", ") || "—"}</p>
                    <p><span className="text-muted-foreground">Notes:</span> {row.errorSnippet}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Backend check results */}
      {backendResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plug size={16} /> Backend Health Checks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {backendResults.map((br, i) => (
                <div key={i} className="flex items-start gap-3 py-1.5 border-b border-border last:border-0">
                  {statusIcon(br.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{br.label}</span>
                      {statusBadge(br.status)}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{br.detail}</p>
                    {br.evidence.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {br.evidence.map((e, j) => (
                          <code key={j} className="px-1 py-0 bg-muted rounded text-[8px] font-mono">{e}</code>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {rows.length === 0 && !running && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Database size={48} className="opacity-20" />
          <p className="text-sm">Click <strong>"Run Audit"</strong> to start comprehensive system analysis</p>
          <p className="text-[10px]">Analyzes {DASHBOARD_ROUTES.length} dashboard + {ADMIN_ROUTES.length} admin + {DEBUG_ROUTES.length} debug routes</p>
        </div>
      )}
    </div>
  );
};

export default FullSystemAudit;
