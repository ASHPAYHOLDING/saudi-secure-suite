import { useState, useEffect } from "react";
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
import PaidIntegrationsPage from "@/components/integrations/PaidIntegrationsPage";
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
import CreateTicketPage from "@/components/support/CreateTicketPage";
import CommandPalette from "@/components/productivity/CommandPalette";
import NumaxioPay from "@/pages/NumaxioPay";
import WalletPage from "@/components/wallet/WalletPage";
import AffiliateDashboardPage from "@/components/affiliate/AffiliateDashboardPage";
import SubscriptionGuard from "@/components/subscription/SubscriptionGuard";
import AdvancedAccountingGate from "@/components/accounting/AdvancedAccountingGate";
import BudgetListPage from "@/components/budgets/BudgetListPage";
import BudgetDetailPage from "@/components/budgets/BudgetDetailPage";
import DataQualityCenterPage from "@/components/reconciliation/DataQualityCenterPage";
import FeatureGate from "@/components/subscription/FeatureGate";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";
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
  budgets: "budgets",
  "data-quality": "finance",
  "supplier-inbox": "supplier-inbox",
  "payment-reminders": "payment-reminders",
  approvals: "billing",
  "credit-notes": "billing",
  "productivity": "dashboard",
  "sheet-view": "sheet-view",
  branches: "branches",
  chat: "chat",
  integrations: "integrations",
  "paid-integrations": "integrations",
  "smart-query": "analytics",
  wallet: "finance",
  affiliate: "finance",
  subscription: "subscription",
  settings: "settings",
  help: "help",
  support: "help",
};

const Dashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const { tenantType } = useAuth();
  const { isRTL } = useLanguage();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  /** Wrap content with FeatureGate if a feature mapping exists for the route segment */
  const withGate = (segment: string, content: React.ReactNode) => {
    const mapping = ROUTE_FEATURE_MAP[segment];
    if (!mapping) return content;
    return (
      <FeatureGate
        featureKey={mapping.featureKey}
        featureLabel={mapping.label}
        featureDescription={mapping.description}
      >
        {content}
      </FeatureGate>
    );
  };

  const renderContent = () => {
    const path = location.pathname;
    const segment = path.replace("/dashboard/", "").replace("/dashboard", "");
    const module = PATH_MODULE_MAP[segment];

    // Tenant-type module check (individual vs freelancer vs company)
    if (module && !isModuleAllowed(tenantType, module)) {
      return <Navigate to="/dashboard" replace />;
    }

    if (path === "/dashboard/billing" || path === "/dashboard/invoices") {
      return withGate("billing", <InvoicesPage />);
    }
    if (path === "/dashboard/contracts") {
      return withGate("contracts", <ContractsPage />);
    }
    if (path === "/dashboard/inventory") {
      return withGate("inventory", <InventoryPage />);
    }
    if (path === "/dashboard/quotations") {
      return withGate("quotations", <QuotationsPage />);
    }
    if (path === "/dashboard/sales-orders") {
      return withGate("sales-orders", <SalesOrdersPage />);
    }
    if (path === "/dashboard/purchase-orders") {
      return withGate("purchase-orders", <PurchaseOrdersPage />);
    }
    if (path === "/dashboard/expenses") {
      return withGate("expenses", <ExpensesPage />);
    }
    if (path === "/dashboard/delivery-notes") {
      return withGate("delivery-notes", <DeliveryNotesPage />);
    }
    if (path === "/dashboard/journal-entries") {
      return withGate("journal-entries", <JournalEntriesPage />);
    }
    if (path === "/dashboard/budgets") {
      return <BudgetListPage />;
    }
    if (path.startsWith("/dashboard/budgets/")) {
      return <BudgetDetailPage />;
    }
    if (path === "/dashboard/data-quality") {
      return <DataQualityCenterPage />;
    }
    if (path === "/dashboard/productivity") {
      return <AccountantDashboard />;
    }
    if (path === "/dashboard/supplier-inbox") {
      return withGate("supplier-inbox", <SupplierInboxPage />);
    }
    if (path === "/dashboard/payment-reminders") {
      return withGate("payment-reminders", <PaymentRemindersPage />);
    }
    if (path === "/dashboard/approvals") {
      return <ApprovalWorkflowsPage />;
    }
    if (path === "/dashboard/credit-notes") {
      return withGate("credit-notes", <CreditNotesPage />);
    }
    if (path === "/dashboard/stamp") {
      return withGate("stamp", <StampManagement />);
    }
    if (path === "/dashboard/audit") {
      return withGate("audit", <AuditLogViewer />);
    }
    if (path === "/dashboard/branding") {
      return withGate("branding", <BrandingSettings />);
    }
    if (path === "/dashboard/compliance") {
      return withGate("compliance", <ComplianceSettings />);
    }
    if (path === "/dashboard/customers") {
      return withGate("customers", <CustomersPage />);
    }
    if (path === "/dashboard/company") {
      return <CompanySettings />;
    }
    if (path === "/dashboard/team") {
      return withGate("team", <TeamMembersPage />);
    }
    if (path === "/dashboard/reports") {
      return withGate("reports", <ReportsPage />);
    }
    if (path === "/dashboard/vat-return") {
      return withGate("vat-return", <VatReturnGenerator />);
    }
    if (path === "/dashboard/analytics") {
      return withGate("analytics", <AnalyticsPage />);
    }
    if (path === "/dashboard/smart-query") {
      return withGate("smart-query", <NaturalLanguageQuery />);
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
    if (path === "/dashboard/paid-integrations") {
      return withGate("paid-integrations", <PaidIntegrationsPage />);
    }
    if (path === "/dashboard/sheet-view") {
      return <SheetViewPage />;
    }
    if (path === "/dashboard/branches") {
      return withGate("branches", <BranchManagement />);
    }
    if (path === "/dashboard/permissions") {
      return withGate("permissions", <PermissionsManagement />);
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
    if (path === "/dashboard/wallet") {
      return withGate("wallet", <WalletPage />);
    }
    if (path === "/dashboard/affiliate") {
      return <AffiliateDashboardPage />;
    }
    if (path === "/dashboard/numaxio-pay") {
      return withGate("numaxio-pay", <NumaxioPay embedded />);
    }
    if (path === "/dashboard/support/new") {
      return <CreateTicketPage />;
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
            {/* Mobile sidebar backdrop */}
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
              {renderContent()}
            </div>
          </div>
        </SubscriptionGuard>
      </BranchProvider>
    </BrandingProvider>
  );
};

export default Dashboard;
