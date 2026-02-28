import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard, Briefcase, Wallet, Bell, MoreHorizontal,
  Users, CreditCard, FileText, FileSignature, ShoppingCart,
  Package, Truck, Inbox, Receipt, BookOpen, Target, Building2,
  CalendarClock, Activity, Shield, BarChart3, TrendingUp,
  Settings, UsersRound, GitBranch, MessageCircle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TabItem {
  key: string;
  labelAr: string;
  labelEn: string;
  icon: any;
  path: string;
}

const primaryTabs: TabItem[] = [
  { key: "home", labelAr: "الرئيسية", labelEn: "Home", icon: LayoutDashboard, path: "/dashboard" },
  { key: "business", labelAr: "الأعمال", labelEn: "Business", icon: Briefcase, path: "/dashboard/billing" },
  { key: "finance", labelAr: "المالية", labelEn: "Finance", icon: Wallet, path: "/dashboard/finance" },
  { key: "notifications", labelAr: "الإشعارات", labelEn: "Alerts", icon: Bell, path: "/dashboard/payment-reminders" },
];

interface MoreLink {
  labelAr: string;
  labelEn: string;
  icon: any;
  path: string;
  section: "business" | "finance" | "reports" | "management" | "settings";
}

const moreLinks: MoreLink[] = [
  // الأعمال
  { labelAr: "العملاء", labelEn: "Customers", icon: Users, path: "/dashboard/customers", section: "business" },
  { labelAr: "الفواتير", labelEn: "Invoices", icon: CreditCard, path: "/dashboard/billing", section: "business" },
  { labelAr: "عروض الأسعار", labelEn: "Quotations", icon: FileText, path: "/dashboard/quotations", section: "business" },
  { labelAr: "أوامر البيع", labelEn: "Sales Orders", icon: ShoppingCart, path: "/dashboard/sales-orders", section: "business" },
  { labelAr: "العقود", labelEn: "Contracts", icon: FileSignature, path: "/dashboard/contracts", section: "business" },
  { labelAr: "أوامر الشراء", labelEn: "Purchase Orders", icon: Package, path: "/dashboard/purchase-orders", section: "business" },
  { labelAr: "سندات التسليم", labelEn: "Delivery Notes", icon: Truck, path: "/dashboard/delivery-notes", section: "business" },
  { labelAr: "المخزون", labelEn: "Inventory", icon: Package, path: "/dashboard/inventory", section: "business" },
  { labelAr: "صندوق الموردين", labelEn: "Supplier Inbox", icon: Inbox, path: "/dashboard/supplier-inbox", section: "business" },
  // المالية
  { labelAr: "المصروفات", labelEn: "Expenses", icon: Receipt, path: "/dashboard/expenses", section: "finance" },
  { labelAr: "القيود اليومية", labelEn: "Journal Entries", icon: BookOpen, path: "/dashboard/journal-entries", section: "finance" },
  { labelAr: "الميزانيات", labelEn: "Budgets", icon: Target, path: "/dashboard/budgets", section: "finance" },
  { labelAr: "مراكز التكلفة", labelEn: "Cost Centers", icon: Building2, path: "/dashboard/cost-profit-centers", section: "finance" },
  { labelAr: "إقفال الفترات", labelEn: "Period Close", icon: CalendarClock, path: "/dashboard/period-lock", section: "finance" },
  { labelAr: "رادار التدفق", labelEn: "Cashflow Radar", icon: Activity, path: "/dashboard/finance/cashflow-radar", section: "finance" },
  { labelAr: "ذكاء التحصيل", labelEn: "Collections", icon: Shield, path: "/dashboard/finance/collections-intelligence", section: "finance" },
  // التقارير
  { labelAr: "التقارير", labelEn: "Reports", icon: FileText, path: "/dashboard/reports", section: "reports" },
  { labelAr: "التحليلات", labelEn: "Analytics", icon: BarChart3, path: "/dashboard/analytics", section: "reports" },
  { labelAr: "التوقعات", labelEn: "Forecasting", icon: TrendingUp, path: "/dashboard/forecasting", section: "reports" },
  // الإدارة
  { labelAr: "الفريق", labelEn: "Team", icon: UsersRound, path: "/dashboard/team", section: "management" },
  { labelAr: "الموافقات", labelEn: "Approvals", icon: GitBranch, path: "/dashboard/approvals", section: "management" },
  { labelAr: "المحادثات", labelEn: "Chat", icon: MessageCircle, path: "/dashboard/chat", section: "management" },
  // الإعدادات
  { labelAr: "إعدادات المنشأة", labelEn: "Company", icon: Building2, path: "/dashboard/company", section: "settings" },
  { labelAr: "الإعدادات", labelEn: "Settings", icon: Settings, path: "/dashboard/settings", section: "settings" },
];

const sectionLabels: Record<string, { ar: string; en: string }> = {
  business: { ar: "الأعمال", en: "Business" },
  finance: { ar: "المالية", en: "Finance" },
  reports: { ar: "التقارير", en: "Reports" },
  management: { ar: "الإدارة", en: "Management" },
  settings: { ar: "الإعدادات", en: "Settings" },
};

const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (tab: TabItem) => {
    if (tab.key === "home") return location.pathname === "/dashboard";
    if (tab.key === "business") return ["/dashboard/billing", "/dashboard/customers", "/dashboard/quotations", "/dashboard/contracts", "/dashboard/sales-orders", "/dashboard/purchase-orders", "/dashboard/delivery-notes", "/dashboard/inventory", "/dashboard/supplier-inbox", "/dashboard/credit-notes"].some(p => location.pathname.startsWith(p));
    if (tab.key === "finance") return ["/dashboard/finance", "/dashboard/expenses", "/dashboard/journal-entries", "/dashboard/budgets", "/dashboard/cost-profit-centers", "/dashboard/period-lock", "/dashboard/vat-return"].some(p => location.pathname.startsWith(p));
    if (tab.key === "notifications") return location.pathname.startsWith("/dashboard/payment-reminders");
    return false;
  };

  const sections = ["business", "finance", "reports", "management", "settings"] as const;

  return (
    <>
      {/* Bottom Tab Bar — mobile only */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-background border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {primaryTabs.map((tab) => {
            const active = isActive(tab);
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors min-w-0",
                  "active:bg-muted/50",
                  active
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                <span className={cn("text-[10px] leading-tight truncate", active && "font-semibold")}>
                  {isRTL ? tab.labelAr : tab.labelEn}
                </span>
              </button>
            );
          })}

          {/* More tab */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors min-w-0",
              "active:bg-muted/50",
              moreOpen ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal size={20} strokeWidth={1.5} />
            <span className="text-[10px] leading-tight truncate">
              {isRTL ? "المزيد" : "More"}
            </span>
          </button>
        </div>
      </nav>

      {/* More Sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side={isRTL ? "right" : "left"}
          className="w-[85vw] max-w-sm p-0"
        >
          <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
            <SheetTitle className="text-base">
              {isRTL ? "جميع الأقسام" : "All Sections"}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-5rem)]">
            <div className="py-2">
              {sections.map((section) => {
                const items = moreLinks.filter((l) => l.section === section);
                if (items.length === 0) return null;
                return (
                  <div key={section} className="mb-1">
                    <p className="px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {isRTL ? sectionLabels[section].ar : sectionLabels[section].en}
                    </p>
                    {items.map((link) => {
                      const Icon = link.icon;
                      const active = location.pathname === link.path;
                      return (
                        <button
                          key={link.path}
                          onClick={() => {
                            navigate(link.path);
                            setMoreOpen(false);
                          }}
                          className={cn(
                            "flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors",
                            "active:bg-muted/50",
                            active
                              ? "text-primary bg-primary/5 font-medium"
                              : "text-foreground hover:bg-muted/50"
                          )}
                        >
                          <Icon size={18} className={active ? "text-primary" : "text-muted-foreground"} />
                          <span>{isRTL ? link.labelAr : link.labelEn}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default BottomTabBar;
