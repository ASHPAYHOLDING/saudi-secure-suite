import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import { useUnreadCount } from "@/hooks/useNotifications";
import { Badge } from "@/components/ui/badge";

const NotificationCenterPage = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const unreadCount = useUnreadCount();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Bell size={20} className="text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            {isAr ? "مركز الإشعارات" : "Notification Center"}
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "جميع إشعاراتك في مكان واحد — تصفّح وفلتر وأرشف."
              : "All your notifications in one place — browse, filter, and archive."}
          </p>
        </div>
      </div>

      <NotificationCenter />
    </div>
  );
};

export default NotificationCenterPage;
