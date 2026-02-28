import { Navigate, useLocation } from "react-router-dom";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

/**
 * Wraps the Dashboard layout.
 * If onboarding is incomplete (required steps not done), redirects to /dashboard/onboarding.
 * The onboarding route itself is excluded to avoid infinite redirects.
 */
export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, tenantId, loading: authLoading } = useAuth();
  const { needsOnboarding, isLoading } = useOnboardingState();
  const location = useLocation();

  // Don't guard these paths
  const isOnboardingPath = location.pathname.startsWith("/dashboard/onboarding");
  const isSettingsPath = location.pathname.startsWith("/dashboard/settings");
  const isSubscriptionPath = location.pathname.startsWith("/dashboard/subscription");
  const isHelpPath = location.pathname.startsWith("/dashboard/help") || location.pathname.startsWith("/dashboard/support");

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Skip guard for excluded paths or if no tenant
  if (!user || !tenantId || isOnboardingPath || isSettingsPath || isSubscriptionPath || isHelpPath) {
    return <>{children}</>;
  }

  if (needsOnboarding) {
    return <Navigate to="/dashboard/onboarding" replace />;
  }

  return <>{children}</>;
}
