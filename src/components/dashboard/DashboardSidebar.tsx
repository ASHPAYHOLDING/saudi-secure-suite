import { Link, useLocation } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import {
  LayoutDashboard, Users, UsersRound, FileText, Settings, BarChart3,
  Building2, CreditCard, HelpCircle, LogOut, ChevronRight, ChevronLeft,
  Stamp, FileSignature, Shield, Palette, ShieldCheck, Crown, Package,
  ShoppingCart, Receipt, Plug, Wallet, KeyRound, MessageCircle,
  Truck, BookOpen, Zap, Inbox, Bell, GitBranch, ChevronDown, Headphones, Lock, Target,
  TrendingUp, CalendarClock, Wrench, PieChart, Activity, UserCircle,
  Briefcase, MoreHorizontal, X,
} from "lucide-react";
import NumaxioLogo from "@/components/landing/NumaxioLogo";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isModuleAllowed, type Module } from "@/lib/tenant-modules";
import { useLanguage } from "@/hooks/useLanguage";
import { useEntitlements, FEATURE_KEYS, type FeatureKey } from "@/hooks/useEntitlements";
import { NAV_PATH_TO_FEATURE } from "@/lib/feature-route-map";
import { useGranularPermissions } from "@/hooks/useGranularPermissions";
import { motion, AnimatePresence } from "framer-motion";
import FavoritesSidebarSection from "@/components/dashboard/FavoritesSidebarSection";


interface NavItemDef {
  icon: any;
  key: string;
  path: string;
  module: Module;
  featureKey?: FeatureKey;
  requiredPermission?: string;
}

interface NavGroup {
  labelKey: string;
  /** Max 6 items shown directly. Rest go to "More…" overflow */
  items: NavItemDef[];
  /** If true, this group is collapsed by default */
  defaultCollapsed?: boolean;
}

const MAX_VISIBLE_ITEMS = 6;

const topItems: NavItemDef[] = [
  { icon: LayoutDashboard, key: "nav.home", path: "/dashboard", module: "dashboard" },
];

/**
 * New IA: 5 groups + Settings.
 * Max 2 levels (Group → Item). No sub-groups.
 * Sales + Purchasing merged into "الأعمال".
 * HR is independent.
 * Settings collapsed by default.
 */
const navGroups: NavGroup[] = [
  // ── الأعمال (Sales + Purchasing) ──
  {
    labelKey: "nav.group.business",
    items: [
      { icon: Users, key: "nav.customers", path: "/dashboard/customers", module: "customers" },
      { icon: CreditCard, key: "nav.invoices", path: "/dashboard/billing", module: "billing" },
      { icon: FileText, key: "nav.creditNotes", path: "/dashboard/credit-notes", module: "billing" },
      { icon: FileText, key: "nav.quotations", path: "/dashboard/quotations", module: "quotations" },
      { icon: ShoppingCart, key: "nav.salesOrders", path: "/dashboard/sales-orders", module: "sales-orders" },
      { icon: FileSignature, key: "nav.contracts", path: "/dashboard/contracts", module: "contracts" },
      // overflow →
      { icon: Package, key: "nav.purchaseOrders", path: "/dashboard/purchase-orders", module: "purchase-orders" },
      { icon: Truck, key: "nav.deliveryNotes", path: "/dashboard/delivery-notes", module: "delivery-notes" },
      { icon: Inbox, key: "nav.supplierInbox", path: "/dashboard/supplier-inbox", module: "supplier-inbox" },
      { icon: Package, key: "nav.inventory", path: "/dashboard/inventory", module: "inventory" },
    ],
  },
  // ── المالية ──
  {
    labelKey: "nav.group.finance",
    items: [
      { icon: Wallet, key: "nav.finance", path: "/dashboard/finance", module: "finance" },
      { icon: Receipt, key: "nav.expenses", path: "/dashboard/expenses", module: "expenses" },
      { icon: BookOpen, key: "nav.journalEntries", path: "/dashboard/journal-entries", module: "journal-entries" },
      { icon: Target, key: "nav.budgets", path: "/dashboard/budgets", module: "budgets" },
      { icon: Building2, key: "nav.costProfitCenters", path: "/dashboard/cost-profit-centers", module: "finance" },
      { icon: CalendarClock, key: "nav.periodLock", path: "/dashboard/period-lock", module: "journal-entries" },
      // overflow →
      { icon: Bell, key: "nav.paymentReminders", path: "/dashboard/payment-reminders", module: "payment-reminders" },
      { icon: Shield, key: "nav.collectionsIntelligence", path: "/dashboard/finance/collections-intelligence", module: "finance" },
      { icon: Activity, key: "nav.cashflowRadar", path: "/dashboard/finance/cashflow-radar", module: "finance" },
      { icon: BarChart3, key: "nav.executiveBoard", path: "/dashboard/executive", module: "finance", requiredPermission: "finance.view_executive_board" as any },
      { icon: Shield, key: "nav.vatReturn", path: "/dashboard/vat-return", module: "reports" },
      // Enterprise items (shown inline, gated by featureKey)
      { icon: Building2, key: "nav.corporateStructure", path: "/dashboard/finance/corporate-structure", module: "enterprise", featureKey: "enterprise_mode" as any },
      { icon: BookOpen, key: "nav.chartOfAccounts", path: "/dashboard/finance/coa", module: "enterprise", featureKey: "enterprise_mode" as any },
      { icon: BookOpen, key: "nav.generalJournal", path: "/dashboard/finance/journal", module: "enterprise", featureKey: "enterprise_mode" as any },
      { icon: CalendarClock, key: "nav.periodClose", path: "/dashboard/finance/period-close", module: "enterprise", featureKey: "enterprise_mode" as any },
      { icon: BarChart3, key: "nav.financialStatements", path: "/dashboard/finance/statements", module: "enterprise", featureKey: "enterprise_mode" as any },
      { icon: Shield, key: "nav.journalApprovals", path: "/dashboard/enterprise/approvals/journal", module: "enterprise", featureKey: "enterprise_mode" as any },
    ],
  },
  // ── التقارير والتحليلات ──
  {
    labelKey: "nav.group.reports",
    items: [
      { icon: FileText, key: "nav.reports", path: "/dashboard/reports", module: "reports" },
      { icon: BarChart3, key: "nav.analytics", path: "/dashboard/analytics", module: "analytics" },
      { icon: TrendingUp, key: "nav.forecasting", path: "/dashboard/forecasting", module: "analytics" },
      { icon: PieChart, key: "nav.financialHealth", path: "/dashboard/analytics/financial-health", module: "analytics" },
    ],
  },
  // ── الموارد البشرية (independent) ──
  {
    labelKey: "nav.group.hr",
    items: [
      { icon: Users, key: "nav.hr", path: "/dashboard/hr", module: "hr" as any, featureKey: FEATURE_KEYS.HR_CORE },
      { icon: Users, key: "nav.hrEmployees", path: "/dashboard/hr/employees", module: "hr" as any, featureKey: FEATURE_KEYS.HR_CORE },
      { icon: CalendarClock, key: "nav.hrLeave", path: "/dashboard/hr/leave", module: "hr" as any, featureKey: FEATURE_KEYS.HR_CORE },
      { icon: Activity, key: "nav.hrAttendance", path: "/dashboard/hr/attendance", module: "hr" as any, featureKey: FEATURE_KEYS.HR_CORE },
      { icon: UserCircle, key: "nav.ess", path: "/dashboard/ess", module: "hr" as any, featureKey: FEATURE_KEYS.HR_CORE, requiredPermission: "ess.view" },
      // overflow →
      { icon: FileSignature, key: "nav.hrContracts", path: "/dashboard/hr/contracts", module: "hr" as any, featureKey: FEATURE_KEYS.HR_CORE },
      { icon: Building2, key: "nav.hrOrg", path: "/dashboard/hr/org", module: "hr" as any, featureKey: FEATURE_KEYS.HR_CORE },
      { icon: GitBranch, key: "nav.hrApprovals", path: "/dashboard/hr/approvals", module: "hr" as any, featureKey: FEATURE_KEYS.HR_CORE },
      { icon: BarChart3, key: "nav.hrReports", path: "/dashboard/hr/reports", module: "hr" as any, featureKey: FEATURE_KEYS.HR_CORE },
    ],
  },
  // ── الإدارة ──
  {
    labelKey: "nav.group.management",
    items: [
      { icon: UsersRound, key: "nav.team", path: "/dashboard/team", module: "team" },
      { icon: GitBranch, key: "nav.approvals", path: "/dashboard/approvals", module: "billing" },
      { icon: MessageCircle, key: "nav.chat", path: "/dashboard/chat", module: "chat" },
    ],
  },
  // ── الإعدادات (collapsed by default) ──
  {
    labelKey: "nav.settingsSection",
    defaultCollapsed: true,
    items: [
      { icon: Building2, key: "nav.companySettings", path: "/dashboard/company", module: "company" },
      { icon: Building2, key: "nav.branches", path: "/dashboard/branches", module: "branches" },
      { icon: Palette, key: "nav.branding", path: "/dashboard/branding", module: "branding" },
      { icon: KeyRound, key: "nav.permissions", path: "/dashboard/permissions", module: "team" },
      { icon: Plug, key: "nav.integrations", path: "/dashboard/integrations", module: "integrations" },
      { icon: Crown, key: "nav.subscription", path: "/dashboard/subscription", module: "subscription" },
      // overflow →
      { icon: ShieldCheck, key: "nav.compliance", path: "/dashboard/compliance", module: "compliance" },
      { icon: Stamp, key: "nav.stamp", path: "/dashboard/stamp", module: "stamp" },
      { icon: Shield, key: "nav.auditLog", path: "/dashboard/audit", module: "audit" },
      { icon: Settings, key: "nav.settings", path: "/dashboard/settings", module: "settings" },
      { icon: Building2, key: "nav.governanceCenter", path: "/dashboard/governance-center", module: "enterprise", featureKey: "enterprise_mode" as any },
      { icon: Shield, key: "nav.complianceScore", path: "/dashboard/enterprise/compliance-score", module: "enterprise", featureKey: "enterprise_mode" as any },
    ],
  },
];

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const DashboardSidebar = ({ collapsed, onToggle, mobileOpen, onMobileClose }: DashboardSidebarProps) => {
  const location = useLocation();
  const { user, tenantType, userRole } = useAuth();
  const { t, isRTL } = useLanguage();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const { entitlements, loading: loadingEntitlements } = useEntitlements();
  const { canAny } = useGranularPermissions();
  const isOwner = userRole === "owner";

  const isPathLocked = (path: string): boolean => {
    const featureKey = NAV_PATH_TO_FEATURE[path];
    if (!featureKey) return false;
    const ent = entitlements[featureKey];
    return !(ent?.allowed ?? false);
  };

  // Track which groups have "More…" expanded
  const [expandedOverflows, setExpandedOverflows] = useState<Set<string>>(new Set());

  const toggleOverflow = (groupKey: string) => {
    setExpandedOverflows((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  // Initialize open groups — default open if has active item, respect defaultCollapsed
  const getInitialOpenGroups = () => {
    const open = new Set<string>();
    for (const group of navGroups) {
      const hasActiveItem = group.items.some((item) => location.pathname === item.path);
      if (hasActiveItem) {
        open.add(group.labelKey);
      } else if (!group.defaultCollapsed) {
        // Non-defaultCollapsed groups start open
        // Actually let's only auto-open groups with active items to keep it clean
      }
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

  // Filter items by module/permissions
  const filterItems = useMemo(() => {
    return (items: NavItemDef[]) =>
      items.filter((item) => {
        if (!isModuleAllowed(tenantType, item.module)) return false;
        if (item.requiredPermission && !isOwner && !canAny(item.requiredPermission as any)) return false;
        return true;
      });
  }, [tenantType, isOwner, canAny]);

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
          "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 min-h-[44px]",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary font-semibold"
            : isLocked
              ? "text-sidebar-foreground/50 hover:bg-sidebar-accent/30"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary"
        )}
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
    const filteredItems = filterItems(group.items);
    if (filteredItems.length === 0) return null;

    const isOpen = openGroups.has(group.labelKey);
    const hasActiveItem = filteredItems.some((item) => location.pathname === item.path);
    const isOverflowExpanded = expandedOverflows.has(group.labelKey);

    // Split into visible (max 6) and overflow
    const visibleItems = filteredItems.slice(0, MAX_VISIBLE_ITEMS);
    const overflowItems = filteredItems.slice(MAX_VISIBLE_ITEMS);
    const hasOverflow = overflowItems.length > 0;

    // If active item is in overflow, show it in visible
    const activeInOverflow = overflowItems.some((item) => location.pathname === item.path);

    if (collapsed) {
      return (
        <div className="space-y-0.5">
          {filteredItems.map((item) => (
            <NavItem key={item.path} icon={item.icon} label={t(item.key)} path={item.path} />
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
                {visibleItems.map((item) => (
                  <NavItem key={item.path} icon={item.icon} label={t(item.key)} path={item.path} />
                ))}

                {/* Overflow items */}
                {hasOverflow && (
                  <>
                    <AnimatePresence initial={false}>
                      {(isOverflowExpanded || activeInOverflow) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15, ease: "easeInOut" }}
                          className="overflow-hidden space-y-0.5"
                        >
                          {overflowItems.map((item) => (
                            <NavItem key={item.path} icon={item.icon} label={t(item.key)} path={item.path} />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button
                      onClick={() => toggleOverflow(group.labelKey)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-sidebar-foreground/60 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/30 transition-colors"
                    >
                      <MoreHorizontal size={14} className="shrink-0" />
                      <span>
                        {isOverflowExpanded || activeInOverflow
                          ? (isRTL ? "أقل" : "Less")
                          : (isRTL ? `المزيد (${overflowItems.length})` : `More (${overflowItems.length})`)
                        }
                      </span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };


  return (
    <aside
      dir={isRTL ? "rtl" : "ltr"}
      className={cn(
        "fixed top-0 z-40 flex h-screen flex-col border-sidebar-border bg-sidebar transition-all duration-300",
        "inset-inline-start-0 border-e",
        collapsed ? "w-[68px]" : "w-64",
        "max-md:hidden",
        mobileOpen && "max-md:!flex"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <NumaxioLogo variant="dark" size="sm" />
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
        {/* Top-level items (Home) */}
        <div className="space-y-0.5 mb-3">
          {topItems.filter((item) => isModuleAllowed(tenantType, item.module)).map((item) => (
            <NavItem key={item.path} icon={item.icon} label={t(item.key)} path={item.path} />
          ))}
        </div>

        {/* Favorites / Pinned Pages */}
        <FavoritesSidebarSection collapsed={collapsed} isRTL={isRTL} />

        <div className="space-y-0.5 mb-3" />

        {/* Collapsible groups — flat, max 2 levels */}
        <div className="space-y-1">
          {navGroups.map((group) => (
            <CollapsibleGroup key={group.labelKey} group={group} />
          ))}
        </div>
      </div>

      {/* Footer: Support + Admin + Logout */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        <div className="flex items-center gap-1 mb-1">
          <Link
            to="/dashboard/support"
            className="flex-1 flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title={t("nav.support")}
          >
            <Headphones size={16} className="shrink-0" />
            {!collapsed && <span>{t("nav.support")}</span>}
          </Link>
          <Link
            to="/dashboard/help"
            className="flex-1 flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title={t("nav.help")}
          >
            <HelpCircle size={16} className="shrink-0" />
            {!collapsed && <span>{t("nav.help")}</span>}
          </Link>
        </div>

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
  );
};

export default DashboardSidebar;
