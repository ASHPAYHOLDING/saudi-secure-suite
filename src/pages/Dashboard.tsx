import { useState } from "react";
import { useLocation } from "react-router-dom";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";
import DashboardHome from "@/components/dashboard/DashboardHome";
import InvoicesPage from "@/components/invoices/InvoicesPage";
import ContractsPage from "@/components/contracts/ContractsPage";
import StampManagement from "@/components/stamp/StampManagement";
import AuditLogViewer from "@/components/audit/AuditLogViewer";
import BrandingSettings from "@/components/branding/BrandingSettings";
import ComplianceSettings from "@/components/compliance/ComplianceSettings";
import CustomersPage from "@/components/customers/CustomersPage";
import CompanySettings from "@/components/company/CompanySettings";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  const renderContent = () => {
    const path = location.pathname;
    if (path === "/dashboard/billing" || path === "/dashboard/invoices") {
      return <InvoicesPage />;
    }
    if (path === "/dashboard/contracts") {
      return <ContractsPage />;
    }
    if (path === "/dashboard/stamp") {
      return <StampManagement />;
    }
    if (path === "/dashboard/audit") {
      return <AuditLogViewer />;
    }
    if (path === "/dashboard/branding") {
      return <BrandingSettings />;
    }
    if (path === "/dashboard/compliance") {
      return <ComplianceSettings />;
    }
    if (path === "/dashboard/customers") {
      return <CustomersPage />;
    }
    if (path === "/dashboard/company") {
      return <CompanySettings />;
    }
    return <DashboardHome />;
  };

  return (
    <BrandingProvider>
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
    </BrandingProvider>
  );
};

export default Dashboard;
