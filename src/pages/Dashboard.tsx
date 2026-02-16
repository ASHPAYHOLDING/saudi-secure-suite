import { useState } from "react";
import { useLocation } from "react-router-dom";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";
import DashboardHome from "@/components/dashboard/DashboardHome";
import InvoicesPage from "@/components/invoices/InvoicesPage";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  const renderContent = () => {
    const path = location.pathname;
    if (path === "/dashboard/billing" || path === "/dashboard/invoices") {
      return <InvoicesPage />;
    }
    return <DashboardHome />;
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "mr-[68px]" : "mr-64"
        )}
      >
        <DashboardTopbar />
        {renderContent()}
      </div>
    </div>
  );
};

export default Dashboard;
