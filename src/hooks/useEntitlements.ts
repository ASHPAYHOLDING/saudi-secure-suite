import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { FEATURE_KEYS, type FeatureKey, type EntitlementResult } from "@/lib/entitlement-types";

// Re-export for backward compatibility
export { FEATURE_KEYS, type FeatureKey, type EntitlementResult };

interface EntitlementsState {
  entitlements: Record<string, EntitlementResult>;
  loading: boolean;
  isTrial: boolean;
  planSlug: string | null;
}

/**
 * Reads entitlements from the centralized EntitlementsContext.
 * No RPC calls — everything is pre-fetched and cached (5 min staleTime).
 * 
 * Optional featureKeys param filters the returned entitlements map
 * but does NOT trigger a separate fetch.
 */
export const useEntitlements = (featureKeys?: FeatureKey[]): EntitlementsState => {
  const { entitlements, loading, isTrial, planSlug } = useEntitlementsContext();

  if (!featureKeys) {
    return { entitlements, loading, isTrial, planSlug };
  }

  const filtered: Record<string, EntitlementResult> = {};
  for (const key of featureKeys) {
    if (entitlements[key]) {
      filtered[key] = entitlements[key];
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
  const { entitlements, loading } = useEntitlementsContext();

  const entry = entitlements[featureKey];

  if (loading || !entry) {
    return { allowed: false, loading, limit: null, reason: loading ? "" : "not_found" };
  }

  return {
    allowed: entry.allowed,
    loading: false,
    limit: entry.limit ?? null,
    reason: entry.reason,
  };
};
