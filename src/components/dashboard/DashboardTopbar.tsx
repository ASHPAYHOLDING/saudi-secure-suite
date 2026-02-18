import { Search, ChevronDown, LogOut, Globe, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import NotificationBell from "@/components/notifications/NotificationBell";
import CollaborationNotifications from "@/components/collaboration/CollaborationNotifications";
import BranchSelector from "@/components/branches/BranchSelector";
import TenantSwitcher from "@/components/dashboard/TenantSwitcher";
import { useLanguage } from "@/hooks/useLanguage";

interface DashboardTopbarProps {
  onMobileMenuToggle?: () => void;
}

const DashboardTopbar = ({ onMobileMenuToggle }: DashboardTopbarProps) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { t, currentLang, toggleLanguage, dir } = useLanguage();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const initials = profile?.full_name?.charAt(0) || (currentLang === "ar" ? "م" : "U");

  return (
    <header dir={dir} className="sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-3 md:px-6 gap-2">
      {/* Mobile menu + Search + Branch Selector */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {onMobileMenuToggle && (
          <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 shrink-0" onClick={onMobileMenuToggle}>
            <Menu size={20} />
          </Button>
        )}
        <div className="hidden md:flex items-center gap-3">
          <TenantSwitcher />
          <BranchSelector />
        </div>
        <div className="relative hidden lg:block">
          <Search size={16} className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("dashboard.searchPlaceholder")}
            className="h-9 w-72 rounded-lg border border-input bg-secondary/50 ps-9 pe-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
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

        {/* Notifications */}
        <NotificationBell />
        <div className="hidden sm:block">
          <CollaborationNotifications />
        </div>

        {/* Sign Out */}
        <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-muted-foreground hover:text-destructive" onClick={handleSignOut}>
          <LogOut size={18} />
        </Button>

        {/* User */}
        <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border px-2 md:px-3 py-1.5 cursor-pointer hover:bg-secondary/50 transition-colors">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent">
            <span className="text-xs font-bold">{initials}</span>
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-medium text-foreground">{profile?.full_name || t("common.user")}</p>
            <p className="text-[10px] text-muted-foreground font-english">{profile?.email || ""}</p>
          </div>
          <ChevronDown size={14} className="text-muted-foreground hidden lg:block" />
        </div>
      </div>
    </header>
  );
};

export default DashboardTopbar;
