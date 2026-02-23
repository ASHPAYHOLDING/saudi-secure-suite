import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, Check, AlertTriangle, FileText, Package, CreditCard,
  Shield, ShieldAlert, CheckCheck, Loader2, Archive, Link2, Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
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

// Minimal severity dot colors
const severityDot: Record<string, string> = {
  info: "bg-muted-foreground/40",
  warning: "bg-amber-500/70",
  critical: "bg-destructive/70",
};

const severityIcon: Record<string, string> = {
  info: "text-muted-foreground border-border",
  warning: "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  critical: "text-destructive border-destructive/20",
};

type FilterTab = "all" | "unread" | "critical";

interface MergedNotification {
  id: string;
  title: string;
  message: string;
  severity: string;
  type: string;
  event_key?: string | null;
  link?: string | null;
  is_read: boolean;
  created_at: string;
  archived_at?: string | null;
  _source: "tenant" | "user";
}

const NotificationCenter = () => {
  const { tenantId, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const locale = isAr ? ar : enUS;
  const [filter, setFilter] = useState<FilterTab>("all");

  const { data: tenantNotifs = [], isLoading: loadingTenant } = useQuery({
    queryKey: ["tenant_notifications_full", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("tenant_notifications")
        .select("*")
        .eq("tenant_id", tenantId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      return (data || []).map((n: any) => ({ ...n, _source: "tenant" as const } as MergedNotification));
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
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      return (data || []).map((n: any) => ({
        ...n,
        _source: "user" as const,
        severity: n.type === "hr" ? "warning" : "info",
        message: n.body,
      } as MergedNotification));
    },
    enabled: !!user?.id,
  });

  // Realtime
  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase
      .channel("notif-center-tenant")
      .on("postgres_changes", { event: "*", schema: "public", table: "tenant_notifications", filter: `tenant_id=eq.${tenantId}` },
        () => queryClient.invalidateQueries({ queryKey: ["tenant_notifications_full", tenantId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, queryClient]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel("notif-center-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["user_notifications_full", user.id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, queryClient]);

  const allNotifications = useMemo(() => {
    const merged = [...tenantNotifs, ...userNotifs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (filter === "unread") return merged.filter(n => !n.is_read);
    if (filter === "critical") return merged.filter(n => n.severity === "critical");
    return merged;
  }, [tenantNotifs, userNotifs, filter]);

  // Group by day
  const grouped = useMemo(() => {
    const groups: { label: string; items: MergedNotification[] }[] = [];
    let currentLabel = "";
    for (const n of allNotifications) {
      const d = new Date(n.created_at);
      let label: string;
      if (isToday(d)) label = isAr ? "اليوم" : "Today";
      else if (isYesterday(d)) label = isAr ? "أمس" : "Yesterday";
      else label = format(d, "EEEE, d MMM yyyy", { locale });

      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, items: [] });
      }
      groups[groups.length - 1].items.push(n);
    }
    return groups;
  }, [allNotifications, isAr, locale]);

  const totalUnread = useMemo(() => 
    [...tenantNotifs, ...userNotifs].filter(n => !n.is_read).length,
    [tenantNotifs, userNotifs]
  );

  // Optimistic mark read
  const markReadMutation = useMutation({
    mutationFn: async ({ id, source }: { id: string; source: string }) => {
      const table = source === "user" ? "user_notifications" : "tenant_notifications";
      await supabase.from(table).update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    },
    onMutate: async ({ id, source }) => {
      const key = source === "user"
        ? ["user_notifications_full", user?.id]
        : ["tenant_notifications_full", tenantId];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<MergedNotification[]>(key);
      queryClient.setQueryData<MergedNotification[]>(key, old =>
        (old || []).map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.key) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
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
    onMutate: async () => {
      const tKey = ["tenant_notifications_full", tenantId];
      const uKey = ["user_notifications_full", user?.id];
      const prevT = queryClient.getQueryData<MergedNotification[]>(tKey);
      const prevU = queryClient.getQueryData<MergedNotification[]>(uKey);
      queryClient.setQueryData<MergedNotification[]>(tKey, old =>
        (old || []).map(n => ({ ...n, is_read: true }))
      );
      queryClient.setQueryData<MergedNotification[]>(uKey, old =>
        (old || []).map(n => ({ ...n, is_read: true }))
      );
      return { prevT, prevU, tKey, uKey };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        queryClient.setQueryData(ctx.tKey, ctx.prevT);
        queryClient.setQueryData(ctx.uKey, ctx.prevU);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant_notifications"] });
      queryClient.invalidateQueries({ queryKey: ["user_notifications"] });
    },
  });

  // Archive
  const archiveMutation = useMutation({
    mutationFn: async ({ id, source }: { id: string; source: string }) => {
      const table = source === "user" ? "user_notifications" : "tenant_notifications";
      await supabase.from(table).update({ archived_at: new Date().toISOString() } as any).eq("id", id);
    },
    onMutate: async ({ id, source }) => {
      const key = source === "user"
        ? ["user_notifications_full", user?.id]
        : ["tenant_notifications_full", tenantId];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<MergedNotification[]>(key);
      queryClient.setQueryData<MergedNotification[]>(key, old =>
        (old || []).filter(n => n.id !== id)
      );
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.key) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant_notifications"] });
      queryClient.invalidateQueries({ queryKey: ["user_notifications"] });
    },
  });

  const handleClick = useCallback((n: MergedNotification) => {
    if (!n.is_read) markReadMutation.mutate({ id: n.id, source: n._source });
    if (n.link) navigate(n.link);
  }, [markReadMutation, navigate]);

  const loading = loadingTenant || loadingUser;

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
                {totalUnread > 0 && (
                  <Badge variant="secondary" className="ms-1 h-4 px-1 text-[10px]">{totalUnread}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="critical" className="text-xs h-7">
                {isAr ? "حرج" : "Critical"}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {totalUnread > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
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
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
              <Inbox size={28} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {filter === "all"
                ? (isAr ? "لا توجد إشعارات" : "No notifications")
                : filter === "unread"
                  ? (isAr ? "لا توجد إشعارات غير مقروءة" : "No unread notifications")
                  : (isAr ? "لا توجد إشعارات حرجة" : "No critical notifications")}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              {isAr
                ? "ستظهر هنا الإشعارات المهمة مثل الفواتير المتأخرة والتنبيهات الأمنية."
                : "Important alerts like overdue invoices and security warnings will appear here."}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-0">
              {grouped.map(group => (
                <div key={group.label}>
                  {/* Day header */}
                  <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm px-4 py-2 border-b border-border">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {group.label}
                    </span>
                  </div>
                  {group.items.map(n => {
                    const Icon = typeIcons[n.type] || typeIcons[n.event_key?.split(".")?.[0] || ""] || Bell;
                    const sev = n.severity || "info";
                    return (
                      <div
                        key={`${n._source}-${n.id}`}
                        className={`group flex gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-secondary/40 ${!n.is_read ? "bg-accent/[0.03]" : ""}`}
                        onClick={() => handleClick(n)}
                      >
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card ${severityIcon[sev] || severityIcon.info}`}>
                          <Icon size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                            {!n.is_read && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${severityDot[sev] || severityDot.info}`} />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {format(new Date(n.created_at), "hh:mm a", { locale })}
                          </p>
                        </div>
                        {/* Archive button on hover */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            archiveMutation.mutate({ id: n.id, source: n._source });
                          }}
                          title={isAr ? "أرشفة" : "Archive"}
                        >
                          <Archive size={13} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationCenter;
