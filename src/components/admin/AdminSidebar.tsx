import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Users,
  LogOut,
  ChevronRight,
  HeartPulse,
  Shield,
  ToggleRight,
  ShieldAlert,
  Receipt,
  BarChart3,
  LayoutTemplate,
  Mail,
  Inbox,
  Bot,
  Cloud,
  Wallet,
  Headphones,
  Tag,
  Crown,
  MonitorDot,
  MessageSquare,
  ClipboardCheck,
  Copy,
  Zap,
  HardDrive,
  Database,
  Server,
  Megaphone,
  Globe,
  Bell,
} from "lucide-react";
import NumaxioLogo from "@/components/landing/NumaxioLogo";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: LayoutDashboard, label: "لوحة التحكم", path: "/admin" },
  { icon: Building2, label: "الشركات", path: "/admin/companies" },
  { icon: CreditCard, label: "الاشتراكات", path: "/admin/subscriptions" },
  { icon: Users, label: "المستخدمين", path: "/admin/users" },
  { icon: ToggleRight, label: "المميزات", path: "/admin/features" },
  { icon: ShieldAlert, label: "الأمان والتدقيق", path: "/admin/security" },
  { icon: Receipt, label: "المراقبة المالية", path: "/admin/finance" },
  { icon: LayoutTemplate, label: "إدارة القوالب", path: "/admin/templates" },
  { icon: Mail, label: "قوالب البريد", path: "/admin/email-templates" },
  { icon: Inbox, label: "مركز البريد", path: "/admin/email-center" },
  { icon: Globe, label: "مزودي البريد", path: "/admin/email-provider" },
  { icon: Bot, label: "المستشار الذكي", path: "/admin/ai" },
  { icon: Cloud, label: "البنية التحتية", path: "/admin/infrastructure" },
  { icon: HeartPulse, label: "صحة المنصة", path: "/admin/platform-health" },
  { icon: MonitorDot, label: "مركز المراقبة", path: "/admin/monitoring" },
  { icon: Wallet, label: "رسوم الدفع", path: "/admin/paylink-fees" },
  { icon: CreditCard, label: "إدارة نيوماكسيو باي", path: "/admin/paylink-management" },
  { icon: Headphones, label: "تذاكر الدعم", path: "/admin/support" },
  
  { icon: Wallet, label: "طلبات شحن المحفظة", path: "/admin/wallet-requests" },
  { icon: Tag, label: "أكواد الخصم", path: "/admin/discount-codes" },
  { icon: Crown, label: "إدارة الشركاء", path: "/admin/affiliates" },
  { icon: LayoutTemplate, label: "توثيق التكاملات", path: "/admin/integrations/docs" },
  { icon: ClipboardCheck, label: "تدقيق النظام", path: "/admin/system/full-audit" },
  { icon: BarChart3, label: "تحليلات الاستخدام", path: "/admin/system/usage" },
  { icon: Copy, label: "كشف التكرارات", path: "/admin/system/duplicates" },
  { icon: Zap, label: "محرك التنظيف", path: "/admin/system/cleanup" },
  { icon: Shield, label: "تدقيق الهيكلة", path: "/admin/system/architecture-audit" },
  { icon: HardDrive, label: "تقرير التخزين", path: "/admin/system/storage" },
  { icon: Database, label: "لوحة الترحيلات", path: "/admin/system/migrations" },
  { icon: Server, label: "البنية التحتية للنظام", path: "/admin/system/infrastructure" },
  { icon: Megaphone, label: "إدارة التحديثات", path: "/admin/updates" },
  { icon: Bell, label: "كتالوج الإشعارات", path: "/admin/notifications" },
  { icon: LayoutTemplate, label: "استوديو القوالب", path: "/admin/template-studio" },
  { icon: MessageSquare, label: "مركز واتساب", path: "/admin/whatsapp" },
  { icon: BarChart3, label: "تحليلات واتساب", path: "/admin/whatsapp/analytics" },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const AdminSidebar = ({ collapsed, onToggle, mobileOpen, onMobileClose }: AdminSidebarProps) => {
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
        collapsed ? "w-[68px]" : "w-64",
        "max-md:hidden",
        mobileOpen && "max-md:!flex"
      )}
    >
      {/* Logo + Badge */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <div className="flex items-center gap-2">
          {!collapsed ? (
            <>
              <NumaxioLogo variant="dark" size="sm" />
              <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                ADMIN
              </span>
            </>
          ) : (
            <Shield size={20} className="text-destructive" />
          )}
        </div>
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
          {menuItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </div>
      </div>

      {/* Back to Dashboard */}
      <div className="border-t border-sidebar-border p-3">
        <Link
          to="/dashboard"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>لوحة المنشأة</span>}
        </Link>
      </div>
    </aside>
  );
};

export default AdminSidebar;
