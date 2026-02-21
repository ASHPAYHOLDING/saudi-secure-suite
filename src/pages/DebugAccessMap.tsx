import { useState, useMemo } from "react";
import { ROUTE_FEATURE_MAP, FEATURE_RBAC_MAP, type AccessMapEntry } from "@/lib/feature-route-map";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { useGranularPermissions } from "@/hooks/useGranularPermissions";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Search, MapPin, ShieldCheck, Crown, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * /debug/access-map — Interactive Access Map Explorer
 *
 * Enter a route segment → see featureKey, permissionKeys, entitlement status,
 * RBAC status, and the final allow/deny decision with reasons.
 */
const DebugAccessMap = () => {
  const [query, setQuery] = useState("");
  const { entitlementsMap, planSlug, loading: entLoading } = useEntitlementsContext();
  const { can, canAny, loading: rbacLoading } = useGranularPermissions();
  const { userRole } = useAuth();

  const isOwner = userRole === "owner";
  const loading = entLoading || rbacLoading;

  const allSegments = useMemo(() => Object.keys(ROUTE_FEATURE_MAP), []);

  const filtered = useMemo(() => {
    if (!query.trim()) return allSegments;
    const q = query.toLowerCase().replace(/^\/dashboard\//, "").replace(/^\//, "");
    return allSegments.filter(
      (s) =>
        s.includes(q) ||
        ROUTE_FEATURE_MAP[s].label.includes(query) ||
        ROUTE_FEATURE_MAP[s].featureKey.includes(q)
    );
  }, [query, allSegments]);

  const evaluate = (entry: AccessMapEntry) => {
    // Entitlement check
    const entEntry = entitlementsMap[entry.featureKey];
    const entAllowed = !!(entEntry?.allowed);
    const entReason = entEntry?.reason ?? "not_found";

    // RBAC check
    const rbacPerms = entry.permissionKeys;
    let rbacAllowed = true;
    let rbacReason = "no_gate";
    if (rbacPerms.length > 0) {
      if (isOwner) {
        rbacAllowed = true;
        rbacReason = "owner_bypass";
      } else {
        rbacAllowed = canAny(...rbacPerms);
        rbacReason = rbacAllowed ? "granted" : "denied";
      }
    }

    const finalAllowed = entAllowed && rbacAllowed;
    const finalReason = !entAllowed
      ? `الميزة غير متاحة في الباقة (${entReason})`
      : !rbacAllowed
      ? `لا توجد صلاحية RBAC (${rbacPerms.join(", ")})`
      : "مسموح ✓";

    return { entAllowed, entReason, rbacAllowed, rbacReason, rbacPerms, finalAllowed, finalReason };
  };

  return (
    <div dir="ltr" className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <MapPin size={20} /> Access Map Explorer
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Single Source of Truth — ROUTE_FEATURE_MAP + derived FEATURE_RBAC_MAP
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/debug/feature-gates">
            <Button size="sm" variant="outline">→ Feature Gates</Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          placeholder="ابحث بـ route segment أو featureKey أو label..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 font-mono text-sm"
        />
      </div>

      {/* Context bar */}
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span>Plan: <strong className="text-foreground">{planSlug || "—"}</strong></span>
        <span>Role: <strong className="text-foreground">{userRole || "—"}</strong></span>
        <span>Entries: <strong className="text-foreground">{allSegments.length}</strong></span>
        {loading && <span className="animate-pulse">loading…</span>}
      </div>

      {/* How to add a new route */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-primary">
            <Info size={12} /> How to add a new gated route
          </div>
          <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
            <li>Add entry in <code className="text-primary">src/lib/feature-route-map.ts</code> → ROUTE_FEATURE_MAP</li>
            <li>Add route in <code className="text-primary">src/routes/dashboard-routes.tsx</code> with matching <code>gateSegment</code></li>
            <li>Done — FeatureGate, RouteGuard, sidebar, and debug pages auto-update.</li>
          </ol>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              لا توجد نتائج لـ "{query}"
            </CardContent>
          </Card>
        )}

        {filtered.map((segment) => {
          const entry = ROUTE_FEATURE_MAP[segment];
          const result = evaluate(entry);

          return (
            <Card
              key={segment}
              className={`transition-colors ${
                result.finalAllowed ? "border-green-500/30" : "border-destructive/30 bg-destructive/5"
              }`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-primary">/dashboard/{segment}</span>
                    <span className="text-muted-foreground font-normal">— {entry.label}</span>
                  </div>
                  <Badge variant={result.finalAllowed ? "secondary" : "destructive"} className="text-[10px]">
                    {result.finalAllowed ? "✓ ALLOWED" : "✗ DENIED"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">{entry.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* Feature Key */}
                  <div className="rounded border p-2 space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <Crown size={11} /> Feature Key
                    </div>
                    <code className="text-primary text-[10px]">{entry.featureKey}</code>
                    <div className="flex items-center gap-1 mt-1">
                      {result.entAllowed ? (
                        <><CheckCircle2 size={11} className="text-green-600" /> <span className="text-green-600">{result.entReason}</span></>
                      ) : (
                        <><XCircle size={11} className="text-destructive" /> <span className="text-destructive">{result.entReason}</span></>
                      )}
                    </div>
                  </div>

                  {/* Permission Keys */}
                  <div className="rounded border p-2 space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <ShieldCheck size={11} /> Permission Keys (RBAC)
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {entry.permissionKeys.length > 0 ? entry.permissionKeys.map((pk) => (
                        <Badge key={pk} variant="outline" className="text-[9px] font-mono">{pk}</Badge>
                      )) : (
                        <span className="text-muted-foreground italic">none</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {result.rbacAllowed ? (
                        <><CheckCircle2 size={11} className="text-green-600" /> <span className="text-green-600">{result.rbacReason}</span></>
                      ) : (
                        <><XCircle size={11} className="text-destructive" /> <span className="text-destructive">{result.rbacReason}</span></>
                      )}
                    </div>
                  </div>

                  {/* Final Decision */}
                  <div className={`rounded border p-2 space-y-1 ${result.finalAllowed ? "bg-green-500/5" : "bg-destructive/5"}`}>
                    <div className="font-bold">Final Decision</div>
                    <p className={result.finalAllowed ? "text-green-700" : "text-destructive"}>
                      {result.finalReason}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default DebugAccessMap;
