import { FEATURE_KEYS, type FeatureKey } from "@/lib/entitlement-types";
import { ROUTE_FEATURE_MAP, FEATURE_RBAC_MAP } from "@/lib/feature-route-map";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { useGranularPermissions } from "@/hooks/useGranularPermissions";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Route, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * All dashboard routes — generated from Dashboard.tsx renderContent().
 * Routes marked "intentionally_open" have no FeatureGate by design.
 */
const ALL_DASHBOARD_ROUTES: { segment: string; path: string; label: string; intentionallyOpen?: boolean }[] = [
  // Gated routes (auto-derived labels from ROUTE_FEATURE_MAP where available)
  ...Object.entries(ROUTE_FEATURE_MAP).map(([segment, entry]) => ({
    segment,
    path: `/dashboard/${segment}`,
    label: entry.label,
  })),
  // Additional gated routes not in the map
  { segment: "forecasting", path: "/dashboard/forecasting", label: "التنبؤ المالي" },

  // Intentionally open (no gate needed)
  { segment: "company", path: "/dashboard/company", label: "إعدادات الشركة", intentionallyOpen: true },
  { segment: "settings", path: "/dashboard/settings", label: "الإعدادات", intentionallyOpen: true },
  { segment: "subscription", path: "/dashboard/subscription", label: "الاشتراك", intentionallyOpen: true },
  { segment: "help", path: "/dashboard/help", label: "المساعدة", intentionallyOpen: true },
  { segment: "support", path: "/dashboard/support", label: "الدعم الفني", intentionallyOpen: true },
  { segment: "affiliate", path: "/dashboard/affiliate", label: "برنامج الشراكة", intentionallyOpen: true },
  { segment: "productivity", path: "/dashboard/productivity", label: "لوحة المحاسب", intentionallyOpen: true },
  { segment: "sheet-view", path: "/dashboard/sheet-view", label: "عرض الجداول", intentionallyOpen: true },
];

const DebugFeatureGates = () => {
  const { entitlementsMap, planSlug, planStatus, loading, invalidate } = useEntitlementsContext();
  const { canAny, loading: rbacLoading } = useGranularPermissions();
  const { userRole } = useAuth();

  const isOwner = userRole === "owner";

  const routeRows = ALL_DASHBOARD_ROUTES.map((route) => {
    const mapping = ROUTE_FEATURE_MAP[route.segment];
    const featureKey = mapping?.featureKey;
    const entEntry = featureKey ? entitlementsMap[featureKey] : null;
    const entAllowed = !featureKey || !!(entEntry?.allowed);
    const entReason = entEntry?.reason ?? (featureKey ? "not_found" : "no_gate");

    const rbacPerms = featureKey ? FEATURE_RBAC_MAP[featureKey] : null;
    const rbacAllowed = !rbacPerms || isOwner || canAny(...(rbacPerms as string[]));

    const overallAllowed = entAllowed && rbacAllowed;
    const blockedBy = !entAllowed ? "entitlement" : !rbacAllowed ? "rbac" : null;

    return { route, featureKey, mapping, entAllowed, entReason, rbacPerms, rbacAllowed, overallAllowed, blockedBy };
  });

  const blockedRoutes = routeRows.filter((r) => !r.overallAllowed);
  const unGatedRoutes = routeRows.filter((r) => !r.featureKey);
  const gatedRoutes = routeRows.filter((r) => r.featureKey);

  const mappedFeatureKeys = new Set(Object.values(ROUTE_FEATURE_MAP).map((m) => m.featureKey));
  const unmappedKeys = Object.values(FEATURE_KEYS).filter((k) => !mappedFeatureKeys.has(k as FeatureKey));

  return (
    <div dir="ltr" className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">🗺️ Feature Gates Audit</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All dashboard routes · entitlement + RBAC status · unified ACCESS_MAP
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={invalidate} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Link to="/debug/access-map">
            <Button size="sm" variant="outline">→ Access Map</Button>
          </Link>
          <Link to="/debug/entitlements">
            <Button size="sm" variant="outline">→ Entitlements</Button>
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Plan</p>
            <p className="font-bold text-sm">{planSlug || "—"}</p>
            <Badge variant={planStatus === "active" ? "default" : "destructive"} className="text-[9px] mt-1">
              {planStatus || "unknown"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Total Routes</p>
            <p className="font-bold text-xl">{ALL_DASHBOARD_ROUTES.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Gated</p>
            <p className="font-bold text-xl text-primary">{gatedRoutes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Open (intentional)</p>
            <p className="font-bold text-xl">{unGatedRoutes.length}</p>
          </CardContent>
        </Card>
        <Card className={blockedRoutes.length > 0 ? "border-destructive/40" : "border-green-500/40"}>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Blocked (for you)</p>
            <p className={`font-bold text-xl ${blockedRoutes.length > 0 ? "text-destructive" : "text-green-600"}`}>
              {blockedRoutes.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Blocked alert */}
      {blockedRoutes.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle size={14} />
              {blockedRoutes.length} Blocked Route(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {blockedRoutes.map(({ route, featureKey, blockedBy, entReason, rbacPerms }) => (
                <div key={route.path} className="flex items-center gap-2 text-xs font-mono">
                  <XCircle size={12} className="text-destructive shrink-0" />
                  <span className="font-bold">{route.path}</span>
                  <Badge variant="destructive" className="text-[9px]">
                    {blockedBy === "entitlement"
                      ? `❌ entitlement: ${entReason}`
                      : `🛡️ rbac: ${rbacPerms?.join(",")}`}
                  </Badge>
                  {featureKey && <span className="text-muted-foreground text-[10px]">[{featureKey}]</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unmapped feature keys */}
      {unmappedKeys.length > 0 && (
        <Card className="border-amber-400/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
              <AlertTriangle size={14} />
              {unmappedKeys.length} FEATURE_KEY(s) without Route Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {unmappedKeys.map((k) => (
                <Badge key={k} variant="outline" className="text-[10px] font-mono">{k}</Badge>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Used as inline gates or capacity limits (max_users, max_storage_gb, etc.)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Full routes table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Route size={14} />
            All Routes
            {(loading || rbacLoading) && <span className="text-[10px] text-muted-foreground animate-pulse">loading…</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-start py-2 pe-3 font-medium">Route</th>
                  <th className="text-start py-2 pe-3 font-medium">Label</th>
                  <th className="text-start py-2 pe-3 font-medium">FeatureKey</th>
                  <th className="text-start py-2 pe-3 font-medium">Entitled?</th>
                  <th className="text-start py-2 pe-3 font-medium">RBAC</th>
                  <th className="text-start py-2 font-medium">Final</th>
                </tr>
              </thead>
              <tbody>
                {routeRows.map(({ route, featureKey, entAllowed, entReason, rbacPerms, rbacAllowed, overallAllowed, blockedBy }) => (
                  <tr
                    key={route.path + route.segment}
                    className={`border-b border-border/20 hover:bg-muted/20 ${
                      !overallAllowed ? "bg-destructive/5" : ""
                    }`}
                  >
                    <td className="py-1.5 pe-3 font-mono text-[11px]">{route.path}</td>
                    <td className="py-1.5 pe-3">{route.label}</td>
                    <td className="py-1.5 pe-3">
                      {featureKey ? (
                        <span className="font-mono text-primary text-[10px]">{featureKey}</span>
                      ) : route.intentionallyOpen ? (
                        <span className="text-muted-foreground italic text-[10px]">open ✓</span>
                      ) : (
                        <span className="text-amber-500 font-bold text-[10px]">⚠ no gate</span>
                      )}
                    </td>
                    <td className="py-1.5 pe-3">
                      {!featureKey ? (
                        <span className="text-muted-foreground">—</span>
                      ) : entAllowed ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 size={11} /> {entReason}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-destructive">
                          <XCircle size={11} /> {entReason}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 pe-3">
                      {!rbacPerms ? (
                        <span className="text-muted-foreground">—</span>
                      ) : rbacAllowed ? (
                        <CheckCircle2 size={11} className="text-green-600" />
                      ) : (
                        <ShieldAlert size={11} className="text-destructive" />
                      )}
                    </td>
                    <td className="py-1.5">
                      {overallAllowed ? (
                        <Badge variant="secondary" className="text-[9px]">✓ open</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[9px]">
                          ✗ {blockedBy}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Intentionally open */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Intentionally Open Routes (no gate needed)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {unGatedRoutes.filter(r => r.route.intentionallyOpen).map(({ route }) => (
              <Badge key={route.path} variant="outline" className="text-[10px] font-mono">{route.path}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugFeatureGates;
