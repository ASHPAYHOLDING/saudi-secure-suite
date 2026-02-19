import { useEntitlementsContext, type EntitlementEntry } from "@/contexts/EntitlementsContext";
import { FEATURE_KEYS, type FeatureKey, type EntitlementResult } from "@/lib/entitlement-types";

// Re-export for backward compatibility
export { FEATURE_KEYS, type FeatureKey, type EntitlementResult };

interface EntitlementsState {
  entitlements: Record<string, EntitlementEntry>;
  loading: boolean;
  isTrial: boolean;
  planSlug: string | null;
}

/**
 * Reads entitlements from the centralized EntitlementsContext.
 * No RPC calls — everything is pre-fetched and cached (5 min staleTime).
 */
export const useEntitlements = (featureKeys?: FeatureKey[]): EntitlementsState => {
  const { entitlementsMap, loading, isTrial, planSlug } = useEntitlementsContext();

  if (!featureKeys) {
    return { entitlements: entitlementsMap, loading, isTrial, planSlug };
  }

  const filtered: Record<string, EntitlementEntry> = {};
  for (const key of featureKeys) {
    if (entitlementsMap[key]) {
      filtered[key] = entitlementsMap[key];
    }
  }

  return { entitlements: filtered, loading, isTrial, planSlug };
};

/**
 * Check a single feature entitlement.
 * Reads from the centralized cache — zero RPC calls.
 */
export const useFeatureGate = (
  featureKey: FeatureKey
): { allowed: boolean; loading: boolean; limit: number | null; reason: string } => {
  const { entitlementsMap, loading } = useEntitlementsContext();

  const entry = entitlementsMap[featureKey];

  // While loading, allow rendering (non-blocking)
  if (loading) {
    return { allowed: true, loading: true, limit: null, reason: "loading" };
  }

  if (!entry) {
    return { allowed: false, loading: false, limit: null, reason: "not_found" };
  }

  return {
    allowed: entry.allowed,
    loading: false,
    limit: entry.limit ?? null,
    reason: entry.reason,
  };
};
