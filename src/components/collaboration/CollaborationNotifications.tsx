import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, MessageSquare, AtSign, Reply, Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";

interface CollabNotification {
  id: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  actor_id: string;
  actor_name?: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  mention_comment: AtSign,
  mention_chat: AtSign,
  reply_comment: Reply,
  reply_chat: Reply,
  new_message: MessageSquare,
};

const CollaborationNotifications = () => {
  const { user, tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [notifications, setNotifications] = useState<CollabNotification[]>([]);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!user || !tenantId) return;

    const fetch = async () => {
      const { data: notifs } = await supabase
        .from("collaboration_notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!notifs) return;

      // Get actor names
      const actorIds = [...new Set(notifs.map((n: any) => n.actor_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);

      const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      setNotifications(
        notifs.map((n: any) => ({
          ...n,
          actor_name: nameMap.get(n.actor_id) ?? "Unknown",
        }))
      );
    };
    fetch();

    // Realtime
    const channel = supabase
      .channel(`collab-notifs-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "collaboration_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetch()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, tenantId]);

  const markAsRead = async (id: string) => {
    await supabase
      .from("collaboration_notifications")
      .update({ is_read: true })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("collaboration_notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      mention_comment: { ar: "أشار إليك في تعليق", en: "mentioned you in a comment" },
      mention_chat: { ar: "أشار إليك في محادثة", en: "mentioned you in chat" },
      reply_comment: { ar: "رد على تعليقك", en: "replied to your comment" },
      reply_chat: { ar: "رد على رسالتك", en: "replied to your message" },
    };
    return labels[type]?.[isRTL ? "ar" : "en"] ?? type;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <MessageSquare className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0"
        align={isRTL ? "start" : "end"}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">
              {isRTL ? "إشعارات التعاون" : "Collaboration"}
            </span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3 me-1" />
              {isRTL ? "قراءة الكل" : "Read all"}
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {isRTL ? "لا توجد إشعارات" : "No notifications"}
            </p>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? MessageSquare;
                return (
                  <button
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={`w-full text-start px-4 py-3 hover:bg-muted/50 transition-colors ${
                      !n.is_read ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 rounded-full p-1.5 ${!n.is_read ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <strong>{n.actor_name}</strong>{" "}
                          <span className="text-muted-foreground">{getTypeLabel(n.type)}</span>
                        </p>
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(n.created_at), "MMM d, HH:mm")}
                        </p>
                      </div>
                      {!n.is_read && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default CollaborationNotifications;
