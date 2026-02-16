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
import AdminAIAssistant from "@/components/admin/AdminAIAssistant";
import AdminInfrastructure from "@/components/admin/AdminInfrastructure";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const Admin = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

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
    if (path === "/admin/ai") return <AdminAIAssistant />;
    if (path === "/admin/infrastructure") return <AdminInfrastructure />;
    return <AdminDashboard />;
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "mr-[68px]" : "mr-64"
        )}
      >
        <div className="flex items-center justify-between border-b bg-card px-6 py-3">
          <h2 className="text-lg font-semibold text-foreground">لوحة إدارة المنصة</h2>
          <AdminNotifications />
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default Admin;
