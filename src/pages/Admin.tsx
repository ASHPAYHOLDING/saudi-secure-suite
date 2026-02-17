import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminNotifications from "@/components/admin/AdminNotifications";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminCompanies from "@/components/admin/AdminCompanies";
import AdminSubscriptions from "@/components/admin/AdminSubscriptions";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminFeatureToggles from "@/components/admin/AdminFeatureToggles";
import AdminSecurityCenter from "@/components/admin/AdminSecurityCenter";
import AdminFinance from "@/components/admin/AdminFinance";
import AdminTemplates from "@/components/admin/AdminTemplates";
import AdminEmailTemplates from "@/components/admin/AdminEmailTemplates";
import AdminEmailCenter from "@/components/admin/AdminEmailCenter";
import AdminAIAssistant from "@/components/admin/AdminAIAssistant";
import AdminInfrastructure from "@/components/admin/AdminInfrastructure";
import AdminPaylinkFees from "@/components/admin/AdminPaylinkFees";
import AdminPaylinkManagement from "@/components/admin/AdminPaylinkManagement";
import AdminSupportTickets from "@/components/admin/AdminSupportTickets";
import AdminPaidIntegrations from "@/components/admin/AdminPaidIntegrations";
import AdminWalletRequests from "@/components/admin/AdminWalletRequests";
import AdminDiscountCodes from "@/components/admin/AdminDiscountCodes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const Admin = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Close mobile sidebar on route change
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
    if (path === "/admin/paylink-fees") return <AdminPaylinkFees />;
    if (path === "/admin/paylink-management") return <AdminPaylinkManagement />;
    if (path === "/admin/support") return <AdminSupportTickets />;
    if (path === "/admin/paid-integrations") return <AdminPaidIntegrations />;
    if (path === "/admin/wallet-requests") return <AdminWalletRequests />;
    if (path === "/admin/discount-codes") return <AdminDiscountCodes />;
    return <AdminDashboard />;
  };


  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Mobile sidebar backdrop */}
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
        {renderContent()}
      </div>
    </div>
  );
};

export default Admin;
