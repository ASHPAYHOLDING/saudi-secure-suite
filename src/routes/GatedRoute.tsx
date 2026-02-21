import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isModuleAllowed, type Module } from "@/lib/tenant-modules";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";
import RouteGuard from "@/components/guards/RouteGuard";
import AccessDenied from "@/components/guards/AccessDenied";

const INTENTIONALLY_OPEN_SEGMENTS = new Set([
  "help",
  "subscription",
  "support",
]);

type Props = {
  segment: string;
  module?: Module;
  permissionKey?: string;
  children: React.ReactNode;
};

export default function GatedRoute({ segment, module, permissionKey, children }: Props) {
  const { tenantType } = useAuth();

  // 1) Module guard — fail closed
  if (module && !isModuleAllowed(tenantType, module)) {
    return <AccessDenied reason="module_not_allowed" />;
  }

  const mapping = ROUTE_FEATURE_MAP[segment];
  const featureKey = mapping?.featureKey;
  const featureLabel = mapping?.label;

  // Auto-derive permissionKey from ROUTE_FEATURE_MAP if not explicitly passed
  const resolvedPermissionKey = permissionKey ?? mapping?.permissionKeys?.[0];
  const isIntentionallyOpen = INTENTIONALLY_OPEN_SEGMENTS.has(segment);

  // 2) DEV warning for missing mapping
  if (import.meta.env.DEV && !mapping && !isIntentionallyOpen) {
    console.warn(
      `[GatedRoute] ⚠️ Missing ROUTE_FEATURE_MAP entry for segment "${segment}". ` +
        `Add it to ROUTE_FEATURE_MAP or INTENTIONALLY_OPEN_SEGMENTS.`
    );
  }

  // 3) Fail-closed: unknown/ungated segments blocked unless intentionally open
  if (!featureKey && !resolvedPermissionKey) {
    if (isIntentionallyOpen) return <>{children}</>;
    return <AccessDenied reason="route_not_gated" featureLabel={featureLabel} />;
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
}
