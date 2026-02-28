import { useState, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Mail, MessageSquare, FileText, Map, Loader2 } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

// Lazy-load heavy sub-tabs
const InAppPreferencesTab = lazy(() => import("@/components/notifications/tabs/InAppPreferencesTab"));
const EmailSettingsTab = lazy(() => import("@/components/notifications/tabs/EmailSettingsTab"));
const WhatsAppSettingsTab = lazy(() => import("@/components/notifications/tabs/WhatsAppSettingsTab"));
const EmailTemplatesTab = lazy(() => import("@/components/notifications/tabs/EmailTemplatesTab"));
const NotificationMappingTab = lazy(() => import("@/components/notifications/tabs/NotificationMappingTab"));

const TabFallback = () => (
  <div className="flex justify-center py-16">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const NotificationSettingsPage = () => {
  const { currentLang } = useLanguage();
  const isAr = currentLang === "ar";
  const [activeTab, setActiveTab] = useState("in_app");

  const tabs = [
    { value: "in_app", label: isAr ? "داخل التطبيق" : "In-App", icon: Bell },
    { value: "email", label: isAr ? "البريد الإلكتروني" : "Email", icon: Mail },
    { value: "whatsapp", label: isAr ? "واتساب" : "WhatsApp", icon: MessageSquare },
    { value: "templates", label: isAr ? "القوالب" : "Templates", icon: FileText },
    { value: "mapping", label: isAr ? "خريطة الإشعارات" : "Mapping", icon: Map },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Bell size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isAr ? "إعدادات الإشعارات" : "Notification Settings"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "إدارة القنوات والتفضيلات والقوالب وخريطة الإشعارات من مكان واحد."
              : "Manage channels, preferences, templates, and notification mapping in one place."}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir={isAr ? "rtl" : "ltr"}>
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 min-h-[44px] text-sm">
              <tab.icon size={14} />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="in_app" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <InAppPreferencesTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <EmailSettingsTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <WhatsAppSettingsTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <EmailTemplatesTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="mapping" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <NotificationMappingTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationSettingsPage;
