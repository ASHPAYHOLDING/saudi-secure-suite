import { useState, useEffect, Suspense, memo } from "react";
import { useLocation, Outlet } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";
import SubscriptionGuard from "@/components/subscription/SubscriptionGuard";
import UpgradeBanner from "@/components/subscription/UpgradeBanner";
import UsageLimitAlert from "@/components/subscription/UsageLimitAlert";
import CommandPalette from "@/components/productivity/CommandPalette";
import PageLoadingSkeleton from "@/components/ui/PageLoadingSkeleton";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { BranchProvider } from "@/contexts/BranchContext";
import { cn } from "@/lib/utils";

/**
 * Dashboard layout shell.
 * Renders sidebar, topbar, and shared chrome ONCE.
 * Child routes are rendered via <Outlet /> — only the page content
 * re-renders on navigation, not the entire dashboard.
 */
const DashboardLayout = memo(() => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const { isRTL } = useLanguage();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  return (
    <BrandingProvider>
      <BranchProvider>
        <SubscriptionGuard>
          <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
            {mobileSidebarOpen && (
              <div
                className="fixed inset-0 z-30 bg-black/50 md:hidden"
                onClick={() => setMobileSidebarOpen(false)}
              />
            )}
            <DashboardSidebar
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
              mobileOpen={mobileSidebarOpen}
              onMobileClose={() => setMobileSidebarOpen(false)}
            />
            <div
              className={cn(
                "transition-all duration-300",
                "md:transition-all",
                sidebarCollapsed ? "md:ms-[68px]" : "md:ms-64"
              )}
            >
              <DashboardTopbar onMobileMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
              <CommandPalette />
              <UpgradeBanner />
              <div className="px-6 space-y-3">
                <UsageLimitAlert />
              </div>
              <Suspense fallback={<PageLoadingSkeleton />}>
                <Outlet />
              </Suspense>
            </div>
          </div>
        </SubscriptionGuard>
      </BranchProvider>
    </BrandingProvider>
  );
});

DashboardLayout.displayName = "DashboardLayout";

export default DashboardLayout;
