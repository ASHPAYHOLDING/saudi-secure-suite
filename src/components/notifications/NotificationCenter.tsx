import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bell, Check, AlertTriangle, FileText, Package, CreditCard,
  Shield, ShieldAlert, CheckCheck, Loader2, Archive, Link2, Inbox,
  Search, ExternalLink, MailOpen, Mail, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format, isToday, isYesterday } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useNotifications, useMarkRead, useMarkUnread, useMarkAllRead,
  useArchiveNotification, useNotificationRealtime,
  type MergedNotification, type NotificationFilters,
} from "@/hooks/useNotifications";

const typeIcons: Record<string, any> = {
  invoice_due: FileText, invoice_overdue: FileText, invoices: FileText,
  low_stock: Package, inventory: Package,
  subscription: CreditCard, subscription_expiry: CreditCard,
  compliance_warning: Shield, hr: ShieldAlert, hr_doc_expiry: ShieldAlert,
  approvals: Check, wallet: CreditCard, integrations: Link2, platform: Bell,
};

const severityBorder: Record<string, string> = {
  info: "border-s-border",
  success: "border-s-primary",
  warning: "border-s-destructive/50",
  critical: "border-s-destructive",
};

const severityIcon: Record<string, string> = {
  info: "text-muted-foreground border-border",
  success: "text-primary border-primary/20",
  warning: "text-destructive/80 border-destructive/20",
  critical: "text-destructive border-destructive/30",
};

const NotificationCenter = () => {
  const { tenantId, user } = useAuth();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const locale = isAr ? ar : enUS;

  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useNotificationRealtime();

  const filters: NotificationFilters = useMemo(() => ({
    status: statusFilter,
    severity: severityFilter,
    query: searchQuery,
  }), [statusFilter, severityFilter, searchQuery]);

  const { notifications, total, isLoading, hasMore, loadMore } = useNotifications(filters);

  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  const markAllRead = useMarkAllRead();
  const archive = useArchiveNotification();

  // Group by day
  const grouped = useMemo(() => {
    const groups: { label: string; items: MergedNotification[] }[] = [];
    let currentLabel = "";
    for (const n of notifications) {
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
  }, [notifications, isAr, locale]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  const handleClick = useCallback((n: MergedNotification) => {
    if (!n.is_read) markRead.mutate({ id: n.id, source: n._source });
    if (n.link) navigate(n.link);
  }, [markRead, navigate]);

  const toggleRead = useCallback((e: React.MouseEvent, n: MergedNotification) => {
    e.stopPropagation();
    if (n.is_read) markUnread.mutate({ id: n.id, source: n._source });
    else markRead.mutate({ id: n.id, source: n._source });
  }, [markRead, markUnread]);

  return (
    <Card>
      <CardContent className="pt-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Status */}
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">{isAr ? "الكل" : "All"}</SelectItem>
              <SelectItem value="unread" className="text-xs">{isAr ? "غير مقروء" : "Unread"}</SelectItem>
              <SelectItem value="read" className="text-xs">{isAr ? "مقروء" : "Read"}</SelectItem>
            </SelectContent>
          </Select>

          {/* Severity */}
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">{isAr ? "كل الأولويات" : "All"}</SelectItem>
              <SelectItem value="info" className="text-xs">{isAr ? "معلومات" : "Info"}</SelectItem>
              <SelectItem value="success" className="text-xs">{isAr ? "نجاح" : "Success"}</SelectItem>
              <SelectItem value="warning" className="text-xs">{isAr ? "تحذير" : "Warning"}</SelectItem>
              <SelectItem value="critical" className="text-xs">{isAr ? "حرج" : "Critical"}</SelectItem>
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input
              placeholder={isAr ? "بحث في الإشعارات..." : "Search notifications..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-8 h-8 text-xs"
            />
          </div>

          {/* Mark all read */}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1 ms-auto"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck size={12} />
            {isAr ? "قراءة الكل" : "Mark all read"}
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
              <Inbox size={28} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {searchQuery || statusFilter !== "all" || severityFilter !== "all"
                ? (isAr ? "لا توجد نتائج" : "No results")
                : (isAr ? "لا توجد إشعارات" : "No notifications")}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              {searchQuery || statusFilter !== "all" || severityFilter !== "all"
                ? (isAr ? "جرّب تعديل الفلاتر أو البحث." : "Try adjusting filters or search.")
                : (isAr ? "ستظهر هنا الإشعارات المهمة مثل الفواتير المتأخرة والتنبيهات الأمنية." : "Important alerts like overdue invoices and security warnings will appear here.")}
            </p>
          </div>
        ) : (
          <>
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
                          className={`group flex gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-secondary/40 border-s-2 ${severityBorder[sev] || severityBorder.info} ${!n.is_read ? "bg-accent/[0.04]" : ""}`}
                          onClick={() => handleClick(n)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter") handleClick(n); }}
                        >
                          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card ${severityIcon[sev] || severityIcon.info}`}>
                            <Icon size={15} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                              {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <p className="text-[10px] text-muted-foreground/60">
                                {format(new Date(n.created_at), "hh:mm a", { locale })}
                              </p>
                              {n.link && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-[10px] gap-1"
                                  onClick={(e) => { e.stopPropagation(); navigate(n.link!); }}
                                >
                                  <ExternalLink size={9} />
                                  {isAr ? "فتح" : "Open"}
                                </Button>
                              )}
                            </div>
                          </div>
                          {/* Actions on hover */}
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={(e) => toggleRead(e, n)}
                              title={n.is_read ? (isAr ? "كغير مقروء" : "Mark unread") : (isAr ? "كمقروء" : "Mark read")}
                            >
                              {n.is_read ? <Mail size={13} /> : <MailOpen size={13} />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={(e) => { e.stopPropagation(); archive.mutate({ id: n.id, source: n._source }); }}
                              title={isAr ? "أرشفة" : "Archive"}
                            >
                              <Archive size={13} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Load more */}
            {hasMore && (
              <div className="border-t border-border p-3 text-center">
                <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={loadMore}>
                  <ChevronDown size={14} />
                  {isAr ? `تحميل المزيد (${total - notifications.length} متبقي)` : `Load more (${total - notifications.length} remaining)`}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationCenter;
