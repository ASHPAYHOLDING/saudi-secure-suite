/**
 * useAccess — unified hook for access control decisions.
 *
 * Reads from:
 *   - EntitlementsContext (plan features) — already cached, zero extra queries
 *   - useGranularPermissions (RBAC)       — already cached, zero extra queries
 *
 * TODO (Phase 2): Replace useGranularPermissions with a single RPC call
 *                 that returns both entitlements + permissions in one round-trip.
 */
import { useMemo } from "react";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { useGranularPermissions } from "@/hooks/useGranularPermissions";
import { evaluateAccess, type AccessResult } from "@/lib/access/index";

export function useAccess(
  permissionKey: string,
  featureKey?: string,
): AccessResult & { loading: boolean } {
  const { entitlementsMap, loading: entLoading } = useEntitlementsContext();
  const { can, loading: permLoading } = useGranularPermissions();

  const loading = entLoading || permLoading;

  return useMemo(() => {
    if (loading) {
      return { allowed: false, reason: "loading" as const, loading: true };
    }
    const result = evaluateAccess(
      { permissionKey, featureKey },
      entitlementsMap,
      can,
    );
    return { ...result, loading: false };
  }, [permissionKey, featureKey, entitlementsMap, can, loading]);
}
