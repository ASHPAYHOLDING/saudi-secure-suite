import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { FEATURE_KEYS } from "@/lib/entitlement-types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Database, Code, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

const allFeatureKeys = Object.values(FEATURE_KEYS);

// Dice coefficient for string similarity
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bi = a.substring(i, i + 2);
    bigrams.set(bi, (bigrams.get(bi) || 0) + 1);
  }
  let intersect = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bi = b.substring(i, i + 2);
    const count = bigrams.get(bi) || 0;
    if (count > 0) {
      bigrams.set(bi, count - 1);
      intersect++;
    }
  }
  return (2 * intersect) / (a.length + b.length - 2);
}

function findCloseMatches(key: string, candidates: string[], threshold = 0.35) {
  return candidates
    .map((c) => ({ key: c, score: stringSimilarity(key, c) }))
    .filter((x) => x.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

const DebugEntitlements = () => {
  const {
    tenantId,
    fetchedAt,
    planSlug,
    planStatus,
    entitlementsMap,
    loading,
    isTrial,
    error,
    fetchCount,
    invalidate,
  } = useEntitlementsContext();

  // Fetch plan_id for current tenant
  const { data: subData } = useQuery({
    queryKey: ["debug-sub", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("plan_id, subscription_plans(slug)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  const planId = (subData as any)?.plan_id as string | undefined;

  // Fetch all feature_keys from plan_entitlements for this plan
  const { data: dbKeys, isLoading: dbLoading } = useQuery({
    queryKey: ["debug-plan-entitlements", planId],
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_entitlements")
        .select("feature_key, is_enabled, limit_value")
        .eq("plan_id", planId!);
      return (data ?? []) as { feature_key: string; is_enabled: boolean; limit_value: number | null }[];
    },
    enabled: !!planId,
  });

  const dbFeatureKeys = useMemo(() => (dbKeys ?? []).map((r) => r.feature_key), [dbKeys]);
  const codeKeys = allFeatureKeys;

  const missingInDB = useMemo(
    () => codeKeys.filter((k) => !dbFeatureKeys.includes(k)),
    [codeKeys, dbFeatureKeys]
  );
  const missingInCode = useMemo(
    () => dbFeatureKeys.filter((k) => !codeKeys.includes(k as any)),
    [codeKeys, dbFeatureKeys]
  );
  const matchedKeys = useMemo(
    () => codeKeys.filter((k) => dbFeatureKeys.includes(k)),
    [codeKeys, dbFeatureKeys]
  );

  const closeMatchesForDB = useMemo(
    () =>
      missingInDB.map((k) => ({
        key: k,
        matches: findCloseMatches(k, dbFeatureKeys),
      })),
    [missingInDB, dbFeatureKeys]
  );

  const closeMatchesForCode = useMemo(
    () =>
      missingInCode.map((k) => ({
        key: k,
        matches: findCloseMatches(k, codeKeys),
      })),
    [missingInCode, codeKeys]
  );

  const responseKeys = Object.keys(entitlementsMap);

  return (
    <div dir="ltr" className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">🔍 Entitlements Debug</h1>
        <Button size="sm" variant="outline" onClick={invalidate} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Refetch
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Tenant ID</p>
            <p className="text-[11px] font-mono break-all">{tenantId || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Plan</p>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold">{planSlug || "—"}</p>
              <Badge variant={planStatus === "active" ? "default" : "destructive"} className="text-[10px]">
                {planStatus || "unknown"}
              </Badge>
              {isTrial && <Badge variant="secondary" className="text-[10px]">trial</Badge>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Last Fetch</p>
            <p className="text-sm font-mono">
              {fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              fetches: {fetchCount} | {loading ? "⏳" : error ? "❌" : "✅"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Key Counts</p>
            <p className="text-sm">
              <span className="font-mono text-green-600">{matchedKeys.length}</span> matched ·{" "}
              <span className="font-mono text-orange-500">{missingInDB.length}</span> missing DB ·{" "}
              <span className="font-mono text-red-500">{missingInCode.length}</span> missing code
            </p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <p className="text-sm text-destructive font-mono">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* ===== DB Sanity Check ===== */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database size={14} />
            DB ↔ Code Sanity Check
            {dbLoading && <span className="text-[10px] text-muted-foreground animate-pulse">loading…</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* A) Keys missing in DB */}
          {missingInDB.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-orange-600 flex items-center gap-1.5">
                <AlertTriangle size={12} />
                Keys in Code but NOT in DB ({missingInDB.length})
              </h3>
              <div className="space-y-1.5">
                {closeMatchesForDB.map(({ key, matches }) => (
                  <div key={key} className="flex items-start gap-2 rounded border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800/30 p-2 text-xs">
                    <Code size={12} className="mt-0.5 text-orange-500 shrink-0" />
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-mono font-bold">{key}</span>
                      {matches.length > 0 ? (
                        <div className="text-muted-foreground">
                          Close DB match: {matches.map((m) => (
                            <span key={m.key} className="font-mono text-primary mx-1">
                              {m.key} ({(m.score * 100).toFixed(0)}%)
                            </span>
                          ))}
                          <span className="block mt-0.5 text-orange-700 dark:text-orange-400">
                            → Action: Rename key in UI code to match DB key
                          </span>
                        </div>
                      ) : (
                        <div className="text-orange-700 dark:text-orange-400">
                          → Action: Add <span className="font-mono">"{key}"</span> to plan_entitlements table for plan <span className="font-mono">{planId?.slice(0, 8)}…</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* B) Keys in DB but missing in code */}
          {missingInCode.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
                <AlertTriangle size={12} />
                Keys in DB but NOT in Code ({missingInCode.length})
              </h3>
              <div className="space-y-1.5">
                {closeMatchesForCode.map(({ key, matches }) => (
                  <div key={key} className="flex items-start gap-2 rounded border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800/30 p-2 text-xs">
                    <Database size={12} className="mt-0.5 text-red-500 shrink-0" />
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-mono font-bold">{key}</span>
                      {matches.length > 0 ? (
                        <div className="text-muted-foreground">
                          Close code match: {matches.map((m) => (
                            <span key={m.key} className="font-mono text-primary mx-1">
                              {m.key} ({(m.score * 100).toFixed(0)}%)
                            </span>
                          ))}
                          <span className="block mt-0.5 text-red-700 dark:text-red-400">
                            → Action: Rename DB key to match code, or add to FEATURE_KEYS in entitlement-types.ts
                          </span>
                        </div>
                      ) : (
                        <div className="text-red-700 dark:text-red-400">
                          → Action: Add <span className="font-mono">"{key}"</span> to FEATURE_KEYS in <span className="font-mono">src/lib/entitlement-types.ts</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* C) All matched */}
          {missingInDB.length === 0 && missingInCode.length === 0 && !dbLoading && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 size={16} />
              All {matchedKeys.length} keys match between Code and DB. No mismatches.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Full Entitlements Table ===== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Entitlements Map
            <Badge variant="secondary" className="text-[10px]">
              {responseKeys.length} in cache / {allFeatureKeys.length} in code / {dbFeatureKeys.length} in DB
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-start py-2 pe-3">Key</th>
                  <th className="text-start py-2 pe-3">Status</th>
                  <th className="text-start py-2 pe-3">Reason</th>
                  <th className="text-start py-2 pe-3">In DB</th>
                  <th className="text-start py-2 pe-3">Limit</th>
                  <th className="text-start py-2">Plan</th>
                </tr>
              </thead>
              <tbody>
                {allFeatureKeys.map((key) => {
                  const entry = entitlementsMap[key];
                  const inResponse = !!entry;
                  const inDB = dbFeatureKeys.includes(key);
                  return (
                    <tr
                      key={key}
                      className={`border-b border-border/20 hover:bg-muted/30 ${
                        !inResponse ? "bg-destructive/5" : ""
                      }`}
                    >
                      <td className="py-2 pe-3 font-mono text-xs">{key}</td>
                      <td className="py-2 pe-3">
                        {!inResponse ? (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <AlertTriangle size={12} />
                            <span className="text-[10px]">missing</span>
                          </div>
                        ) : entry.allowed ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 size={12} />
                            <span className="text-[10px]">allowed</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-destructive">
                            <XCircle size={12} />
                            <span className="text-[10px]">denied</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 pe-3 text-xs text-muted-foreground">
                        {entry?.reason || "—"}
                      </td>
                      <td className="py-2 pe-3">
                        {inDB ? (
                          <CheckCircle2 size={12} className="text-green-600" />
                        ) : (
                          <XCircle size={12} className="text-orange-500" />
                        )}
                      </td>
                      <td className="py-2 pe-3 text-xs font-mono">
                        {entry?.limit != null ? entry.limit : "—"}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {entry?.plan || "—"}
                      </td>
                    </tr>
                  );
                })}
                {/* Show DB-only keys at the bottom */}
                {missingInCode.map((key) => (
                  <tr key={`db-${key}`} className="border-b border-border/20 bg-red-50/50 dark:bg-red-950/10">
                    <td className="py-2 pe-3 font-mono text-xs text-red-600">{key} <span className="text-[9px]">(DB only)</span></td>
                    <td className="py-2 pe-3 text-[10px] text-muted-foreground">—</td>
                    <td className="py-2 pe-3 text-[10px] text-muted-foreground">not in code</td>
                    <td className="py-2 pe-3"><CheckCircle2 size={12} className="text-green-600" /></td>
                    <td className="py-2 pe-3 text-xs font-mono">—</td>
                    <td className="py-2 text-xs text-muted-foreground">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugEntitlements;
