import { useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";
import DashboardHome from "@/components/dashboard/DashboardHome";
import InvoicesPage from "@/components/invoices/InvoicesPage";
import ContractsPage from "@/components/contracts/ContractsPage";
import StampManagement from "@/components/stamp/StampManagement";
import InventoryPage from "@/components/inventory/InventoryPage";
import QuotationsPage from "@/components/quotations/QuotationsPage";
import SalesOrdersPage from "@/components/sales-orders/SalesOrdersPage";
import ExpensesPage from "@/components/expenses/ExpensesPage";
import AuditLogViewer from "@/components/audit/AuditLogViewer";
import BrandingSettings from "@/components/branding/BrandingSettings";
import ComplianceSettings from "@/components/compliance/ComplianceSettings";
import CustomersPage from "@/components/customers/CustomersPage";
import CompanySettings from "@/components/company/CompanySettings";
import TeamMembersPage from "@/components/team/TeamMembersPage";
import ReportsPage from "@/components/reports/ReportsPage";
import AnalyticsPage from "@/components/analytics/AnalyticsPage";
import SettingsPage from "@/components/settings/SettingsPage";
import HelpPage from "@/components/help/HelpPage";
import SubscriptionPage from "@/components/subscription/SubscriptionPage";
import IntegrationsPage from "@/components/integrations/IntegrationsPage";
import FinancialOverview from "@/components/finance/FinancialOverview";
import SubscriptionGuard from "@/components/subscription/SubscriptionGuard";
import UpgradeBanner from "@/components/subscription/UpgradeBanner";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { isModuleAllowed, type Module } from "@/lib/tenant-modules";

// Map path segments to module keys
const PATH_MODULE_MAP: Record<string, Module> = {
  billing: "billing",
  invoices: "billing",
  contracts: "contracts",
  quotations: "quotations",
  "sales-orders": "sales-orders",
  expenses: "expenses",
  inventory: "inventory",
  stamp: "stamp",
  audit: "audit",
  branding: "branding",
  compliance: "compliance",
  customers: "customers",
  company: "company",
  team: "team",
  reports: "reports",
  analytics: "analytics",
  finance: "finance",
  integrations: "integrations",
  subscription: "subscription",
  settings: "settings",
  help: "help",
};

const Dashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const { tenantType } = useAuth();
  const { isRTL } = useLanguage();
  const renderContent = () => {
    const path = location.pathname;
    // Extract the sub-path after /dashboard/
    const segment = path.replace("/dashboard/", "").replace("/dashboard", "");
    const module = PATH_MODULE_MAP[segment];

    // If we have a module mapping and it's not allowed, redirect to dashboard home
    if (module && !isModuleAllowed(tenantType, module)) {
      return <Navigate to="/dashboard" replace />;
    }

    if (path === "/dashboard/billing" || path === "/dashboard/invoices") {
      return <InvoicesPage />;
    }
    if (path === "/dashboard/contracts") {
      return <ContractsPage />;
    }
    if (path === "/dashboard/inventory") {
      return <InventoryPage />;
    }
    if (path === "/dashboard/quotations") {
      return <QuotationsPage />;
    }
    if (path === "/dashboard/sales-orders") {
      return <SalesOrdersPage />;
    }
    if (path === "/dashboard/expenses") {
      return <ExpensesPage />;
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
    if (path === "/dashboard/team") {
      return <TeamMembersPage />;
    }
    if (path === "/dashboard/reports") {
      return <ReportsPage />;
    }
    if (path === "/dashboard/analytics") {
      return <AnalyticsPage />;
    }
    if (path === "/dashboard/settings") {
      return <SettingsPage />;
    }
    if (path === "/dashboard/finance") {
      return <FinancialOverview />;
    }
    if (path === "/dashboard/integrations") {
      return <IntegrationsPage />;
    }
    if (path === "/dashboard/subscription") {
      return <SubscriptionPage />;
    }
    if (path === "/dashboard/help") {
      return <HelpPage />;
    }
    return <DashboardHome />;
  };

  return (
    <BrandingProvider>
      <SubscriptionGuard>
        <div className="min-h-screen bg-background">
          <DashboardSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          <div
            className={cn(
              "transition-all duration-300",
              isRTL
                ? (sidebarCollapsed ? "mr-[68px]" : "mr-64")
                : (sidebarCollapsed ? "ml-[68px]" : "ml-64")
            )}
          >
            <DashboardTopbar />
            <UpgradeBanner />
            {renderContent()}
          </div>
        </div>
      </SubscriptionGuard>
    </BrandingProvider>
  );
};

export default Dashboard;
