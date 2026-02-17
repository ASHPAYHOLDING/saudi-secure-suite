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
import PurchaseOrdersPage from "@/components/purchase-orders/PurchaseOrdersPage";
import DeliveryNotesPage from "@/components/delivery-notes/DeliveryNotesPage";
import ExpensesPage from "@/components/expenses/ExpensesPage";
import AuditLogViewer from "@/components/audit/AuditLogViewer";
import BrandingSettings from "@/components/branding/BrandingSettings";
import ComplianceSettings from "@/components/compliance/ComplianceSettings";
import CustomersPage from "@/components/customers/CustomersPage";
import CompanySettings from "@/components/company/CompanySettings";
import TeamMembersPage from "@/components/team/TeamMembersPage";
import ReportsPage from "@/components/reports/ReportsPage";
import VatReturnGenerator from "@/components/reports/VatReturnGenerator";
import AnalyticsPage from "@/components/analytics/AnalyticsPage";
import SettingsPage from "@/components/settings/SettingsPage";
import HelpPage from "@/components/help/HelpPage";
import SubscriptionPage from "@/components/subscription/SubscriptionPage";
import IntegrationsPage from "@/components/integrations/IntegrationsPage";
import SheetViewPage from "@/components/sheet-view/SheetViewPage";
import FinancialOverview from "@/components/finance/FinancialOverview";
import BranchManagement from "@/components/branches/BranchManagement";
import PermissionsManagement from "@/components/permissions/PermissionsManagement";
import ChatPage from "@/components/collaboration/ChatPage";
import JournalEntriesPage from "@/components/journal/JournalEntriesPage";
import AccountantDashboard from "@/components/productivity/AccountantDashboard";
import SupplierInboxPage from "@/components/supplier-inbox/SupplierInboxPage";
import PaymentRemindersPage from "@/components/reminders/PaymentRemindersPage";
import ApprovalWorkflowsPage from "@/components/approvals/ApprovalWorkflowsPage";
import CreditNotesPage from "@/components/credit-notes/CreditNotesPage";
import NaturalLanguageQuery from "@/components/ai/NaturalLanguageQuery";
import SupportTicketsPage from "@/components/support/SupportTicketsPage";
import CommandPalette from "@/components/productivity/CommandPalette";
import NumaxioPay from "@/pages/NumaxioPay";
import SubscriptionGuard from "@/components/subscription/SubscriptionGuard";
import UpgradeBanner from "@/components/subscription/UpgradeBanner";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { BranchProvider } from "@/contexts/BranchContext";
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
  "purchase-orders": "purchase-orders",
  "delivery-notes": "delivery-notes",
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
  "vat-return": "reports",
  analytics: "analytics",
  finance: "finance",
  "journal-entries": "journal-entries",
  "supplier-inbox": "supplier-inbox",
  "payment-reminders": "payment-reminders",
  approvals: "billing",
  "credit-notes": "billing",
  "productivity": "dashboard",
  "sheet-view": "sheet-view",
  branches: "branches",
  chat: "chat",
  integrations: "integrations",
  "smart-query": "analytics",
  subscription: "subscription",
  settings: "settings",
  help: "help",
  support: "help",
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
    if (path === "/dashboard/purchase-orders") {
      return <PurchaseOrdersPage />;
    }
    if (path === "/dashboard/expenses") {
      return <ExpensesPage />;
    }
    if (path === "/dashboard/delivery-notes") {
      return <DeliveryNotesPage />;
    }
    if (path === "/dashboard/journal-entries") {
      return <JournalEntriesPage />;
    }
    if (path === "/dashboard/productivity") {
      return <AccountantDashboard />;
    }
    if (path === "/dashboard/supplier-inbox") {
      return <SupplierInboxPage />;
    }
    if (path === "/dashboard/payment-reminders") {
      return <PaymentRemindersPage />;
    }
    if (path === "/dashboard/approvals") {
      return <ApprovalWorkflowsPage />;
    }
    if (path === "/dashboard/credit-notes") {
      return <CreditNotesPage />;
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
    if (path === "/dashboard/vat-return") {
      return <VatReturnGenerator />;
    }
    if (path === "/dashboard/analytics") {
      return <AnalyticsPage />;
    }
    if (path === "/dashboard/smart-query") {
      return <NaturalLanguageQuery />;
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
    if (path === "/dashboard/sheet-view") {
      return <SheetViewPage />;
    }
    if (path === "/dashboard/branches") {
      return <BranchManagement />;
    }
    if (path === "/dashboard/permissions") {
      return <PermissionsManagement />;
    }
    if (path === "/dashboard/chat") {
      return <ChatPage />;
    }
    if (path === "/dashboard/subscription") {
      return <SubscriptionPage />;
    }
    if (path === "/dashboard/help") {
      return <HelpPage />;
    }
    if (path === "/dashboard/numaxio-pay") {
      return <NumaxioPay embedded />;
    }
    if (path === "/dashboard/support") {
      return <SupportTicketsPage />;
    }
    return <DashboardHome />;
  };

  return (
    <BrandingProvider>
      <BranchProvider>
        <SubscriptionGuard>
          <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
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
              <CommandPalette />
              <UpgradeBanner />
              {renderContent()}
            </div>
          </div>
        </SubscriptionGuard>
      </BranchProvider>
    </BrandingProvider>
  );
};

export default Dashboard;
