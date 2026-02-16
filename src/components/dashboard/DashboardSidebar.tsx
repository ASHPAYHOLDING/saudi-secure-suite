import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainMenu = [
  { icon: LayoutDashboard, label: "الرئيسية", path: "/dashboard" },
  { icon: Users, label: "المستخدمين", path: "/dashboard/users" },
  { icon: CreditCard, label: "الفواتير", path: "/dashboard/billing" },
  { icon: FileSignature, label: "العقود", path: "/dashboard/contracts" },
  { icon: FileText, label: "التقارير", path: "/dashboard/reports" },
  { icon: BarChart3, label: "التحليلات", path: "/dashboard/analytics" },
];

const settingsMenu = [
  { icon: Building2, label: "إعدادات الشركة", path: "/dashboard/company" },
  { icon: Palette, label: "هوية الشركة", path: "/dashboard/branding" },
  { icon: Stamp, label: "الختم الإلكتروني", path: "/dashboard/stamp" },
  { icon: Shield, label: "سجل المراجعة", path: "/dashboard/audit" },
  { icon: Settings, label: "الإعدادات", path: "/dashboard/settings" },
  { icon: HelpCircle, label: "المساعدة", path: "/dashboard/help" },
];

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const DashboardSidebar = ({ collapsed, onToggle }: DashboardSidebarProps) => {
  const location = useLocation();

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
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <span className="text-xs font-bold text-sidebar-primary-foreground font-english">S</span>
            </div>
            <span className="text-sm font-bold text-sidebar-foreground">ساس بلس</span>
          </div>
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
          {mainMenu.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </div>

        {!collapsed && (
          <div className="my-4 border-t border-sidebar-border" />
        )}

        <div className="mt-4 space-y-1">
          {!collapsed && (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              الإعدادات
            </p>
          )}
          {settingsMenu.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </div>
      </div>

      {/* User / Logout */}
      <div className="border-t border-sidebar-border p-3">
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
