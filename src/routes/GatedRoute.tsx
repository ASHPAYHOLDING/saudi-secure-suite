import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isModuleAllowed, type Module } from "@/lib/tenant-modules";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";
import RouteGuard from "@/components/guards/RouteGuard";
import AccessDenied from "@/components/guards/AccessDenied";

type Props = {
  segment: string;
  module?: Module;
  permissionKey?: string;
  /** Override denied reason in AccessDenied */
  deniedReason?: import("@/components/guards/AccessDenied").AccessDeniedReason;
  /** Declared open in route config — bypasses entitlement/RBAC guards */
  isOpenRoute?: boolean;
  children: React.ReactNode;
};

export default function GatedRoute({ segment, module, permissionKey, deniedReason, isOpenRoute, children }: Props) {
  const { tenantType } = useAuth();

  // 0) Intentionally open routes — declared in route config, not a string set
  if (isOpenRoute) {
    return <>{children}</>;
  }

  // 1) Module guard — fail closed
  if (module && !isModuleAllowed(tenantType, module)) {
    return <AccessDenied reason="module_not_allowed" />;
  }

  const mapping = ROUTE_FEATURE_MAP[segment];
  const featureKey = mapping?.featureKey;
  const featureLabel = mapping?.label;

  // Auto-derive permissionKey from ROUTE_FEATURE_MAP if not explicitly passed
  const resolvedPermissionKey = permissionKey ?? mapping?.permissionKeys?.[0];

  // 2) DEV warning for missing mapping
  if (import.meta.env.DEV && !mapping) {
    console.warn(
      `[GatedRoute] ⚠️ Missing ROUTE_FEATURE_MAP entry for segment "${segment}". ` +
        `Add it to ROUTE_FEATURE_MAP or mark the route as isOpenRoute.`
    );
  }

  // 3) Fail-closed: unknown/ungated segments blocked
  if (!featureKey && !resolvedPermissionKey) {
    return <AccessDenied reason="route_not_gated" featureLabel={featureLabel} />;
  }

  // 4) Normal: guard by feature + permission. MFA stays optional from account settings.
  return (
    <RouteGuard
      featureKey={featureKey}
      permissionKey={resolvedPermissionKey}
      featureLabel={featureLabel}
      deniedReason={deniedReason}
    >
      {children}
    </RouteGuard>
  );
}
