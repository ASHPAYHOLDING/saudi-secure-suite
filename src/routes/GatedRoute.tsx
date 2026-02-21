import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isModuleAllowed, type Module } from "@/lib/tenant-modules";
import RouteGuard from "@/components/guards/RouteGuard";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";

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

  // If we have either a featureKey or permissionKey, wrap in RouteGuard
  if (featureKey || permissionKey) {
    return (
      <RouteGuard
        featureKey={featureKey}
        permissionKey={permissionKey}
        featureLabel={featureLabel}
      >
        {children}
      </RouteGuard>
    );
  }

  return <>{children}</>;
};

export default GatedRoute;
