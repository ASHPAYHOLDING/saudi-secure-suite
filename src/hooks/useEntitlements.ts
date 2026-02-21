import { useEntitlementsContext, type EntitlementEntry } from "@/contexts/EntitlementsContext";
import { FEATURE_KEYS, type FeatureKey, type EntitlementResult, type PlanSlug } from "@/lib/entitlement-types";

// Re-export for backward compatibility
export { FEATURE_KEYS, type FeatureKey, type EntitlementResult, type PlanSlug };

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

// ═══════════════════════════════════════════════════════════
//  Convenience helpers — read from cached entitlementsMap
// ═══════════════════════════════════════════════════════════

/** Check if current tenant can use a specific feature */
export const useCanUseFeature = (featureKey: FeatureKey): boolean => {
  const { allowed } = useFeatureGate(featureKey);
  return allowed;
};

/** Check if current tenant can use AI at the required level (0=none, 1=basic, 2=advanced) */
export const useCanUseAI = (requiredLevel: number = 1): boolean => {
  const { entitlementsMap, loading } = useEntitlementsContext();
  if (loading) return true; // non-blocking
  const entry = entitlementsMap[FEATURE_KEYS.AI_ACCOUNTING];
  if (!entry?.allowed) return requiredLevel === 0;
  return (entry.limit ?? 0) >= requiredLevel;
};

/** Check if current tenant can create more invoices (within monthly limit) */
export const useCanCreateInvoice = (): { allowed: boolean; limit: number | null } => {
  const { entitlementsMap, loading } = useEntitlementsContext();
  if (loading) return { allowed: true, limit: null };
  const entry = entitlementsMap[FEATURE_KEYS.INVOICES_BASIC];
  if (!entry) return { allowed: false, limit: null };
  return { allowed: entry.allowed, limit: entry.limit ?? null };
};

/** Check if approvals/workflows are enabled for current plan */
export const useCanUseApprovals = (): boolean => {
  return useCanUseFeature(FEATURE_KEYS.APPROVALS_ENABLED);
};

/** Get current plan slug */
export const usePlanSlug = (): PlanSlug | null => {
  const { planSlug } = useEntitlementsContext();
  return planSlug as PlanSlug | null;
};
