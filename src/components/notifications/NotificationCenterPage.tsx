import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import NotificationPreferences from "@/components/notifications/NotificationPreferences";
import { useUnreadCount } from "@/hooks/useNotifications";
import { Badge } from "@/components/ui/badge";

const NotificationCenterPage = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [tab, setTab] = useState("all");
  const unreadCount = useUnreadCount();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bell size={24} />
          {isAr ? "مركز الإشعارات" : "Notification Center"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? "جميع إشعاراتك في مكان واحد — تصفّح، فلتر، وتحكّم بالتفضيلات."
            : "All your notifications in one place — browse, filter, and manage preferences."}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} dir={isAr ? "rtl" : "ltr"}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            <Bell size={14} />
            {isAr ? "الكل" : "All"}
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px] ms-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1.5">
            <Settings2 size={14} />
            {isAr ? "التفضيلات" : "Preferences"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <NotificationCenter />
        </TabsContent>
        <TabsContent value="preferences" className="mt-4">
          <NotificationPreferences />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationCenterPage;
