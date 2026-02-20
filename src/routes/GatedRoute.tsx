import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isModuleAllowed, type Module } from "@/lib/tenant-modules";
import FeatureGate from "@/components/subscription/FeatureGate";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";

interface GatedRouteProps {
  segment: string;
  module?: Module;
  children: React.ReactNode;
}

/**
 * Wraps a dashboard route with:
 * 1. Tenant-type module check (individual / freelancer / company)
 * 2. FeatureGate (entitlements + RBAC)
 *
 * If segment exists in ROUTE_FEATURE_MAP → FeatureGate wraps children.
 * If module is specified → tenant-type check applies.
 */
const GatedRoute = ({ segment, module, children }: GatedRouteProps) => {
  const { tenantType } = useAuth();

  // Tenant-type module guard
  if (module && !isModuleAllowed(tenantType, module)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Feature entitlement + RBAC gate
  const mapping = ROUTE_FEATURE_MAP[segment];
  if (mapping) {
    return (
      <FeatureGate
        featureKey={mapping.featureKey}
        featureLabel={mapping.label}
        featureDescription={mapping.description}
      >
        {children}
      </FeatureGate>
    );
  }

  return <>{children}</>;
};

export default GatedRoute;
