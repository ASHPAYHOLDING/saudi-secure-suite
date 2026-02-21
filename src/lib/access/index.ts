/**
 * Unified Access Control Layer
 *
 * Single entry-point that combines:
 *   1. Entitlements (plan-level feature gates)
 *   2. RBAC (user-level permissions within a tenant)
 *
 * Decision matrix:
 *   ┌────────────────┬──────────────┬────────┐
 *   │ Entitlement    │ Permission   │ Result │
 *   ├────────────────┼──────────────┼────────┤
 *   │ ✅ allowed     │ ✅ granted   │ ✅     │
 *   │ ✅ allowed     │ ❌ denied    │ ❌     │
 *   │ ❌ not in plan │ (any)        │ ❌     │
 *   │ (not checked)  │ ✅ granted   │ ✅     │
 *   └────────────────┴──────────────┴────────┘
 */

export interface AccessQuery {
  /** RBAC permission key (e.g. "invoices.create") */
  permissionKey: string;
  /** Optional entitlement/feature key (e.g. "invoices_basic") — if omitted, only RBAC is checked */
  featureKey?: string;
}

export interface AccessResult {
  allowed: boolean;
  /** Why access was denied */
  reason?: "feature_not_in_plan" | "permission_denied" | "loading";
  /** Whether the entitlement check passed (undefined if not checked) */
  featureAllowed?: boolean;
  /** Whether the RBAC check passed */
  permissionGranted?: boolean;
}

/**
 * Pure function that evaluates access given pre-fetched entitlements & permissions.
 * No async, no DB calls — designed for synchronous UI rendering.
 */
export function evaluateAccess(
  query: AccessQuery,
  entitlementsMap: Record<string, { allowed: boolean }>,
  permissionChecker: (key: string) => boolean,
): AccessResult {
  // 1. Check entitlement (plan-level)
  let featureAllowed: boolean | undefined;
  if (query.featureKey) {
    const entry = entitlementsMap[query.featureKey];
    featureAllowed = entry?.allowed ?? false;
    if (!featureAllowed) {
      return {
        allowed: false,
        reason: "feature_not_in_plan",
        featureAllowed: false,
        permissionGranted: undefined,
      };
    }
  }

  // 2. Check RBAC permission (skip if wildcard "*")
  if (query.permissionKey === "*") {
    return { allowed: true, featureAllowed, permissionGranted: true };
  }

  const permissionGranted = permissionChecker(query.permissionKey);
  if (!permissionGranted) {
    return {
      allowed: false,
      reason: "permission_denied",
      featureAllowed,
      permissionGranted: false,
    };
  }

  return { allowed: true, featureAllowed, permissionGranted: true };
}
