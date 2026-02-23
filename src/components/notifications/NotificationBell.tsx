import { useState, useEffect, useRef } from "react";
import { Bell, Check, AlertTriangle, FileText, Package, CreditCard, Shield, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const typeIcons: Record<string, any> = {
  invoice_due: FileText,
  invoice_overdue: FileText,
  low_stock: Package,
  subscription_expiry: CreditCard,
  compliance_warning: Shield,
  hr_doc_expiry: ShieldAlert,
};

const severityColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-700 border-blue-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const NotificationBell = () => {
  const { tenantId, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Tenant-level notifications
  const { data: tenantNotifs = [] } = useQuery({
    queryKey: ["tenant_notifications", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tenant_notifications")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []).map((n: any) => ({ ...n, _source: "tenant" as const }));
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  // User-level notifications (HR doc alerts, etc.)
  const { data: userNotifs = [] } = useQuery({
    queryKey: ["user_notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []).map((n: any) => ({
        ...n,
        _source: "user" as const,
        severity: "warning",
        message: n.body,
      }));
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Merge and sort by created_at
  const notifications = [...tenantNotifs, ...userNotifs].sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 50);

  // Realtime for tenant_notifications
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("tenant-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tenant_notifications", filter: `tenant_id=eq.${tenantId}` },
        () => queryClient.invalidateQueries({ queryKey: ["tenant_notifications", tenantId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, queryClient]);

  // Realtime for user_notifications
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("user-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["user_notifications", user.id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const markReadMutation = useMutation({
    mutationFn: async ({ id, source }: { id: string; source: string }) => {
      const table = source === "user" ? "user_notifications" : "tenant_notifications";
      await supabase.from(table).update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => {
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
      queryClient.invalidateQueries({ queryKey: ["tenant_notifications"] });
      queryClient.invalidateQueries({ queryKey: ["user_notifications"] });
    },
  });

  const handleNotifClick = (n: any) => {
    if (!n.is_read) markReadMutation.mutate({ id: n.id, source: n._source });
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => setOpen(!open)}>
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute inset-inline-start-0 top-full mt-2 w-96 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="text-sm font-bold text-foreground">الإشعارات</h3>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => markAllReadMutation.mutate()}>
                  <Check size={12} /> قراءة الكل
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X size={14} />
              </Button>
            </div>
          </div>

          {/* List */}
          <ScrollArea className="max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell size={28} className="mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">لا توجد إشعارات</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((n: any) => {
                  const Icon = typeIcons[n.type] || AlertTriangle;
                  return (
                    <div
                      key={`${n._source}-${n.id}`}
                      className={`flex gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-secondary/30 ${!n.is_read ? "bg-accent/5" : ""}`}
                      onClick={() => handleNotifClick(n)}
                    >
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${severityColors[n.severity] || severityColors.info}`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                          {!n.is_read && <span className="h-2 w-2 rounded-full bg-accent shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ar })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
