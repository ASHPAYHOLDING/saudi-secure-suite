import { Search, ChevronDown, LogOut, Globe, Menu, User, Settings, CreditCard, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import NotificationBell from "@/components/notifications/NotificationBell";
import CollaborationNotifications from "@/components/collaboration/CollaborationNotifications";
import BranchSelector from "@/components/branches/BranchSelector";
import TenantSwitcher from "@/components/dashboard/TenantSwitcher";
import { useLanguage } from "@/hooks/useLanguage";
import { ThemeSwitcher } from "@/theme/ThemeSwitcher";
import { useEntitlements } from "@/hooks/useEntitlements";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardTopbarProps {
  onMobileMenuToggle?: () => void;
}

const DashboardTopbar = ({ onMobileMenuToggle }: DashboardTopbarProps) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { t, currentLang, toggleLanguage, dir } = useLanguage();
  const { entitlements } = useEntitlements();
  const isEnterprise = entitlements?.enterprise_mode?.allowed === true;

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const initials = profile?.full_name?.charAt(0) || (currentLang === "ar" ? "م" : "U");

  return (
    <header dir={dir} className={`sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b px-3 md:px-6 gap-2 ${isEnterprise ? "border-border/50 bg-background/80 backdrop-blur-xl" : "border-border bg-background/95 backdrop-blur-sm"}`}>
      {/* Mobile menu + Search + Branch Selector */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {onMobileMenuToggle && (
          <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 shrink-0" onClick={onMobileMenuToggle}>
            <Menu size={20} />
          </Button>
        )}

        {/* Enterprise Mode Indicator */}
        {isEnterprise && (
          <div className="hidden sm:flex items-center gap-1.5 enterprise-indicator rounded-lg px-2.5 py-1.5">
            <Building2 size={14} className="text-accent shrink-0" />
            <span className="text-[11px] font-semibold text-foreground hidden lg:inline">
              {currentLang === "ar" ? "وضع المؤسسات" : "Enterprise Mode"}
            </span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-accent/30 text-accent font-bold">
              {currentLang === "ar" ? "نشط" : "Active"}
            </Badge>
          </div>
        )}

        <div className="hidden md:flex items-center gap-3">
          <TenantSwitcher />
          <BranchSelector />
        </div>

        {/* Mobile search button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9 shrink-0"
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
        >
          <Search size={20} />
        </Button>

        {/* Desktop search input — opens command palette on focus/click */}
        <div className="relative hidden lg:block">
          <Search size={16} className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            readOnly
            placeholder={t("dashboard.searchPlaceholder")}
            className="h-9 w-72 rounded-lg border border-input bg-secondary/50 ps-9 pe-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            onFocus={(e) => { e.target.blur(); window.dispatchEvent(new Event("open-command-palette")); }}
          />
          <kbd className="absolute inset-inline-end-3 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        {/* Language Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground hover:text-foreground h-8 md:h-9 px-2"
          onClick={toggleLanguage}
        >
          <Globe size={16} />
          <span className="text-xs font-medium hidden sm:inline">{currentLang === "ar" ? "EN" : "ع"}</span>
        </Button>

        {/* Theme Switcher */}
        <ThemeSwitcher />

        {/* Notifications */}
        <NotificationBell />
        <div className="hidden sm:block">
          <CollaborationNotifications />
        </div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg border border-border px-2 md:px-3 py-1.5 cursor-pointer hover:bg-secondary/50 transition-colors outline-none">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent">
                <span className="text-xs font-bold">{initials}</span>
              </div>
              <div className="hidden lg:block text-start">
                <p className="text-xs font-medium text-foreground">{profile?.full_name || t("common.user")}</p>
                <p className="text-[10px] text-muted-foreground font-english">{profile?.email || ""}</p>
              </div>
              <ChevronDown size={14} className="text-muted-foreground hidden lg:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={currentLang === "ar" ? "start" : "end"} className="w-56">
            <div className="px-3 py-2 lg:hidden">
              <p className="text-sm font-medium text-foreground">{profile?.full_name || t("common.user")}</p>
              <p className="text-xs text-muted-foreground font-english">{profile?.email || ""}</p>
            </div>
            <DropdownMenuSeparator className="lg:hidden" />
            <DropdownMenuItem onClick={() => navigate("/dashboard/company")} className="gap-2 cursor-pointer">
              <User size={14} />
              {t("nav.companySettings")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/dashboard/settings")} className="gap-2 cursor-pointer">
              <Settings size={14} />
              {t("nav.settings")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/dashboard/subscription")} className="gap-2 cursor-pointer">
              <CreditCard size={14} />
              {t("nav.subscription")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
              <LogOut size={14} />
              {currentLang === "ar" ? "تسجيل الخروج" : "Sign Out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default DashboardTopbar;
