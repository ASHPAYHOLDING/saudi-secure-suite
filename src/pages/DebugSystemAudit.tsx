import { useState, useMemo, useCallback } from "react";
import { DASHBOARD_ROUTES, type DashboardRouteConfig } from "@/routes/dashboard-routes";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { useGranularPermissions } from "@/hooks/useGranularPermissions";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// ── Component ──

const DebugSystemAudit = () => {
  const [auditKey, setAuditKey] = useState(0);
  const [query, setQuery] = useState("");
  const { entitlementsMap, loading: entLoading } = useEntitlementsContext();
  const { canAny, loading: rbacLoading } = useGranularPermissions();
  const { userRole, tenantType } = useAuth();
  const isOwner = userRole === "owner";
  const loading = entLoading || rbacLoading;

  const runAudit = useCallback((): AuditRow[] => {
    return DASHBOARD_ROUTES.map((route) => {
      const segment = route.gateSegment ?? route.path.split("/")[0];
      const mapping = ROUTE_FEATURE_MAP[segment];
      const derivedFeatureKey = mapping?.featureKey;
      const derivedPermissionKey =
        route.permissionKey ?? mapping?.permissionKeys?.[0];
      const isOpen = !!route.isOpenRoute;
      const warnings: string[] = [];

      // ── Warning checks ──
      if (segment === "" || segment === "unknown") {
        warnings.push("⛔ segment is empty or 'unknown' — fail-closed risk");
      }
      if (!derivedFeatureKey && !derivedPermissionKey && !isOpen) {
        warnings.push(
          "⚠️ No featureKey, no permissionKey, not isOpenRoute → will be denied(route_not_gated)"
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
      } else if (!derivedFeatureKey && !derivedPermissionKey) {
        status = "denied:route_not_gated";
      } else {
        // Entitlement check
        const entAllowed = derivedFeatureKey
          ? !!entitlementsMap[derivedFeatureKey]?.allowed
          : true;

        // RBAC check
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
  }, [entitlementsMap, canAny, isOwner, auditKey]);

  const rows = useMemo(() => runAudit(), [runAudit]);

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
    const emptySegments = rows.filter(
      (r) => r.gateSegment === "" || r.gateSegment === "unknown"
    );
    if (emptySegments.length > 0) {
      w.push(
        `⛔ ${emptySegments.length} route(s) with empty/unknown segment: ${emptySegments.map((r) => r.path).join(", ")}`
      );
    }
    const ungated = rows.filter(
      (r) =>
        !r.isOpenRoute &&
        !r.derivedFeatureKey &&
        !r.derivedPermissionKey
    );
    if (ungated.length > 0) {
      w.push(
        `⚠️ ${ungated.length} route(s) with no gate and not open (will show AccessDenied): ${ungated.map((r) => r.path).join(", ")}`
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

  const statusConfig: Record<AuditStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
    allowed: { label: "ALLOWED", variant: "secondary", icon: CheckCircle2 },
    open_route: { label: "OPEN", variant: "outline", icon: Unlock },
    "denied:route_not_gated": { label: "DENIED (not gated)", variant: "destructive", icon: ShieldAlert },
    "denied:module_not_allowed": { label: "DENIED (module)", variant: "destructive", icon: XCircle },
    "denied:feature_not_in_plan": { label: "DENIED (plan)", variant: "destructive", icon: Lock },
    "denied:permission_denied": { label: "DENIED (RBAC)", variant: "destructive", icon: Shield },
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
              <p key={i} className="text-xs text-yellow-600 font-mono">
                {w}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Context */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>
          Tenant:{" "}
          <strong className="text-foreground">{tenantType || "—"}</strong>
        </span>
        <span>
          Role: <strong className="text-foreground">{userRole || "—"}</strong>
        </span>
        {loading && <span className="animate-pulse">loading…</span>}
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={16}
        />
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
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="text-left p-2 font-medium">Path</th>
                <th className="text-left p-2 font-medium">Segment</th>
                <th className="text-left p-2 font-medium">Feature Key</th>
                <th className="text-left p-2 font-medium">Permission Key</th>
                <th className="text-left p-2 font-medium">Module</th>
                <th className="text-center p-2 font-medium">Open?</th>
                <th className="text-center p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium">Warnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => {
                const sc = statusConfig[row.status];
                const StatusIcon = sc.icon;
                const hasWarnings = row.warnings.length > 0;
                return (
                  <tr
                    key={row.path}
                    className={`hover:bg-muted/30 transition-colors ${
                      hasWarnings ? "bg-yellow-500/5" : ""
                    } ${row.status.startsWith("denied:route_not_gated") ? "bg-destructive/5" : ""}`}
                  >
                    <td className="p-2 font-mono text-primary whitespace-nowrap">
                      /dashboard/{row.path}
                    </td>
                    <td className="p-2 font-mono whitespace-nowrap">
                      {row.gateSegment || (
                        <span className="text-destructive font-bold">
                          ⛔ EMPTY
                        </span>
                      )}
                    </td>
                    <td className="p-2 font-mono text-muted-foreground whitespace-nowrap">
                      {row.derivedFeatureKey || (
                        <span className="text-yellow-500 italic">none</span>
                      )}
                    </td>
                    <td className="p-2 font-mono text-muted-foreground whitespace-nowrap">
                      {row.derivedPermissionKey || (
                        <span className="text-yellow-500 italic">none</span>
                      )}
                    </td>
                    <td className="p-2 font-mono text-muted-foreground whitespace-nowrap">
                      {row.module || "—"}
                    </td>
                    <td className="p-2 text-center">
                      {row.isOpenRoute ? (
                        <Unlock size={14} className="inline text-blue-400" />
                      ) : (
                        <Lock size={14} className="inline text-muted-foreground/40" />
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <Badge
                        variant={sc.variant}
                        className="text-[9px] gap-1 whitespace-nowrap"
                      >
                        <StatusIcon size={10} />
                        {sc.label}
                      </Badge>
                    </td>
                    <td className="p-2">
                      {hasWarnings ? (
                        <div className="space-y-0.5">
                          {row.warnings.map((w, i) => (
                            <div
                              key={i}
                              className="text-[10px] text-yellow-600 leading-tight"
                            >
                              {w}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-green-500 text-[10px]">✓</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
