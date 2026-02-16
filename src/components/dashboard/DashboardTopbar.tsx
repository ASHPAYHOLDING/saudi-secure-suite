import { Bell, Search, ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const DashboardTopbar = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const initials = profile?.full_name?.charAt(0) || "م";

  return (
    <header dir="rtl" className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-6">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="ابحث في النظام..."
            className="h-9 w-72 rounded-lg border border-input bg-secondary/50 pr-9 pl-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-foreground">
          <Bell size={18} />
          <span className="absolute -top-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
            3
          </span>
        </Button>

        {/* Sign Out */}
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={handleSignOut}>
          <LogOut size={18} />
        </Button>

        {/* User */}
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 cursor-pointer hover:bg-secondary/50 transition-colors">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent">
            <span className="text-xs font-bold">{initials}</span>
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-medium text-foreground">{profile?.full_name || "مستخدم"}</p>
            <p className="text-[10px] text-muted-foreground font-english">{profile?.email || ""}</p>
          </div>
          <ChevronDown size={14} className="text-muted-foreground" />
        </div>
      </div>
    </header>
  );
};

export default DashboardTopbar;
