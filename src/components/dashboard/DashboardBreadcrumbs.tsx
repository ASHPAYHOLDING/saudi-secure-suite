import { useLocation, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/** Route segment → Arabic & English labels */
const segmentLabels: Record<string, { ar: string; en: string }> = {
  dashboard: { ar: "الرئيسية", en: "Dashboard" },
  billing: { ar: "الفواتير", en: "Invoices" },
  customers: { ar: "العملاء", en: "Customers" },
  expenses: { ar: "المصروفات", en: "Expenses" },
  "journal-entries": { ar: "القيود اليومية", en: "Journal Entries" },
  reports: { ar: "التقارير", en: "Reports" },
  analytics: { ar: "التحليلات", en: "Analytics" },
  settings: { ar: "الإعدادات", en: "Settings" },
  team: { ar: "الفريق", en: "Team" },
  company: { ar: "إعدادات الشركة", en: "Company" },
  finance: { ar: "المالية", en: "Finance" },
  branches: { ar: "الفروع", en: "Branches" },
  branding: { ar: "الهوية البصرية", en: "Branding" },
  compliance: { ar: "الامتثال", en: "Compliance" },
  stamp: { ar: "الأختام", en: "Stamps" },
  audit: { ar: "سجل المراجعة", en: "Audit Log" },
  integrations: { ar: "التكاملات", en: "Integrations" },
  subscription: { ar: "الاشتراك", en: "Subscription" },
  permissions: { ar: "الصلاحيات", en: "Permissions" },
  approvals: { ar: "الموافقات", en: "Approvals" },
  "my-approvals": { ar: "موافقاتي", en: "My Approvals" },
  chat: { ar: "المحادثات", en: "Chat" },
  quotations: { ar: "عروض الأسعار", en: "Quotations" },
  "sales-orders": { ar: "أوامر البيع", en: "Sales Orders" },
  contracts: { ar: "العقود", en: "Contracts" },
  "purchase-orders": { ar: "أوامر الشراء", en: "Purchase Orders" },
  "delivery-notes": { ar: "مذكرات التسليم", en: "Delivery Notes" },
  "supplier-inbox": { ar: "بريد الموردين", en: "Supplier Inbox" },
  inventory: { ar: "المخزون", en: "Inventory" },
  budgets: { ar: "الميزانيات", en: "Budgets" },
  "payment-reminders": { ar: "تذكيرات الدفع", en: "Payment Reminders" },
  "credit-notes": { ar: "إشعارات دائنة", en: "Credit Notes" },
  forecasting: { ar: "التوقعات", en: "Forecasting" },
  "vat-return": { ar: "إقرار الضريبة", en: "VAT Return" },
  executive: { ar: "المجلس التنفيذي", en: "Executive Board" },
  "cost-profit-centers": { ar: "مراكز التكلفة", en: "Cost Centers" },
  "period-lock": { ar: "قفل الفترة", en: "Period Lock" },
  coa: { ar: "شجرة الحسابات", en: "Chart of Accounts" },
  journal: { ar: "اليومية العامة", en: "General Journal" },
  "period-close": { ar: "إقفال الفترة", en: "Period Close" },
  statements: { ar: "القوائم المالية", en: "Financial Statements" },
  "corporate-structure": { ar: "هيكل الشركة", en: "Corporate Structure" },
  support: { ar: "الدعم", en: "Support" },
  help: { ar: "المساعدة", en: "Help" },
};

const DashboardBreadcrumbs = () => {
  const location = useLocation();
  const { currentLang, isRTL } = useLanguage();

  const segments = location.pathname
    .split("/")
    .filter(Boolean);

  // Don't show breadcrumbs on dashboard home
  if (segments.length <= 1) return null;

  const SeparatorIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <Breadcrumb className="px-6 pt-4 pb-1">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/dashboard" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <Home size={14} />
              <span className="hidden sm:inline">
                {currentLang === "ar" ? "الرئيسية" : "Home"}
              </span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {segments.slice(1).map((segment, index) => {
          const path = "/" + segments.slice(0, index + 2).join("/");
          const isLast = index === segments.length - 2;
          const label = segmentLabels[segment]?.[currentLang === "ar" ? "ar" : "en"] || segment;

          return (
            <span key={path} className="contents">
              <BreadcrumbSeparator>
                <SeparatorIcon size={14} />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="font-medium">{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={path} className="text-muted-foreground hover:text-foreground">
                      {label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default DashboardBreadcrumbs;
