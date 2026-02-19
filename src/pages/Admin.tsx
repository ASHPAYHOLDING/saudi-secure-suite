import { useState, useEffect, lazy, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminNotifications from "@/components/admin/AdminNotifications";
import PageLoadingSkeleton from "@/components/ui/PageLoadingSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// --- Lazy-loaded admin pages ---
const AdminDashboard = lazy(() => import("@/components/admin/AdminDashboard"));
const AdminCompanies = lazy(() => import("@/components/admin/AdminCompanies"));
const AdminSubscriptions = lazy(() => import("@/components/admin/AdminSubscriptions"));
const AdminUsers = lazy(() => import("@/components/admin/AdminUsers"));
const AdminFeatureToggles = lazy(() => import("@/components/admin/AdminFeatureToggles"));
const AdminSecurityCenter = lazy(() => import("@/components/admin/AdminSecurityCenter"));
const AdminFinance = lazy(() => import("@/components/admin/AdminFinance"));
const AdminTemplates = lazy(() => import("@/components/admin/AdminTemplates"));
const AdminEmailTemplates = lazy(() => import("@/components/admin/AdminEmailTemplates"));
const AdminEmailCenter = lazy(() => import("@/components/admin/AdminEmailCenter"));
const AdminAIAssistant = lazy(() => import("@/components/admin/AdminAIAssistant"));
const AdminInfrastructure = lazy(() => import("@/components/admin/AdminInfrastructure"));
const AdminPlatformHealth = lazy(() => import("@/components/admin/AdminPlatformHealth"));
const AdminMonitoring = lazy(() => import("@/components/admin/AdminMonitoring"));
const AdminPaylinkFees = lazy(() => import("@/components/admin/AdminPaylinkFees"));
const AdminPaylinkManagement = lazy(() => import("@/components/admin/AdminPaylinkManagement"));
const AdminSupportTickets = lazy(() => import("@/components/admin/AdminSupportTickets"));
const AdminPaidIntegrations = lazy(() => import("@/components/admin/AdminPaidIntegrations"));
const AdminWalletRequests = lazy(() => import("@/components/admin/AdminWalletRequests"));
const AdminDiscountCodes = lazy(() => import("@/components/admin/AdminDiscountCodes"));
const AdminAffiliateManagement = lazy(() => import("@/components/admin/AdminAffiliateManagement"));

const Admin = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigate("/auth");
        return;
      }
      const { data } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) {
        navigate("/dashboard");
        return;
      }
      setIsAdmin(true);
    };
    checkAdmin();
  }, [user, navigate]);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  const renderContent = () => {
    const path = location.pathname;
    if (path === "/admin/companies") return <AdminCompanies />;
    if (path === "/admin/subscriptions") return <AdminSubscriptions />;
    if (path === "/admin/users") return <AdminUsers />;
    if (path === "/admin/features") return <AdminFeatureToggles />;
    if (path === "/admin/security") return <AdminSecurityCenter />;
    if (path === "/admin/finance") return <AdminFinance />;
    if (path === "/admin/templates") return <AdminTemplates />;
    if (path === "/admin/email-templates") return <AdminEmailTemplates />;
    if (path === "/admin/email-center") return <AdminEmailCenter />;
    if (path === "/admin/ai") return <AdminAIAssistant />;
    if (path === "/admin/infrastructure") return <AdminInfrastructure />;
    if (path === "/admin/platform-health") return <AdminPlatformHealth />;
    if (path === "/admin/monitoring") return <AdminMonitoring />;
    if (path === "/admin/paylink-fees") return <AdminPaylinkFees />;
    if (path === "/admin/paylink-management") return <AdminPaylinkManagement />;
    if (path === "/admin/support") return <AdminSupportTickets />;
    if (path === "/admin/paid-integrations") return <AdminPaidIntegrations />;
    if (path === "/admin/wallet-requests") return <AdminWalletRequests />;
    if (path === "/admin/discount-codes") return <AdminDiscountCodes />;
    if (path === "/admin/affiliates") return <AdminAffiliateManagement />;
    return <AdminDashboard />;
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <div
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "md:mr-[68px]" : "md:mr-64"
        )}
      >
        <div className="flex items-center justify-between border-b bg-card px-3 md:px-6 py-3">
          <div className="flex items-center gap-2">
            <button
              className="md:hidden p-2 rounded-lg hover:bg-secondary/50"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <h2 className="text-base md:text-lg font-semibold text-foreground">لوحة إدارة المنصة</h2>
          </div>
          <AdminNotifications />
        </div>
        <Suspense fallback={<PageLoadingSkeleton />}>
          {renderContent()}
        </Suspense>
      </div>
    </div>
  );
};

export default Admin;
