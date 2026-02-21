import { useAccess } from "@/lib/access/useAccess";
import PageLoadingSkeleton from "@/components/ui/PageLoadingSkeleton";
import AccessDenied from "@/components/guards/AccessDenied";

interface RouteGuardProps {
  /** RBAC permission key (e.g. "invoices.view") */
  permissionKey?: string;
  /** Entitlement/feature key (e.g. "invoices_basic") */
  featureKey?: string;
  /** Label shown in AccessDenied when feature is gated */
  featureLabel?: string;
  /** Override the denied reason shown in AccessDenied */
  deniedReason?: import("@/components/guards/AccessDenied").AccessDeniedReason;
  /** Custom fallback instead of default AccessDenied */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Route-level guard that blocks direct URL access.
 * Shows a loading skeleton while checking, then either the content or AccessDenied.
 * No flash: loading state shows skeleton, not children.
 */
const RouteGuard = ({
  permissionKey,
  featureKey,
  featureLabel,
  deniedReason,
  fallback,
  children,
}: RouteGuardProps) => {
  // Use "*" as wildcard when no permissionKey — skips RBAC check
  const { allowed, reason, loading } = useAccess(
    permissionKey || "*",
    featureKey,
  );

  // If neither key provided, skip guard entirely
  if (!permissionKey && !featureKey) {
    return <>{children}</>;
  }

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  if (!allowed && reason) {
    if (fallback) return <>{fallback}</>;
    return <AccessDenied reason={deniedReason || reason} featureLabel={featureLabel} featureKey={featureKey} />;
  }

  return <>{children}</>;
};

export default RouteGuard;
