import { lazy } from "react";
import type { Module } from "@/lib/tenant-modules";

// --- Lazy-loaded pages ---
const DashboardHome = lazy(() => import("@/components/dashboard/DashboardHome"));
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
const MyApprovalsPage = lazy(() => import("@/components/approvals/MyApprovalsPage"));
const WorkflowDesignerPage = lazy(() => import("@/components/workflows/WorkflowDesignerPage"));
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
const ScheduledReportsPage = lazy(() => import("@/components/reports/ScheduledReportsPage"));
const ForecastingPage = lazy(() => import("@/components/forecasting/ForecastingPage"));
const PeriodLockManagement = lazy(() => import("@/components/accounting/PeriodLockManagement"));
const PeriodClosePage = lazy(() => import("@/components/accounting/PeriodClosePage"));
const CostProfitCenterManagement = lazy(() => import("@/components/centers/CostProfitCenterManagement"));
const ApiKeysManagement = lazy(() => import("@/components/api/ApiKeysManagement"));
const SsoSettingsPage = lazy(() => import("@/components/sso/SsoSettingsPage").then(m => ({ default: m.SsoSettingsPage })));
const PaymentProvidersPage = lazy(() => import("@/components/integrations/PaymentProvidersPage"));
const PaymentMarketplace = lazy(() => import("@/components/integrations/PaymentMarketplace"));
const LegacyIntegrationRedirect = lazy(() => import("@/components/integrations/LegacyIntegrationRedirect"));
const GatewaySetupPage = lazy(() => import("@/components/integrations/GatewaySetupPage"));
const IntegrationsMarketplace = lazy(() => import("@/components/integrations/IntegrationsMarketplace"));
const IntegrationFlowPage = lazy(() => import("@/components/integrations/IntegrationFlowPage"));
const ProviderDetailPage = lazy(() => import("@/components/integrations/ProviderDetailPage"));
const TikTokDetailPage = lazy(() => import("@/components/integrations/TikTokDetailPage"));
const MetaDetailPage = lazy(() => import("@/components/integrations/MetaDetailPage"));
const MetaPixelCapiPage = lazy(() => import("@/components/integrations/MarketingPages").then(m => ({ default: m.MetaPixelCapiPage })));
const FacebookCapiPage = lazy(() => import("@/components/integrations/MarketingPages").then(m => ({ default: m.FacebookCapiPage })));
const XPixelPage = lazy(() => import("@/components/integrations/MarketingPages").then(m => ({ default: m.XPixelPage })));
const XCatalogPage = lazy(() => import("@/components/integrations/MarketingPages").then(m => ({ default: m.XCatalogPage })));
const GTMPage = lazy(() => import("@/components/integrations/MarketingPages").then(m => ({ default: m.GTMPage })));
const GoogleAdsPage = lazy(() => import("@/components/integrations/MarketingPages").then(m => ({ default: m.GoogleAdsPage })));
const MetaCatalogPage = lazy(() => import("@/components/integrations/MarketingPages").then(m => ({ default: m.MetaCatalogPage })));
const DebugMarketing = lazy(() => import("@/pages/DebugMarketing"));
const AdminSecurityCenter = lazy(() => import("@/components/admin/AdminSecurityCenter"));
const EnterpriseDashboard = lazy(() => import("@/components/enterprise/EnterpriseDashboard"));
const EnterpriseSecurityPolicies = lazy(() => import("@/components/enterprise/EnterpriseSecurityPolicies"));
const EnterpriseSessionManagement = lazy(() => import("@/components/enterprise/EnterpriseSessionManagement"));
const EnterpriseIPRestrictions = lazy(() => import("@/components/enterprise/EnterpriseIPRestrictions"));
const EnterpriseRoleTemplates = lazy(() => import("@/components/enterprise/EnterpriseRoleTemplates"));
const EnterpriseAuditExport = lazy(() => import("@/components/enterprise/EnterpriseAuditExport"));
const CorporateStructurePage = lazy(() => import("@/components/finance/CorporateStructurePage"));
const ChartOfAccountsPage = lazy(() => import("@/components/finance/ChartOfAccountsPage"));
const JournalPage = lazy(() => import("@/components/journal/JournalPage"));
const FinancialStatementsPage = lazy(() => import("@/components/finance/FinancialStatementsPage"));
const JournalApprovalsPage = lazy(() => import("@/components/journal/JournalApprovalsPage"));
const FinanceRepairPage = lazy(() => import("@/components/enterprise/FinanceRepairPage"));
const IntegrationHealthDashboard = lazy(() => import("@/components/integrations/IntegrationHealthDashboard"));
const ExecutiveAnalyticsDashboard = lazy(() => import("@/components/analytics/ExecutiveAnalyticsDashboard"));
const GovernancePage = lazy(() => import("@/components/governance/GovernancePage"));
const StorageReportPage = lazy(() => import("@/components/system/StorageReportPage"));
const AuditIntelligencePage = lazy(() => import("@/components/audit/AuditIntelligencePage"));

export interface DashboardRouteConfig {
  /** URL path segment(s) relative to /dashboard/. Supports "*" for catch-all. */
  path: string;
  /** Lazy component to render */
  element: React.LazyExoticComponent<React.ComponentType<any>>;
  /** Route segment key for ROUTE_FEATURE_MAP (FeatureGate). undefined = no gate. */
  gateSegment?: string;
  /** Module key for tenant-type guard. undefined = no module check. */
  module?: Module;
  /** RBAC permission key for RouteGuard. undefined = no RBAC check. */
  permissionKey?: string;
  /** If true, component receives `embedded` prop */
  embedded?: boolean;
  /** Force remount on path change via key={location.pathname} */
  keyOnPath?: boolean;
}

/**
 * All dashboard routes as a flat, declarative config array.
 * Order matters: more specific paths must come before wildcards.
 */
export const DASHBOARD_ROUTES: DashboardRouteConfig[] = [
  // ── Core ──
  { path: "billing", element: InvoicesPage, gateSegment: "billing", module: "billing" },
  { path: "invoices", element: InvoicesPage, gateSegment: "invoices", module: "billing" },
  { path: "contracts", element: ContractsPage, gateSegment: "contracts", module: "contracts" },
  { path: "quotations", element: QuotationsPage, gateSegment: "quotations", module: "quotations" },
  { path: "sales-orders", element: SalesOrdersPage, gateSegment: "sales-orders", module: "sales-orders" },
  { path: "purchase-orders", element: PurchaseOrdersPage, gateSegment: "purchase-orders", module: "purchase-orders" },
  { path: "delivery-notes", element: DeliveryNotesPage, gateSegment: "delivery-notes", module: "delivery-notes" },
  { path: "expenses", element: ExpensesPage, gateSegment: "expenses", module: "expenses" },
  { path: "credit-notes", element: CreditNotesPage, gateSegment: "credit-notes", module: "billing" },
  { path: "customers", element: CustomersPage, gateSegment: "customers", module: "customers" },

  // ── Inventory ──
  { path: "inventory", element: InventoryPage, gateSegment: "inventory", module: "inventory" },

  // ── Finance & Accounting ──
  { path: "journal-entries", element: JournalEntriesPage, gateSegment: "journal-entries", module: "journal-entries" },
  { path: "finance", element: FinancialOverview, gateSegment: "finance", module: "finance" },
  { path: "budgets/:id", element: BudgetDetailPage, gateSegment: "budgets", module: "budgets" },
  { path: "budgets", element: BudgetListPage, gateSegment: "budgets", module: "budgets" },
  { path: "data-quality", element: DataQualityCenterPage, gateSegment: "data-quality", module: "finance" },
  { path: "period-lock", element: PeriodLockManagement, gateSegment: "journal-entries", module: "journal-entries" },
  { path: "cost-profit-centers", element: CostProfitCenterManagement, module: "finance" },
  { path: "finance/corporate-structure", element: CorporateStructurePage, gateSegment: "corporate-structure", module: "enterprise", permissionKey: "company.view" },
  { path: "finance/coa", element: ChartOfAccountsPage, gateSegment: "coa", module: "enterprise", permissionKey: "company.view" },
  { path: "finance/journal", element: JournalPage, gateSegment: "enterprise-journal", module: "enterprise", permissionKey: "company.view" },
  { path: "finance/period-close", element: PeriodClosePage, gateSegment: "enterprise-journal", module: "enterprise", permissionKey: "company.view" },
  { path: "finance/statements", element: FinancialStatementsPage, gateSegment: "enterprise-statements", module: "enterprise", permissionKey: "company.view" },
  { path: "enterprise/approvals/journal", element: JournalApprovalsPage, gateSegment: "enterprise-journal-approvals", module: "enterprise", permissionKey: "company.view" },
  { path: "enterprise/finance-repair", element: FinanceRepairPage, gateSegment: "enterprise-finance-repair", module: "enterprise", permissionKey: "company.view" },
  { path: "wallet", element: WalletPage, gateSegment: "wallet", module: "finance" },

  // ── Reports & Analytics ──
  { path: "reports", element: ReportsPage, gateSegment: "reports", module: "reports" },
  { path: "vat-return", element: VatReturnGenerator, gateSegment: "vat-return", module: "reports" },
  { path: "report-builder", element: CustomReportBuilder, gateSegment: "reports", module: "reports" },
  { path: "scheduled-reports", element: ScheduledReportsPage, gateSegment: "reports", module: "reports" },
  { path: "analytics/executive", element: ExecutiveAnalyticsDashboard, gateSegment: "analytics", module: "analytics" },
  { path: "analytics", element: AnalyticsPage, gateSegment: "analytics", module: "analytics" },
  { path: "forecasting", element: ForecastingPage, gateSegment: "analytics", module: "analytics" },
  { path: "smart-query", element: NaturalLanguageQuery, gateSegment: "smart-query", module: "analytics" },

  // ── Integrations (specific sub-paths first, then unified :key) ──
  { path: "integrations/health", element: IntegrationHealthDashboard, module: "integrations", permissionKey: "integrations.view" },
  { path: "integrations/marketplace", element: IntegrationsMarketplace, module: "integrations", permissionKey: "integrations.view" },
  { path: "integrations/payments", element: PaymentProvidersPage, module: "integrations" },
  { path: "integrations/gateway/*", element: GatewaySetupPage, module: "integrations" },
  { path: "integrations/setup/*", element: IntegrationFlowPage, module: "integrations" },
  { path: "integrations/marketing/tiktok", element: TikTokDetailPage, keyOnPath: true, module: "integrations" },
  { path: "integrations/marketing/meta", element: MetaDetailPage, keyOnPath: true, module: "integrations" },
  { path: "integrations/marketing/meta-pixel-capi", element: MetaPixelCapiPage, keyOnPath: true, module: "integrations" },
  { path: "integrations/marketing/facebook-capi", element: FacebookCapiPage, keyOnPath: true, module: "integrations" },
  { path: "integrations/marketing/x", element: XPixelPage, keyOnPath: true, module: "integrations" },
  { path: "integrations/marketing/x-catalog", element: XCatalogPage, keyOnPath: true, module: "integrations" },
  { path: "integrations/marketing/gtm", element: GTMPage, keyOnPath: true, module: "integrations" },
  { path: "integrations/marketing/google-ads", element: GoogleAdsPage, keyOnPath: true, module: "integrations" },
  { path: "integrations/marketing/meta-catalog", element: MetaCatalogPage, keyOnPath: true, module: "integrations" },
  // ✅ مسار موحّد: /dashboard/integrations/:key — يستبدل provider/* و :category/:provider
  { path: "integrations/:key", element: ProviderDetailPage, keyOnPath: true, module: "integrations" },
  // ✅ Redirects للمسارات القديمة: /integrations/payment/tap → /integrations/tap
  { path: "integrations/provider/*", element: LegacyIntegrationRedirect, module: "integrations" },
  { path: "integrations/:category/:provider", element: LegacyIntegrationRedirect, module: "integrations" },
  { path: "integrations", element: IntegrationsPage, gateSegment: "integrations", module: "integrations", permissionKey: "integrations.view" },

  // ── Payment ──
  { path: "payment-marketplace", element: PaymentMarketplace, module: "integrations", permissionKey: "integrations.view" },
  { path: "payment-reminders", element: PaymentRemindersPage, gateSegment: "payment-reminders", module: "payment-reminders" },
  { path: "numaxio-pay", element: NumaxioPay, gateSegment: "numaxio-pay", embedded: true },

  // ── Operations ──
  { path: "supplier-inbox", element: SupplierInboxPage, gateSegment: "supplier-inbox", module: "supplier-inbox" },
  { path: "approvals", element: ApprovalWorkflowsPage, gateSegment: "approvals", module: "billing" },
  { path: "my-approvals", element: MyApprovalsPage, module: "billing" },
  { path: "workflows/designer", element: WorkflowDesignerPage, module: "billing" },

  // ── Team & Organization ──
  { path: "team", element: TeamMembersPage, gateSegment: "team", module: "team" },
  { path: "branches", element: BranchManagement, gateSegment: "branches", module: "branches" },
  { path: "permissions", element: PermissionsManagement, gateSegment: "permissions" },
  { path: "chat", element: ChatPage, gateSegment: "chat", module: "chat", permissionKey: "chat.view" },
  { path: "group", element: GroupDashboardPage, gateSegment: "group", module: "company" },

  // ── Settings & Admin ──
  { path: "company", element: CompanySettings, module: "company", permissionKey: "company.view" },
  { path: "branding", element: BrandingSettings, gateSegment: "branding", module: "branding" },
  { path: "compliance", element: ComplianceSettings, gateSegment: "compliance", module: "compliance" },
  { path: "stamp", element: StampManagement, gateSegment: "stamp", module: "stamp" },
  { path: "audit/intelligence", element: AuditIntelligencePage, gateSegment: "audit", module: "audit", permissionKey: "company.view" },
  { path: "audit", element: AuditLogViewer, gateSegment: "audit", module: "audit" },
  { path: "api-keys", element: ApiKeysManagement, gateSegment: "api-keys", module: "integrations", permissionKey: "api_keys.view" },
  { path: "sso-settings", element: SsoSettingsPage, module: "company", permissionKey: "company.view" },
  { path: "security", element: AdminSecurityCenter, gateSegment: "audit", module: "audit" },
  { path: "enterprise", element: EnterpriseDashboard, gateSegment: "enterprise", module: "enterprise", permissionKey: "company.view" },
  { path: "enterprise/security-policies", element: EnterpriseSecurityPolicies, gateSegment: "enterprise", module: "enterprise", permissionKey: "company.view" },
  { path: "enterprise/sessions", element: EnterpriseSessionManagement, gateSegment: "enterprise", module: "enterprise", permissionKey: "company.view" },
  { path: "enterprise/ip-restrictions", element: EnterpriseIPRestrictions, gateSegment: "enterprise", module: "enterprise", permissionKey: "company.view" },
  { path: "enterprise/role-templates", element: EnterpriseRoleTemplates, gateSegment: "enterprise", module: "enterprise", permissionKey: "company.view" },
  { path: "enterprise/audit-export", element: EnterpriseAuditExport, gateSegment: "enterprise", module: "enterprise", permissionKey: "company.view" },
  { path: "governance", element: GovernancePage, gateSegment: "enterprise", module: "enterprise", permissionKey: "company.view" },
  { path: "system/storage", element: StorageReportPage, gateSegment: "enterprise", module: "enterprise", permissionKey: "company.view" },
  { path: "settings", element: SettingsPage, permissionKey: "settings.view" },

  // ── Productivity ──
  { path: "productivity", element: AccountantDashboard, module: "dashboard" },
  { path: "sheet-view", element: SheetViewPage, module: "sheet-view" },

  // ── Support ──
  { path: "support/new", element: CreateTicketPage, module: "help" },
  { path: "support", element: SupportTicketsPage, module: "help" },
  { path: "help", element: HelpPage },

  // ── Subscription & Misc ──
  { path: "subscription", element: SubscriptionPage },
  { path: "affiliate", element: AffiliateDashboardPage, module: "finance" },
];

/** Index (home) route — rendered when path is exactly /dashboard */
export const DashboardIndexElement = DashboardHome;
