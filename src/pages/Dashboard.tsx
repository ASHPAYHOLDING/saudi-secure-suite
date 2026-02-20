import { useState, useEffect, lazy, Suspense } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";
import DashboardHome from "@/components/dashboard/DashboardHome";
import SubscriptionGuard from "@/components/subscription/SubscriptionGuard";
import FeatureGate from "@/components/subscription/FeatureGate";
import UpgradeBanner from "@/components/subscription/UpgradeBanner";
import UsageLimitAlert from "@/components/subscription/UsageLimitAlert";
import CommandPalette from "@/components/productivity/CommandPalette";
import PageLoadingSkeleton from "@/components/ui/PageLoadingSkeleton";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { BranchProvider } from "@/contexts/BranchContext";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { isModuleAllowed, type Module } from "@/lib/tenant-modules";

// --- Lazy-loaded heavy pages ---
const InvoicesPage = lazy(() => import("@/components/invoices/InvoicesPage"));
const ContractsPage = lazy(() => import("@/components/contracts/ContractsPage"));
const StampManagement = lazy(() => import("@/components/stamp/StampManagement"));
const InventoryPage = lazy(() => import("@/components/inventory/InventoryPage"));
const QuotationsPage = lazy(() => import("@/components/quotations/QuotationsPage"));
const SalesOrdersPage = lazy(() => import("@/components/sales-orders/SalesOrdersPage"));
const PurchaseOrdersPage = lazy(() => import("@/components/purchase-orders/PurchaseOrdersPage"));
const DeliveryNotesPage = lazy(() => import("@/components/delivery-notes/DeliveryNotesPage"));
const ExpensesPage = lazy(() => import("@/components/expenses/ExpensesPage"));
const AuditLogViewer = lazy(() => import("@/components/audit/AuditLogViewer"));
const BrandingSettings = lazy(() => import("@/components/branding/BrandingSettings"));
const ComplianceSettings = lazy(() => import("@/components/compliance/ComplianceSettings"));
const CustomersPage = lazy(() => import("@/components/customers/CustomersPage"));
const CompanySettings = lazy(() => import("@/components/company/CompanySettings"));
const TeamMembersPage = lazy(() => import("@/components/team/TeamMembersPage"));
const ReportsPage = lazy(() => import("@/components/reports/ReportsPage"));
const VatReturnGenerator = lazy(() => import("@/components/reports/VatReturnGenerator"));
const AnalyticsPage = lazy(() => import("@/components/analytics/AnalyticsPage"));
const SettingsPage = lazy(() => import("@/components/settings/SettingsPage"));
const HelpPage = lazy(() => import("@/components/help/HelpPage"));
const SubscriptionPage = lazy(() => import("@/components/subscription/SubscriptionPage"));
const IntegrationsPage = lazy(() => import("@/components/integrations/IntegrationsPage"));
const PaidIntegrationsPage = lazy(() => import("@/components/integrations/PaidIntegrationsPage"));
const SheetViewPage = lazy(() => import("@/components/sheet-view/SheetViewPage"));
const FinancialOverview = lazy(() => import("@/components/finance/FinancialOverview"));
const BranchManagement = lazy(() => import("@/components/branches/BranchManagement"));
const PermissionsManagement = lazy(() => import("@/components/permissions/PermissionsManagement"));
const ChatPage = lazy(() => import("@/components/collaboration/ChatPage"));
const JournalEntriesPage = lazy(() => import("@/components/journal/JournalEntriesPage"));
const AccountantDashboard = lazy(() => import("@/components/productivity/AccountantDashboard"));
const SupplierInboxPage = lazy(() => import("@/components/supplier-inbox/SupplierInboxPage"));
const PaymentRemindersPage = lazy(() => import("@/components/reminders/PaymentRemindersPage"));
const ApprovalWorkflowsPage = lazy(() => import("@/components/approvals/ApprovalWorkflowsPage"));
const CreditNotesPage = lazy(() => import("@/components/credit-notes/CreditNotesPage"));
const NaturalLanguageQuery = lazy(() => import("@/components/ai/NaturalLanguageQuery"));
const SupportTicketsPage = lazy(() => import("@/components/support/SupportTicketsPage"));
const CreateTicketPage = lazy(() => import("@/components/support/CreateTicketPage"));
const NumaxioPay = lazy(() => import("@/pages/NumaxioPay"));
const WalletPage = lazy(() => import("@/components/wallet/WalletPage"));
const AffiliateDashboardPage = lazy(() => import("@/components/affiliate/AffiliateDashboardPage"));
const BudgetListPage = lazy(() => import("@/components/budgets/BudgetListPage"));
const BudgetDetailPage = lazy(() => import("@/components/budgets/BudgetDetailPage"));
const DataQualityCenterPage = lazy(() => import("@/components/reconciliation/DataQualityCenterPage"));
const GroupDashboardPage = lazy(() => import("@/components/group/GroupDashboardPage"));
const CustomReportBuilder = lazy(() => import("@/components/reports/CustomReportBuilder"));
const ForecastingPage = lazy(() => import("@/components/forecasting/ForecastingPage"));
const PeriodLockManagement = lazy(() => import("@/components/accounting/PeriodLockManagement"));
const AdvancedAccountingGate = lazy(() => import("@/components/accounting/AdvancedAccountingGate"));
const ApiKeysManagement = lazy(() => import("@/components/api/ApiKeysManagement"));
const PaymentProvidersPage = lazy(() => import("@/components/integrations/PaymentProvidersPage"));

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
  "report-builder": "reports",
  forecasting: "analytics",
  "vat-return": "reports",
  analytics: "analytics",
  finance: "finance",
  "journal-entries": "journal-entries",
  "period-lock": "journal-entries",
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
  "integrations/payments": "integrations",
  "smart-query": "analytics",
  wallet: "finance",
  affiliate: "finance",
  subscription: "subscription",
  settings: "settings",
  help: "help",
  support: "help",
  group: "company",
  "api-keys": "integrations",
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
    if (path === "/dashboard/contracts") return withGate("contracts", <ContractsPage />);
    if (path === "/dashboard/inventory") return withGate("inventory", <InventoryPage />);
    if (path === "/dashboard/quotations") return withGate("quotations", <QuotationsPage />);
    if (path === "/dashboard/sales-orders") return withGate("sales-orders", <SalesOrdersPage />);
    if (path === "/dashboard/purchase-orders") return withGate("purchase-orders", <PurchaseOrdersPage />);
    if (path === "/dashboard/expenses") return withGate("expenses", <ExpensesPage />);
    if (path === "/dashboard/delivery-notes") return withGate("delivery-notes", <DeliveryNotesPage />);
    if (path === "/dashboard/journal-entries") return withGate("journal-entries", <JournalEntriesPage />);
    if (path === "/dashboard/budgets") return <BudgetListPage />;
    if (path.startsWith("/dashboard/budgets/")) return <BudgetDetailPage />;
    if (path === "/dashboard/data-quality") return <DataQualityCenterPage />;
    if (path === "/dashboard/productivity") return <AccountantDashboard />;
    if (path === "/dashboard/supplier-inbox") return withGate("supplier-inbox", <SupplierInboxPage />);
    if (path === "/dashboard/payment-reminders") return withGate("payment-reminders", <PaymentRemindersPage />);
    if (path === "/dashboard/approvals") return <ApprovalWorkflowsPage />;
    if (path === "/dashboard/credit-notes") return withGate("credit-notes", <CreditNotesPage />);
    if (path === "/dashboard/stamp") return withGate("stamp", <StampManagement />);
    if (path === "/dashboard/audit") return withGate("audit", <AuditLogViewer />);
    if (path === "/dashboard/branding") return withGate("branding", <BrandingSettings />);
    if (path === "/dashboard/compliance") return withGate("compliance", <ComplianceSettings />);
    if (path === "/dashboard/customers") return withGate("customers", <CustomersPage />);
    if (path === "/dashboard/company") return <CompanySettings />;
    if (path === "/dashboard/team") return withGate("team", <TeamMembersPage />);
    if (path === "/dashboard/reports") return withGate("reports", <ReportsPage />);
    if (path === "/dashboard/vat-return") return withGate("vat-return", <VatReturnGenerator />);
    if (path === "/dashboard/analytics") return withGate("analytics", <AnalyticsPage />);
    if (path === "/dashboard/smart-query") return withGate("smart-query", <NaturalLanguageQuery />);
    if (path === "/dashboard/settings") return <SettingsPage />;
    if (path === "/dashboard/finance") return <FinancialOverview />;
    if (path === "/dashboard/integrations") return <IntegrationsPage />;
    if (path === "/dashboard/paid-integrations") return withGate("paid-integrations", <PaidIntegrationsPage />);
    if (path === "/dashboard/sheet-view") return <SheetViewPage />;
    if (path === "/dashboard/branches") return withGate("branches", <BranchManagement />);
    if (path === "/dashboard/permissions") return withGate("permissions", <PermissionsManagement />);
    if (path === "/dashboard/chat") return <ChatPage />;
    if (path === "/dashboard/subscription") return <SubscriptionPage />;
    if (path === "/dashboard/help") return <HelpPage />;
    if (path === "/dashboard/wallet") return withGate("wallet", <WalletPage />);
    if (path === "/dashboard/affiliate") return <AffiliateDashboardPage />;
    if (path === "/dashboard/numaxio-pay") return withGate("numaxio-pay", <NumaxioPay embedded />);
    if (path === "/dashboard/support/new") return <CreateTicketPage />;
    if (path === "/dashboard/support") return <SupportTicketsPage />;
    if (path === "/dashboard/group") return <GroupDashboardPage />;
    if (path === "/dashboard/report-builder") return withGate("reports", <CustomReportBuilder />);
    if (path === "/dashboard/forecasting") return withGate("analytics", <ForecastingPage />);
    if (path === "/dashboard/period-lock") return withGate("journal-entries", <PeriodLockManagement />);
    if (path === "/dashboard/api-keys") return <ApiKeysManagement />;
    if (path === "/dashboard/integrations/payments") return <PaymentProvidersPage />;
    return <DashboardHome />;
  };

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
                {renderContent()}
              </Suspense>
            </div>
          </div>
        </SubscriptionGuard>
      </BranchProvider>
    </BrandingProvider>
  );
};

export default Dashboard;
