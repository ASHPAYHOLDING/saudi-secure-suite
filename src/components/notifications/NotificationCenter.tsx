import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, Check, AlertTriangle, FileText, Package, CreditCard,
  Shield, ShieldAlert, CheckCheck, Loader2, Archive, Link2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const typeIcons: Record<string, any> = {
  invoice_due: FileText,
  invoice_overdue: FileText,
  invoices: FileText,
  low_stock: Package,
  inventory: Package,
  subscription: CreditCard,
  subscription_expiry: CreditCard,
  compliance_warning: Shield,
  hr: ShieldAlert,
  hr_doc_expiry: ShieldAlert,
  approvals: Check,
  wallet: CreditCard,
  integrations: Link2,
  platform: Bell,
};

const severityStyles: Record<string, string> = {
  info: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  warning: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  critical: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
};

type FilterTab = "all" | "unread" | "critical";

const NotificationCenter = () => {
  const { tenantId, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [filter, setFilter] = useState<FilterTab>("all");

  const { data: tenantNotifs = [], isLoading: loadingTenant } = useQuery({
    queryKey: ["tenant_notifications_full", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("tenant_notifications")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []).map((n: any) => ({ ...n, _source: "tenant" as const }));
    },
    enabled: !!tenantId,
  });

  const { data: userNotifs = [], isLoading: loadingUser } = useQuery({
    queryKey: ["user_notifications_full", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []).map((n: any) => ({
        ...n,
        _source: "user" as const,
        severity: n.type === "hr" ? "warning" : "info",
        message: n.body,
      }));
    },
    enabled: !!user?.id,
  });

  const allNotifications = useMemo(() => {
    const merged = [...tenantNotifs, ...userNotifs].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    if (filter === "unread") return merged.filter((n: any) => !n.is_read);
    if (filter === "critical") return merged.filter((n: any) => n.severity === "critical");
    return merged;
  }, [tenantNotifs, userNotifs, filter]);

  const markReadMutation = useMutation({
    mutationFn: async ({ id, source }: { id: string; source: string }) => {
      const table = source === "user" ? "user_notifications" : "tenant_notifications";
      await supabase.from(table).update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant_notifications_full"] });
      queryClient.invalidateQueries({ queryKey: ["user_notifications_full"] });
      queryClient.invalidateQueries({ queryKey: ["tenant_notifications"] });
      queryClient.invalidateQueries({ queryKey: ["user_notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (tenantId) {
        await supabase.from("tenant_notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("is_read", false);
      }
      if (user?.id) {
        await supabase.from("user_notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("user_id", user.id).eq("is_read", false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant_notifications_full"] });
      queryClient.invalidateQueries({ queryKey: ["user_notifications_full"] });
      queryClient.invalidateQueries({ queryKey: ["tenant_notifications"] });
      queryClient.invalidateQueries({ queryKey: ["user_notifications"] });
    },
  });

  const unreadCount = allNotifications.filter((n: any) => !n.is_read).length;
  const loading = loadingTenant || loadingUser;

  const handleClick = (n: any) => {
    if (!n.is_read) markReadMutation.mutate({ id: n.id, source: n._source });
    if (n.link) navigate(n.link);
  };

  return (
    <Card>
      <CardContent className="pt-4">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)} dir={isAr ? "rtl" : "ltr"}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs h-7">
                {isAr ? "الكل" : "All"}
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs h-7">
                {isAr ? "غير مقروء" : "Unread"}
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="ms-1 h-4 px-1 text-[10px]">{unreadCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="critical" className="text-xs h-7">
                {isAr ? "حرج" : "Critical"}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => markAllReadMutation.mutate()}>
              <CheckCheck size={12} />
              {isAr ? "قراءة الكل" : "Mark all read"}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allNotifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell size={36} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {isAr ? "لا توجد إشعارات" : "No notifications"}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-1">
              {allNotifications.map((n: any) => {
                const Icon = typeIcons[n.type] || typeIcons[n.event_key?.split(".")?.[0] || ""] || Bell;
                const sev = n.severity || "info";
                return (
                  <div
                    key={`${n._source}-${n.id}`}
                    className={`flex gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer hover:bg-secondary/40 ${!n.is_read ? "bg-accent/5 border border-accent/10" : ""}`}
                    onClick={() => handleClick(n)}
                  >
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${severityStyles[sev] || severityStyles.info}`}>
                      <Icon size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                        {!n.is_read && <span className="h-2 w-2 rounded-full bg-accent shrink-0" />}
                        {sev === "critical" && (
                          <Badge variant="destructive" className="h-4 text-[10px] px-1">
                            {isAr ? "حرج" : "Critical"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message || n.body}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                          locale: isAr ? ar : enUS,
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationCenter;
