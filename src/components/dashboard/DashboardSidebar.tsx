import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, UsersRound, FileText, Settings, BarChart3,
  Building2, CreditCard, HelpCircle, LogOut, ChevronRight, ChevronLeft,
  Stamp, FileSignature, Shield, Palette, ShieldCheck, Crown, Package,
  ShoppingCart, Receipt, Plug, Wallet, Table2, KeyRound, MessageCircle,
  Truck, BookOpen, Zap, Inbox, Bell, GitBranch, Sparkles, ChevronDown, Headphones, Lock, Target,
  TrendingUp, Key, CheckCircle2,
} from "lucide-react";
import NumaxioLogo from "@/components/landing/NumaxioLogo";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isModuleAllowed, type Module } from "@/lib/tenant-modules";
import { useLanguage } from "@/hooks/useLanguage";
import { useEntitlements, FEATURE_KEYS, type FeatureKey } from "@/hooks/useEntitlements";
import { NAV_PATH_TO_FEATURE } from "@/lib/feature-route-map";
import { motion, AnimatePresence } from "framer-motion";
import { RamadanBadge } from "@/components/ramadan";
import { useTheme } from "@/theme/ThemeProvider";


interface NavItemDef {
  icon: any;
  key: string;
  path: string;
  module: Module;
  featureKey?: FeatureKey;
}

interface NavGroup {
  labelKey: string;
  items: NavItemDef[];
}

const topItems: NavItemDef[] = [
  { icon: LayoutDashboard, key: "nav.home", path: "/dashboard", module: "dashboard" },
];

const navGroups: NavGroup[] = [
  {
    labelKey: "nav.group.sales",
    items: [
      { icon: Users, key: "nav.customers", path: "/dashboard/customers", module: "customers" },
      { icon: CreditCard, key: "nav.invoices", path: "/dashboard/billing", module: "billing" },
      { icon: FileText, key: "nav.creditNotes", path: "/dashboard/credit-notes", module: "billing" },
      { icon: FileText, key: "nav.quotations", path: "/dashboard/quotations", module: "quotations" },
      { icon: ShoppingCart, key: "nav.salesOrders", path: "/dashboard/sales-orders", module: "sales-orders" },
      { icon: FileSignature, key: "nav.contracts", path: "/dashboard/contracts", module: "contracts" },
    ],
  },
  {
    labelKey: "nav.group.purchasing",
    items: [
      { icon: Package, key: "nav.purchaseOrders", path: "/dashboard/purchase-orders", module: "purchase-orders" },
      { icon: Truck, key: "nav.deliveryNotes", path: "/dashboard/delivery-notes", module: "delivery-notes" },
      { icon: Inbox, key: "nav.supplierInbox", path: "/dashboard/supplier-inbox", module: "supplier-inbox" },
      { icon: Package, key: "nav.inventory", path: "/dashboard/inventory", module: "inventory" },
    ],
  },
  {
    labelKey: "nav.group.finance",
    items: [
      { icon: Receipt, key: "nav.expenses", path: "/dashboard/expenses", module: "expenses" },
      { icon: Wallet, key: "nav.finance", path: "/dashboard/finance", module: "finance" },
      { icon: BookOpen, key: "nav.journalEntries", path: "/dashboard/journal-entries", module: "journal-entries" },
      { icon: Lock, key: "nav.periodLock", path: "/dashboard/period-lock", module: "journal-entries" },
      { icon: Building2, key: "nav.costProfitCenters", path: "/dashboard/cost-profit-centers", module: "finance" },
      { icon: Target, key: "nav.budgets", path: "/dashboard/budgets", module: "budgets" },
      { icon: Bell, key: "nav.paymentReminders", path: "/dashboard/payment-reminders", module: "payment-reminders" },
      { icon: ShieldCheck, key: "nav.dataQuality", path: "/dashboard/data-quality", module: "finance" },
      { icon: Shield, key: "nav.vatReturn", path: "/dashboard/vat-return", module: "reports" },
      { icon: Receipt, key: "nav.wallet", path: "/dashboard/wallet", module: "finance" },
      { icon: Wallet, key: "nav.numaxioPay", path: "/dashboard/numaxio-pay", module: "finance" },
      { icon: Crown, key: "nav.affiliate", path: "/dashboard/affiliate", module: "finance" },
    ],
  },
  {
    labelKey: "nav.group.reports",
    items: [
      { icon: FileText, key: "nav.reports", path: "/dashboard/reports", module: "reports" },
      { icon: BarChart3, key: "nav.reportBuilder", path: "/dashboard/report-builder", module: "reports" },
      { icon: BarChart3, key: "nav.analytics", path: "/dashboard/analytics", module: "analytics" },
      { icon: TrendingUp, key: "nav.forecasting", path: "/dashboard/forecasting", module: "analytics" },
      { icon: Sparkles, key: "nav.smartQuery", path: "/dashboard/smart-query", module: "analytics" },
      { icon: Table2, key: "nav.sheetView", path: "/dashboard/sheet-view", module: "sheet-view" },
    ],
  },
  {
    labelKey: "nav.group.management",
    items: [
      { icon: Zap, key: "nav.productivity", path: "/dashboard/productivity", module: "dashboard" },
      { icon: GitBranch, key: "nav.approvals", path: "/dashboard/approvals", module: "billing" },
      { icon: CheckCircle2, key: "nav.myApprovals", path: "/dashboard/my-approvals", module: "billing" },
      { icon: MessageCircle, key: "nav.chat", path: "/dashboard/chat", module: "chat" },
      { icon: UsersRound, key: "nav.team", path: "/dashboard/team", module: "team" },
      { icon: Plug, key: "nav.integrations", path: "/dashboard/integrations", module: "integrations" },
      
      { icon: CreditCard, key: "nav.paymentProviders", path: "/dashboard/integrations/payments", module: "integrations" },
      { icon: Key, key: "nav.apiKeys", path: "/dashboard/api-keys", module: "integrations" },
      { icon: Crown, key: "nav.subscription", path: "/dashboard/subscription", module: "subscription" },
    ],
  },
];

const settingsMenuKeys: NavItemDef[] = [
  { icon: Building2, key: "nav.companySettings", path: "/dashboard/company", module: "company" },
  { icon: Building2, key: "nav.branches", path: "/dashboard/branches", module: "branches" },
  { icon: Building2, key: "nav.groupCompany", path: "/dashboard/group", module: "company" },
  { icon: Palette, key: "nav.branding", path: "/dashboard/branding", module: "branding" },
  { icon: ShieldCheck, key: "nav.compliance", path: "/dashboard/compliance", module: "compliance" },
  { icon: Stamp, key: "nav.stamp", path: "/dashboard/stamp", module: "stamp" },
  { icon: Shield, key: "nav.auditLog", path: "/dashboard/audit", module: "audit" },
  { icon: KeyRound, key: "nav.permissions", path: "/dashboard/permissions", module: "team" },
  { icon: Settings, key: "nav.settings", path: "/dashboard/settings", module: "settings" },
  { icon: Headphones, key: "nav.support", path: "/dashboard/support", module: "help" },
  { icon: HelpCircle, key: "nav.help", path: "/dashboard/help", module: "help" },
];

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const DashboardSidebar = ({ collapsed, onToggle, mobileOpen, onMobileClose }: DashboardSidebarProps) => {
  const location = useLocation();
  const { user, tenantType } = useAuth();
  const { t, isRTL } = useLanguage();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const { entitlements, loading: loadingEntitlements } = useEntitlements();
  const { seasonalTheme } = useTheme();
  const isRamadan = seasonalTheme === "ramadan";


  // Check if a feature is entitled (backend-driven) using NAV_PATH_TO_FEATURE map
  const isPathLocked = (path: string): boolean => {
    const featureKey = NAV_PATH_TO_FEATURE[path];
    if (!featureKey) return false; // No feature key = always accessible
    const ent = entitlements[featureKey];
    return !(ent?.allowed ?? false);
  };

  // Initialize open groups based on current route
  const getInitialOpenGroups = () => {
    const open = new Set<string>();
    for (const group of navGroups) {
      if (group.items.some((item) => location.pathname === item.path)) {
        open.add(group.labelKey);
      }
    }
    // Also check settings
    if (settingsMenuKeys.some((item) => location.pathname === item.path)) {
      open.add("nav.settingsSection");
    }
    return open;
  };

  const [openGroups, setOpenGroups] = useState<Set<string>>(getInitialOpenGroups);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  const NavItem = ({ icon: Icon, label, path, badge }: { icon: any; label: string; path: string; badge?: string }) => {
    const isActive = location.pathname === path;
    const isLocked = isPathLocked(path);
    return (
      <Link
        to={path}
        className={cn(
          "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
          isActive
            ? isRamadan
              ? "bg-sidebar-accent font-semibold"
              : "bg-sidebar-accent text-sidebar-primary font-semibold"
            : isLocked
              ? "text-sidebar-foreground/50 hover:bg-sidebar-accent/30"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary"
        )}
        style={isActive && isRamadan ? {
          color: "hsl(var(--ramadan-emerald))",
          borderInlineStart: "2px solid hsl(var(--ramadan-gold)/0.5)",
        } : undefined}
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed && (
          <span className="flex-1 flex items-center gap-2">
            {label}
            {isLocked && <Lock size={12} className="text-muted-foreground" />}
            {badge && !isLocked && (
              <span className="relative flex items-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent/40" />
                <span className="relative inline-flex rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground leading-none">
                  {badge}
                </span>
              </span>
            )}
          </span>
        )}
        {collapsed && badge && !isLocked && (
          <span className="absolute top-0.5 end-0.5 h-2 w-2 rounded-full bg-accent" />
        )}
      </Link>
    );
  };


  const CollapsibleGroup = ({ group }: { group: NavGroup }) => {
    const filteredItems = group.items.filter((item) => isModuleAllowed(tenantType, item.module));
    if (filteredItems.length === 0) return null;

    const isOpen = openGroups.has(group.labelKey);
    const hasActiveItem = filteredItems.some((item) => location.pathname === item.path);

    if (collapsed) {
      return (
        <div className="space-y-0.5">
          {filteredItems.map((item) => (
            <NavItem key={item.path} icon={item.icon} label={t(item.key)} path={item.path} badge={item.path === "/dashboard/numaxio-pay" ? "جديد" : undefined} />
          ))}
        </div>
      );
    }

    return (
      <div>
        <button
          onClick={() => toggleGroup(group.labelKey)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors",
            hasActiveItem
              ? "text-sidebar-primary"
              : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
          )}
        >
          <span>{t(group.labelKey)}</span>
          <ChevronDown
            size={14}
            className={cn(
              "transition-transform duration-200",
              isOpen ? "rotate-0" : isRTL ? "rotate-90" : "-rotate-90"
            )}
          />
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-0.5 pb-1">
                {filteredItems.map((item) => (
                  <NavItem key={item.path} icon={item.icon} label={t(item.key)} path={item.path} badge={item.path === "/dashboard/numaxio-pay" ? "جديد" : undefined} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const filteredSettings = settingsMenuKeys.filter((item) => isModuleAllowed(tenantType, item.module));
  const isSettingsOpen = openGroups.has("nav.settingsSection");
  const hasActiveSettings = filteredSettings.some((item) => location.pathname === item.path);

  return (
    <>
    <aside
      dir={isRTL ? "rtl" : "ltr"}
      className={cn(
        "fixed top-0 z-40 flex h-screen flex-col border-sidebar-border bg-sidebar transition-all duration-300",
        "inset-inline-start-0 border-e",
        collapsed ? "w-[68px]" : "w-64",
        // Mobile: hidden by default, shown via mobileOpen
        "max-md:hidden",
        mobileOpen && "max-md:!flex"
      )}
    >
      {/* Logo + Ramadan badge */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <NumaxioLogo variant="dark" size="sm" />
            <RamadanBadge size="sm" text="🌙" className="hidden sm:inline-flex" />
          </div>
        ) : (
          <NumaxioLogo variant="dark" size="sm" showText={false} />
        )}
        <button
          onClick={onToggle}
          className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <CollapseIcon size={16} className="transition-transform" />
        </button>
      </div>


      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* Top-level items (Home, Productivity) */}
        <div className="space-y-0.5 mb-3">
          {topItems.filter((item) => isModuleAllowed(tenantType, item.module)).map((item) => (
            <NavItem key={item.path} icon={item.icon} label={t(item.key)} path={item.path} />
          ))}
        </div>

        {/* Collapsible groups */}
        <div className="space-y-1">
          {navGroups.map((group) => (
            <CollapsibleGroup key={group.labelKey} group={group} />
          ))}
        </div>

        {/* Settings group */}
        {filteredSettings.length > 0 && (
          <>
            {!collapsed && <div className="my-3 border-t border-sidebar-border" />}
            {collapsed ? (
              <div className="space-y-0.5 mt-2">
                {filteredSettings.map((item) => (
                  <NavItem key={item.path} icon={item.icon} label={t(item.key)} path={item.path} />
                ))}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => toggleGroup("nav.settingsSection")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                    hasActiveSettings
                       ? "text-sidebar-primary"
                       : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  )}
                >
                  <span>{t("nav.settingsSection")}</span>
                  <ChevronDown
                    size={14}
                    className={cn(
                      "transition-transform duration-200",
                      isSettingsOpen ? "rotate-0" : isRTL ? "rotate-90" : "-rotate-90"
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isSettingsOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5 pb-1">
                        {filteredSettings.map((item) => (
                          <NavItem key={item.path} icon={item.icon} label={t(item.key)} path={item.path} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>

      {/* Admin + Logout */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        {isPlatformAdmin && (
          <Link
            to="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-warning transition-colors hover:bg-sidebar-accent"
          >
            <Crown size={18} className="shrink-0" />
            {!collapsed && <span>{t("nav.superAdmin")}</span>}
          </Link>
        )}
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>{t("common.logout")}</span>}
        </Link>
      </div>
    </aside>
    </>
  );
};

export default DashboardSidebar;
