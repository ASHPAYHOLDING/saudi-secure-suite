import { useState, useEffect, useRef } from "react";
import { Bell, Check, AlertTriangle, FileText, Package, CreditCard, Shield, X, ShieldAlert, Link2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBellNotifications, useMarkRead, useMarkAllRead, useNotificationRealtime } from "@/hooks/useNotifications";

const typeIcons: Record<string, any> = {
  invoice_due: FileText, invoice_overdue: FileText, invoices: FileText,
  low_stock: Package, inventory: Package,
  subscription: CreditCard, subscription_expiry: CreditCard,
  compliance_warning: Shield, hr: ShieldAlert, hr_doc_expiry: ShieldAlert,
  approvals: Check, wallet: CreditCard, integrations: Link2, platform: Bell,
};

const severityStyles: Record<string, string> = {
  info: "text-muted-foreground border-border",
  success: "text-primary border-primary/20",
  warning: "text-destructive/80 border-destructive/20",
  critical: "text-destructive border-destructive/30",
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const locale = isAr ? ar : enUS;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useNotificationRealtime();

  const { notifications, unreadCount } = useBellNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNotifClick = (n: any) => {
    if (!n.is_read) markRead.mutate({ id: n.id, source: n._source });
    if (n.link) { setOpen(false); navigate(n.link); }
  };

  const badgeText = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(!open)}
        aria-label={isAr ? "الإشعارات" : "Notifications"}
      >
        <Bell size={18} />
        {badgeText && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
            {badgeText}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute inset-inline-end-0 top-full mt-2 w-96 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="text-sm font-bold text-foreground">
              {isAr ? "الإشعارات" : "Notifications"}
            </h3>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => markAllRead.mutate()}>
                  <Check size={12} /> {isAr ? "قراءة الكل" : "Read all"}
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
                <p className="text-sm text-muted-foreground">
                  {isAr ? "لا توجد إشعارات" : "No notifications"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((n: any) => {
                  const Icon = typeIcons[n.type] || typeIcons[n.event_key?.split(".")?.[0] || ""] || AlertTriangle;
                  const sev = n.severity || "info";
                  return (
                    <div
                      key={`${n._source}-${n.id}`}
                      className={`flex gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-secondary/30 ${!n.is_read ? "bg-accent/[0.04]" : ""}`}
                      onClick={() => handleNotifClick(n)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter") handleNotifClick(n); }}
                    >
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-card ${severityStyles[sev] || severityStyles.info}`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                          {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-muted-foreground/60">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale })}
                          </p>
                          {n.link && <ExternalLink size={9} className="text-muted-foreground/40" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-border p-2 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 w-full text-muted-foreground"
                onClick={() => { setOpen(false); navigate("/dashboard/notifications"); }}
              >
                {isAr ? "عرض جميع الإشعارات" : "View all notifications"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
