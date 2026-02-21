import { useState, useMemo } from "react";
import { DASHBOARD_ROUTES } from "@/routes/dashboard-routes";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { useGranularPermissions } from "@/hooks/useGranularPermissions";
import { useAuth } from "@/contexts/AuthContext";
import { isModuleAllowed } from "@/lib/tenant-modules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  Search,
  Shield,
  Unlock,
  Lock,
  Download,
} from "lucide-react";

// ── Types ──

type AuditStatus =
  | "allowed"
  | "open_route"
  | "denied:route_not_gated"
  | "denied:module_not_allowed"
  | "denied:feature_not_in_plan"
  | "denied:permission_denied";

interface AuditRow {
  path: string;
  gateSegment: string;
  derivedFeatureKey: string | undefined;
  derivedPermissionKey: string | undefined;
  isOpenRoute: boolean;
  module: string | undefined;
  status: AuditStatus;
  warnings: string[];
}

// ── Compute function (pure) ──

function computeRows(
  entitlementsMap: Record<string, any>,
  canAny: (key: string) => boolean,
  isOwner: boolean,
  tenantType: string | null | undefined
): AuditRow[] {
  return DASHBOARD_ROUTES.map((route) => {
    // Segment derivation — consistent with real routing
    let segment = route.gateSegment ?? route.path.split("/")[0];
    const warnings: string[] = [];

    if (!segment || segment === "") {
      segment = "__empty__";
      warnings.push("⛔ segment is empty — fail-closed risk, must be fixed");
    }

    const mapping = ROUTE_FEATURE_MAP[segment];
    const derivedFeatureKey = mapping?.featureKey;
    const derivedPermissionKey =
      route.permissionKey ?? mapping?.permissionKeys?.[0];
    const isOpen = !!route.isOpenRoute;

    // ── Warning checks ──
    if (!derivedFeatureKey && !derivedPermissionKey && !isOpen) {
      warnings.push(
        "⚠️ No featureKey, no permissionKey, not isOpenRoute → denied(route_not_gated)"
      );
    }
    if (!route.gateSegment && !isOpen) {
      warnings.push(
        "⚠️ No explicit gateSegment — using path fallback: " + segment
      );
    }
    if (route.gateSegment && !mapping && !isOpen) {
      warnings.push(
        `⚠️ gateSegment "${route.gateSegment}" not found in ROUTE_FEATURE_MAP`
      );
    }

    // ── Status evaluation ──
    let status: AuditStatus;

    if (isOpen) {
      status = "open_route";
    } else if (route.module && !isModuleAllowed(tenantType as any, route.module as any)) {
      status = "denied:module_not_allowed";
      warnings.push(`⚠️ module "${route.module}" not allowed for tenantType "${tenantType}"`);
    } else if (!derivedFeatureKey && !derivedPermissionKey) {
      status = "denied:route_not_gated";
    } else {
      const entAllowed = derivedFeatureKey
        ? !!entitlementsMap[derivedFeatureKey]?.allowed
        : true;

      let rbacAllowed = true;
      if (derivedPermissionKey) {
        rbacAllowed = isOwner || canAny(derivedPermissionKey);
      }

      if (!entAllowed) {
        status = "denied:feature_not_in_plan";
      } else if (!rbacAllowed) {
        status = "denied:permission_denied";
      } else {
        status = "allowed";
      }
    }

    return {
      path: route.path,
      gateSegment: segment,
      derivedFeatureKey,
      derivedPermissionKey,
      isOpenRoute: isOpen,
      module: route.module,
      status,
      warnings,
    };
  });
}

// ── Component ──

const DebugSystemAudit = () => {
  const [auditKey, setAuditKey] = useState(0);
  const [query, setQuery] = useState("");
  const { entitlementsMap, loading: entLoading } = useEntitlementsContext();
  const { canAny, loading: rbacLoading } = useGranularPermissions();
  const { userRole, tenantType } = useAuth();
  const isOwner = userRole === "owner";
  const loading = entLoading || rbacLoading;

  // auditKey in deps forces recompute on "Run Audit"
  const rows = useMemo(
    () => computeRows(entitlementsMap, canAny, isOwner, tenantType),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entitlementsMap, canAny, isOwner, tenantType, auditKey]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      (r) =>
        r.path.toLowerCase().includes(q) ||
        r.gateSegment.toLowerCase().includes(q) ||
        r.derivedFeatureKey?.toLowerCase().includes(q) ||
        r.derivedPermissionKey?.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const globalWarnings = useMemo(() => {
    const w: string[] = [];
    const emptySegments = rows.filter((r) => r.gateSegment === "__empty__");
    if (emptySegments.length > 0) {
      w.push(
        `⛔ ${emptySegments.length} route(s) with empty segment: ${emptySegments.map((r) => r.path).join(", ")}`
      );
    }
    const ungated = rows.filter(
      (r) => !r.isOpenRoute && !r.derivedFeatureKey && !r.derivedPermissionKey
    );
    if (ungated.length > 0) {
      w.push(
        `⚠️ ${ungated.length} route(s) with no gate and not open: ${ungated.map((r) => r.path).join(", ")}`
      );
    }
    return w;
  }, [rows]);

  const stats = useMemo(() => {
    const s = { total: rows.length, allowed: 0, open: 0, denied: 0, warnings: 0 };
    rows.forEach((r) => {
      if (r.status === "allowed") s.allowed++;
      else if (r.status === "open_route") s.open++;
      else s.denied++;
      if (r.warnings.length > 0) s.warnings++;
    });
    return s;
  }, [rows]);

  const handleExportJSON = () => {
    const data = filtered.map(({ path, gateSegment, derivedFeatureKey, derivedPermissionKey, isOpenRoute, module, status, warnings }) => ({
      path: `/dashboard/${path}`,
      gateSegment,
      derivedFeatureKey: derivedFeatureKey ?? null,
      derivedPermissionKey: derivedPermissionKey ?? null,
      isOpenRoute,
      module: module ?? null,
      status,
      warnings,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `route-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusConfig: Record<AuditStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
    allowed: { label: "ALLOWED", variant: "secondary", icon: CheckCircle2 },
    open_route: { label: "OPEN", variant: "outline", icon: Unlock },
    "denied:route_not_gated": { label: "NOT GATED", variant: "destructive", icon: ShieldAlert },
    "denied:module_not_allowed": { label: "MODULE", variant: "destructive", icon: XCircle },
    "denied:feature_not_in_plan": { label: "PLAN", variant: "destructive", icon: Lock },
    "denied:permission_denied": { label: "RBAC", variant: "destructive", icon: Shield },
  };

  return (
    <div dir="ltr" className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert size={20} /> System Route Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deterministic audit of all dashboard routes — fail-closed verification
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportJSON}
            className="gap-2"
          >
            <Download size={14} />
            Export JSON
          </Button>
          <Button
            size="sm"
            onClick={() => setAuditKey((k) => k + 1)}
            className="gap-2"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Run Audit
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Allowed", value: stats.allowed, color: "text-green-500" },
          { label: "Open", value: stats.open, color: "text-blue-400" },
          { label: "Denied", value: stats.denied, color: "text-destructive" },
          { label: "Warnings", value: stats.warnings, color: "text-yellow-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {s.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Global Warnings */}
      {globalWarnings.length > 0 && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-500">
              <AlertTriangle size={16} /> Global Warnings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {globalWarnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-600 font-mono">{w}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Context */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>Tenant: <strong className="text-foreground">{tenantType || "—"}</strong></span>
        <span>Role: <strong className="text-foreground">{userRole || "—"}</strong></span>
        {loading && <span className="animate-pulse">loading…</span>}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          placeholder="Filter by path, segment, featureKey, permissionKey, or status..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 font-mono text-sm"
        />
      </div>

      {/* Route Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-medium">Path</TableHead>
                <TableHead className="text-xs font-medium">Segment</TableHead>
                <TableHead className="text-xs font-medium">Feature Key</TableHead>
                <TableHead className="text-xs font-medium">Permission Key</TableHead>
                <TableHead className="text-xs font-medium">Module</TableHead>
                <TableHead className="text-xs font-medium text-center">Open?</TableHead>
                <TableHead className="text-xs font-medium text-center">Status</TableHead>
                <TableHead className="text-xs font-medium">Warnings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const sc = statusConfig[row.status];
                const StatusIcon = sc.icon;
                const hasWarnings = row.warnings.length > 0;
                return (
                  <TableRow
                    key={row.path}
                    className={`${hasWarnings ? "bg-yellow-500/5" : ""} ${
                      row.status === "denied:route_not_gated" ? "bg-destructive/5" : ""
                    }`}
                  >
                    <TableCell className="font-mono text-xs text-primary whitespace-nowrap">
                      /dashboard/{row.path}
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {row.gateSegment === "__empty__" ? (
                        <span className="text-destructive font-bold">⛔ EMPTY</span>
                      ) : (
                        row.gateSegment
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {row.derivedFeatureKey || <span className="text-yellow-500 italic">none</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {row.derivedPermissionKey || <span className="text-yellow-500 italic">none</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {row.module || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.isOpenRoute ? (
                        <Unlock size={14} className="inline text-blue-400" />
                      ) : (
                        <Lock size={14} className="inline text-muted-foreground/40" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={sc.variant} className="text-[9px] gap-1 whitespace-nowrap">
                        <StatusIcon size={10} />
                        {sc.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {hasWarnings ? (
                        <div className="space-y-0.5">
                          {row.warnings.map((w, i) => (
                            <div key={i} className="text-[10px] text-yellow-600 leading-tight">{w}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-green-500 text-[10px]">✓</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            No routes match "{query}"
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DebugSystemAudit;
