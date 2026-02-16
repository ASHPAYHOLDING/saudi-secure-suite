import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  FileText,
  Settings,
  BarChart3,
  Building2,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  Stamp,
  FileSignature,
  Shield,
  Palette,
  ShieldCheck,
  Crown,
  Package,
  ShoppingCart,
} from "lucide-react";
import numaxioLogo from "@/assets/numaxio-logo.png";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isModuleAllowed, type Module } from "@/lib/tenant-modules";

const mainMenu: { icon: any; label: string; path: string; module: Module }[] = [
  { icon: LayoutDashboard, label: "الرئيسية", path: "/dashboard", module: "dashboard" },
  { icon: Users, label: "العملاء", path: "/dashboard/customers", module: "customers" },
  { icon: CreditCard, label: "الفواتير", path: "/dashboard/billing", module: "billing" },
  { icon: FileSignature, label: "العقود", path: "/dashboard/contracts", module: "contracts" },
  { icon: FileText, label: "عروض الأسعار", path: "/dashboard/quotations", module: "quotations" },
  { icon: ShoppingCart, label: "أوامر البيع", path: "/dashboard/sales-orders", module: "sales-orders" },
  { icon: Package, label: "المخزون", path: "/dashboard/inventory", module: "inventory" },
  { icon: FileText, label: "التقارير", path: "/dashboard/reports", module: "reports" },
  { icon: BarChart3, label: "التحليلات", path: "/dashboard/analytics", module: "analytics" },
  { icon: UsersRound, label: "إدارة الفريق", path: "/dashboard/team", module: "team" },
  { icon: Crown, label: "الاشتراك", path: "/dashboard/subscription", module: "subscription" },
];

const settingsMenu: { icon: any; label: string; path: string; module: Module }[] = [
  { icon: Building2, label: "إعدادات الشركة", path: "/dashboard/company", module: "company" },
  { icon: Palette, label: "هوية الشركة", path: "/dashboard/branding", module: "branding" },
  { icon: ShieldCheck, label: "الامتثال والتنظيم", path: "/dashboard/compliance", module: "compliance" },
  { icon: Stamp, label: "الختم الإلكتروني", path: "/dashboard/stamp", module: "stamp" },
  { icon: Shield, label: "سجل المراجعة", path: "/dashboard/audit", module: "audit" },
  { icon: Settings, label: "الإعدادات", path: "/dashboard/settings", module: "settings" },
  { icon: HelpCircle, label: "المساعدة", path: "/dashboard/help", module: "help" },
];




interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const DashboardSidebar = ({ collapsed, onToggle }: DashboardSidebarProps) => {
  const location = useLocation();
  const { user, tenantType } = useAuth();
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
      dir="rtl"
      className={cn(
        "fixed right-0 top-0 z-40 flex h-screen flex-col border-l border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed ? (
          <img src={numaxioLogo} alt="نيوماكسيو" className="h-7" />
        ) : (
          <img src={numaxioLogo} alt="نيوماكسيو" className="h-6 w-6 object-contain" />
        )}
        <button
          onClick={onToggle}
          className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ChevronRight
            size={16}
            className={cn("transition-transform", !collapsed && "rotate-180")}
          />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {mainMenu.filter((item) => isModuleAllowed(tenantType, item.module)).map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </div>

        {!collapsed && (
          <div className="my-4 border-t border-sidebar-border" />
        )}

        {(() => {
          const filteredSettings = settingsMenu.filter((item) => isModuleAllowed(tenantType, item.module));
          return filteredSettings.length > 0 ? (
            <div className="mt-4 space-y-1">
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  الإعدادات
                </p>
              )}
              {filteredSettings.map((item) => (
                <NavItem key={item.path} {...item} />
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
            {!collapsed && <span>لوحة السوبر أدمن</span>}
          </Link>
        )}
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </Link>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
