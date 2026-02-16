import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, UsersRound, FileText, Settings, BarChart3,
  Building2, CreditCard, HelpCircle, LogOut, ChevronRight, ChevronLeft,
  Stamp, FileSignature, Shield, Palette, ShieldCheck, Crown, Package,
  ShoppingCart, Receipt, Plug, Wallet, Table2, KeyRound, MessageCircle,
  Truck, BookOpen, Zap, Inbox, Bell,
} from "lucide-react";
import numaxioLogo from "@/assets/numaxio-logo.png";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isModuleAllowed, type Module } from "@/lib/tenant-modules";
import { useLanguage } from "@/hooks/useLanguage";

const mainMenuKeys: { icon: any; key: string; path: string; module: Module }[] = [
  { icon: Zap, key: "nav.productivity", path: "/dashboard/productivity", module: "dashboard" },
  { icon: LayoutDashboard, key: "nav.home", path: "/dashboard", module: "dashboard" },
  { icon: Users, key: "nav.customers", path: "/dashboard/customers", module: "customers" },
  { icon: CreditCard, key: "nav.invoices", path: "/dashboard/billing", module: "billing" },
  { icon: FileSignature, key: "nav.contracts", path: "/dashboard/contracts", module: "contracts" },
  { icon: FileText, key: "nav.quotations", path: "/dashboard/quotations", module: "quotations" },
  { icon: ShoppingCart, key: "nav.salesOrders", path: "/dashboard/sales-orders", module: "sales-orders" },
  { icon: Package, key: "nav.purchaseOrders", path: "/dashboard/purchase-orders", module: "purchase-orders" },
  { icon: Truck, key: "nav.deliveryNotes", path: "/dashboard/delivery-notes", module: "delivery-notes" },
  { icon: Receipt, key: "nav.expenses", path: "/dashboard/expenses", module: "expenses" },
  { icon: Package, key: "nav.inventory", path: "/dashboard/inventory", module: "inventory" },
  { icon: Wallet, key: "nav.finance", path: "/dashboard/finance", module: "finance" },
  { icon: BookOpen, key: "nav.journalEntries", path: "/dashboard/journal-entries", module: "journal-entries" },
  { icon: Inbox, key: "nav.supplierInbox", path: "/dashboard/supplier-inbox", module: "supplier-inbox" },
  { icon: Bell, key: "nav.paymentReminders", path: "/dashboard/payment-reminders", module: "payment-reminders" },
  { icon: FileText, key: "nav.reports", path: "/dashboard/reports", module: "reports" },
  { icon: Shield, key: "nav.vatReturn", path: "/dashboard/vat-return", module: "reports" },
  { icon: BarChart3, key: "nav.analytics", path: "/dashboard/analytics", module: "analytics" },
  { icon: Table2, key: "nav.sheetView", path: "/dashboard/sheet-view", module: "sheet-view" },
  { icon: MessageCircle, key: "nav.chat", path: "/dashboard/chat", module: "chat" },
  { icon: UsersRound, key: "nav.team", path: "/dashboard/team", module: "team" },
  { icon: Plug, key: "nav.integrations", path: "/dashboard/integrations", module: "integrations" },
  { icon: Crown, key: "nav.subscription", path: "/dashboard/subscription", module: "subscription" },
];

const settingsMenuKeys: { icon: any; key: string; path: string; module: Module }[] = [
  { icon: Building2, key: "nav.companySettings", path: "/dashboard/company", module: "company" },
  { icon: Building2, key: "nav.branches", path: "/dashboard/branches", module: "branches" },
  { icon: Palette, key: "nav.branding", path: "/dashboard/branding", module: "branding" },
  { icon: ShieldCheck, key: "nav.compliance", path: "/dashboard/compliance", module: "compliance" },
  { icon: Stamp, key: "nav.stamp", path: "/dashboard/stamp", module: "stamp" },
  { icon: Shield, key: "nav.auditLog", path: "/dashboard/audit", module: "audit" },
  { icon: KeyRound, key: "nav.permissions", path: "/dashboard/permissions", module: "team" },
  { icon: Settings, key: "nav.settings", path: "/dashboard/settings", module: "settings" },
  { icon: HelpCircle, key: "nav.help", path: "/dashboard/help", module: "help" },
];

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const DashboardSidebar = ({ collapsed, onToggle }: DashboardSidebarProps) => {
  const location = useLocation();
  const { user, tenantType } = useAuth();
  const { t, isRTL } = useLanguage();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setIsPlatformAdmin(!!data));
  }, [user]);

  const CollapseIcon = isRTL
    ? (collapsed ? ChevronLeft : ChevronRight)
    : (collapsed ? ChevronRight : ChevronLeft);

  const NavItem = ({ icon: Icon, label, path }: { icon: any; label: string; path: string }) => {
    const isActive = location.pathname === path;
    return (
      <Link
        to={path}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        <Icon size={20} className="shrink-0" />
        {!collapsed && <span>{label}</span>}
      </Link>
    );
  };

  return (
    <aside
      dir={isRTL ? "rtl" : "ltr"}
      className={cn(
        "fixed top-0 z-40 flex h-screen flex-col border-sidebar-border bg-sidebar transition-all duration-300",
        isRTL ? "right-0 border-l" : "left-0 border-r",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed ? (
          <img src={numaxioLogo} alt="Numaxio" className="h-7" />
        ) : (
          <img src={numaxioLogo} alt="Numaxio" className="h-6 w-6 object-contain" />
        )}
        <button
          onClick={onToggle}
          className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <CollapseIcon size={16} className="transition-transform" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {mainMenuKeys.filter((item) => isModuleAllowed(tenantType, item.module)).map((item) => (
            <NavItem key={item.path} icon={item.icon} label={t(item.key)} path={item.path} />
          ))}
        </div>

        {!collapsed && <div className="my-4 border-t border-sidebar-border" />}

        {(() => {
          const filteredSettings = settingsMenuKeys.filter((item) => isModuleAllowed(tenantType, item.module));
          return filteredSettings.length > 0 ? (
            <div className="mt-4 space-y-1">
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {t("nav.settingsSection")}
                </p>
              )}
              {filteredSettings.map((item) => (
                <NavItem key={item.path} icon={item.icon} label={t(item.key)} path={item.path} />
              ))}
            </div>
          ) : null;
        })()}
      </div>

      {/* Admin + Logout */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        {isPlatformAdmin && (
          <Link
            to="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-amber-400 transition-colors hover:bg-sidebar-accent"
          >
            <Crown size={18} className="shrink-0" />
            {!collapsed && <span>{t("nav.superAdmin")}</span>}
          </Link>
        )}
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>{t("common.logout")}</span>}
        </Link>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
