import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isModuleAllowed, type Module } from "@/lib/tenant-modules";
import RouteGuard from "@/components/guards/RouteGuard";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";

/** Routes that are intentionally open (no entitlement/RBAC gate). */
const INTENTIONALLY_OPEN_SEGMENTS = new Set([
  "help",
  "subscription",
  "support",
  "support/new",
  "settings",
]);

interface GatedRouteProps {
  segment: string;
  module?: Module;
  permissionKey?: string;
  children: React.ReactNode;
}

/**
 * Wraps a dashboard route with:
 * 1. Tenant-type module check (individual / freelancer / company)
 * 2. RouteGuard (entitlements + RBAC) — blocks direct URL access with AccessDenied
 *
 * Automatically derives featureKey & permissionKey from ROUTE_FEATURE_MAP
 * when gateSegment is provided. Warns in dev if a route has no gate.
 */
const GatedRoute = ({ segment, module, permissionKey, children }: GatedRouteProps) => {
  const { tenantType } = useAuth();

  // Tenant-type module guard
  if (module && !isModuleAllowed(tenantType, module)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Feature entitlement + RBAC gate via RouteGuard
  const mapping = ROUTE_FEATURE_MAP[segment];
  const featureKey = mapping?.featureKey;
  const featureLabel = mapping?.label;

  // Auto-derive permissionKey from ROUTE_FEATURE_MAP if not explicitly passed
  const resolvedPermissionKey =
    permissionKey ?? (mapping?.permissionKeys?.[0] || undefined);

  // Dev warning: route has no gate and is not intentionally open
  if (import.meta.env.DEV && !featureKey && !resolvedPermissionKey && !INTENTIONALLY_OPEN_SEGMENTS.has(segment)) {
    console.warn(
      `[GatedRoute] ⚠️ Route segment "${segment}" has no featureKey or permissionKey. ` +
      `Add it to ROUTE_FEATURE_MAP or INTENTIONALLY_OPEN_SEGMENTS.`
    );
  }

  // If we have either a featureKey or permissionKey, wrap in RouteGuard
  if (featureKey || resolvedPermissionKey) {
    return (
      <RouteGuard
        featureKey={featureKey}
        permissionKey={resolvedPermissionKey}
        featureLabel={featureLabel}
      >
        {children}
      </RouteGuard>
    );
  }

  return <>{children}</>;
};

export default GatedRoute;
