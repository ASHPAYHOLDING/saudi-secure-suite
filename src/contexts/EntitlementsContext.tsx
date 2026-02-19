import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { timedCall } from "@/lib/timed-call";
import { FEATURE_KEYS, type EntitlementResult } from "@/lib/entitlement-types";

export interface EntitlementEntry {
  allowed: boolean;
  reason: string;
  limit?: number | null;
  plan?: string;
}

export interface EntitlementsState {
  tenantId: string | null;
  fetchedAt: number | null;
  planSlug: string | null;
  planStatus: string | null;
  entitlementsMap: Record<string, EntitlementEntry>;
  loading: boolean;
  isTrial: boolean;
  error: string | null;
  fetchCount: number;
  /** Force refetch (e.g. after plan change) */
  invalidate: () => void;
}

const EntitlementsContext = createContext<EntitlementsState>({
  tenantId: null,
  fetchedAt: null,
  planSlug: null,
  planStatus: null,
  entitlementsMap: {},
  loading: true,
  isTrial: false,
  error: null,
  fetchCount: 0,
  invalidate: () => {},
});

export const useEntitlementsContext = () => useContext(EntitlementsContext);

export const ENTITLEMENTS_CACHE_KEY = "entitlements";
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const GC_TIME = 15 * 60 * 1000; // 15 minutes

// Track fetch count globally for diagnostics
let globalFetchCount = 0;

export async function fetchEntitlementsBulk(tenantId: string): Promise<{
  entitlements: Record<string, EntitlementResult>;
  planSlug: string | null;
  planStatus: string | null;
}> {
  const start = performance.now();
  console.log(`[entitlements] Fetch start | tenantId=${tenantId}`);

  // Run both calls in parallel
  const [cacheResult, subResult] = await Promise.all([
    timedCall(
      "get_entitlements_cached",
      async () => (supabase.rpc as any)("get_entitlements_cached", { p_tenant_id: tenantId }),
      `entitlements-cached-${tenantId}`
    ),
    timedCall(
      "subscription.select",
      async () =>
        supabase
          .from("subscriptions")
          .select("status, plan_id, subscription_plans(slug)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      `subscription-info-${tenantId}`
    ),
  ]);

  const cachedData = (cacheResult as any)?.data;
  const cacheError = (cacheResult as any)?.error;
  const subData = (subResult as any)?.data;
  const planInfo = subData as any;

  const duration = Math.round(performance.now() - start);
  globalFetchCount++;
  console.log(`[entitlements] Fetch end | ${duration}ms | tenantId=${tenantId} | cacheHit=${!!cachedData && !cacheError} | fetchCount=${globalFetchCount}`);

  // If cache RPC worked and returned data, use it
  if (!cacheError && cachedData && Object.keys(cachedData).length > 0) {
    return {
      entitlements: cachedData as unknown as Record<string, EntitlementResult>,
      planSlug: planInfo?.subscription_plans?.slug ?? null,
      planStatus: planInfo?.status ?? null,
    };
  }

  // Fallback: fetch from plan_entitlements directly
  console.warn("[entitlements] Cache miss, using fallback", cacheError?.message || "empty cache");
  const planId = planInfo?.plan_id;

  if (!planId) {
    return { entitlements: {}, planSlug: null, planStatus: planInfo?.status ?? null };
  }

  const fallbackResult = await timedCall(
    "plan_entitlements.fallback",
    async () =>
      supabase
        .from("plan_entitlements")
        .select("feature_key, is_enabled, limit_value")
        .eq("plan_id", planId),
    `plan-entitlements-fallback-${planId}`
  );
  const rows = (fallbackResult as any)?.data as any[] | null;

  const map: Record<string, EntitlementResult> = {};
  for (const e of rows ?? []) {
    map[e.feature_key] = {
      allowed: e.is_enabled,
      reason: e.is_enabled ? "plan" : "not_in_plan",
      limit: e.limit_value,
      plan: planInfo?.subscription_plans?.slug,
    };
  }

  console.log(`[entitlements] Fallback loaded ${Object.keys(map).length} features`);

  return {
    entitlements: map,
    planSlug: planInfo?.subscription_plans?.slug ?? null,
    planStatus: planInfo?.status ?? null,
  };
}

export const EntitlementsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [subscriptionUpdatedAt, setSubscriptionUpdatedAt] = useState<number>(Date.now());

  const { data, isLoading, error } = useQuery({
    queryKey: [ENTITLEMENTS_CACHE_KEY, tenantId, subscriptionUpdatedAt],
    queryFn: () => fetchEntitlementsBulk(tenantId!),
    enabled: !!tenantId,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  // Realtime: listen for subscription changes to auto-invalidate
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`entitlements-sub-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          console.log("[entitlements] Subscription changed — invalidating cache");
          setSubscriptionUpdatedAt(Date.now());
          queryClient.invalidateQueries({ queryKey: [ENTITLEMENTS_CACHE_KEY, tenantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  const entitlementsMap = data?.entitlements ?? {};
  const firstKey = Object.keys(entitlementsMap)[0];
  const isTrial = firstKey ? entitlementsMap[firstKey]?.reason === "trial" : false;

  const invalidate = useCallback(() => {
    setSubscriptionUpdatedAt(Date.now());
    queryClient.invalidateQueries({ queryKey: [ENTITLEMENTS_CACHE_KEY] });
  }, [queryClient]);

  return (
    <EntitlementsContext.Provider
      value={{
        tenantId: tenantId ?? null,
        fetchedAt: data ? Date.now() : null,
        planSlug: data?.planSlug ?? null,
        planStatus: data?.planStatus ?? null,
        entitlementsMap,
        loading: isLoading,
        isTrial,
        error: error?.message ?? null,
        fetchCount: globalFetchCount,
        invalidate,
      }}
    >
      {children}
    </EntitlementsContext.Provider>
  );
};
