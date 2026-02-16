import { useState, useEffect, useRef } from "react";
import { Bell, Check, AlertTriangle, FileText, Package, CreditCard, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const typeIcons: Record<string, any> = {
  invoice_due: FileText,
  invoice_overdue: FileText,
  low_stock: Package,
  subscription_expiry: CreditCard,
  compliance_warning: Shield,
};

const severityColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-700 border-blue-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const NotificationBell = () => {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
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

  const { data: notifications = [] } = useQuery({
    queryKey: ["tenant_notifications", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tenant_notifications")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // poll every 30s
  });

  // Realtime subscription
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

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("tenant_notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant_notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      await supabase.from("tenant_notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("is_read", false);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant_notifications"] }),
  });

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => setOpen(!open)}>
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-96 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden" dir="rtl">
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
                      key={n.id}
                      className={`flex gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-secondary/30 ${!n.is_read ? "bg-accent/5" : ""}`}
                      onClick={() => { if (!n.is_read) markReadMutation.mutate(n.id); }}
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
