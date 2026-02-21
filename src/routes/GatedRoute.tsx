import { useAuth } from "@/contexts/AuthContext";
import { isModuleAllowed, type Module } from "@/lib/tenant-modules";
import RouteGuard from "@/components/guards/RouteGuard";
import AccessDenied from "@/components/guards/AccessDenied";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";

/** Routes that are intentionally open (no entitlement/RBAC gate). */
const INTENTIONALLY_OPEN_SEGMENTS = new Set([
  "help",
  "subscription",
  "support",
  "support/new",
]);

interface GatedRouteProps {
  segment: string;
  module?: Module;
  permissionKey?: string;
  children: React.ReactNode;
}

/**
 * Wraps a dashboard route with:
 * 1. Tenant-type module check — fail closed with AccessDenied
 * 2. RouteGuard (entitlements + RBAC) — blocks direct URL access
 *
 * Automatically derives featureKey & permissionKey from ROUTE_FEATURE_MAP.
 * Unknown/ungated segments are **blocked** in production (fail-closed).
 */
const GatedRoute = ({ segment, module, permissionKey, children }: GatedRouteProps) => {
  const { tenantType } = useAuth();

  // 1) Module guard — fail closed
  if (module && !isModuleAllowed(tenantType, module)) {
    return <AccessDenied reason="module_not_allowed" />;
  }

  const mapping = ROUTE_FEATURE_MAP[segment];
  const featureKey = mapping?.featureKey;
  const featureLabel = mapping?.label;

  // Auto-derive permissionKey from ROUTE_FEATURE_MAP if not explicitly passed
  const resolvedPermissionKey =
    permissionKey ?? (mapping?.permissionKeys?.[0] || undefined);

  const isIntentionallyOpen = INTENTIONALLY_OPEN_SEGMENTS.has(segment);

  // 2) Dev warning for missing mapping
  if (import.meta.env.DEV && !mapping && !isIntentionallyOpen) {
    console.warn(
      `[GatedRoute] ⚠️ Route segment "${segment}" has no ROUTE_FEATURE_MAP entry. ` +
      `Add it to ROUTE_FEATURE_MAP or INTENTIONALLY_OPEN_SEGMENTS.`
    );
  }

  // 3) Fail-closed: unknown/ungated segments blocked unless intentionally open
  if (!featureKey && !resolvedPermissionKey) {
    if (isIntentionallyOpen) return <>{children}</>;
    return <AccessDenied reason="route_not_gated" />;
  }

  // 4) Normal: guard by feature + permission
  return (
    <RouteGuard
      featureKey={featureKey}
      permissionKey={resolvedPermissionKey}
      featureLabel={featureLabel}
    >
      {children}
    </RouteGuard>
  );
};

export default GatedRoute;
