import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface MergedNotification {
  id: string;
  title: string;
  message: string;
  severity: string;
  type: string;
  event_key?: string | null;
  link?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  archived_at?: string | null;
  metadata?: Record<string, any> | null;
  _source: "tenant" | "user";
}

const PAGE_SIZE = 50;

// ── Core fetch (merges tenant + user notifications) ──
function useMergedNotifications(limit = 200) {
  const { tenantId, user } = useAuth();

  const { data: tenantNotifs = [], isLoading: lt } = useQuery({
    queryKey: ["tenant_notifications_full", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("tenant_notifications")
        .select("*")
        .eq("tenant_id", tenantId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data || []).map((n: any) => ({ ...n, _source: "tenant" as const } as MergedNotification));
    },
    enabled: !!tenantId,
  });

  const { data: userNotifs = [], isLoading: lu } = useQuery({
    queryKey: ["user_notifications_full", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data || []).map((n: any) => ({
        ...n,
        _source: "user" as const,
        severity: n.type === "hr" ? "warning" : "info",
        message: n.body,
      } as MergedNotification));
    },
    enabled: !!user?.id,
  });

  return { tenantNotifs, userNotifs, isLoading: lt || lu };
}

// ── Realtime subscriptions ──
export function useNotificationRealtime() {
  const { tenantId, user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase
      .channel("notif-rt-tenant")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tenant_notifications", filter: `tenant_id=eq.${tenantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tenant_notifications", tenantId] });
          queryClient.invalidateQueries({ queryKey: ["tenant_notifications_full", tenantId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, queryClient]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel("notif-rt-user")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["user_notifications", user.id] });
          queryClient.invalidateQueries({ queryKey: ["user_notifications_full", user.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, queryClient]);
}

// ── Filtered notifications with pagination ──
export interface NotificationFilters {
  status?: "all" | "unread" | "read";
  severity?: string;
  query?: string;
  limit?: number;
}

export function useNotifications(filters: NotificationFilters = {}) {
  const { tenantNotifs, userNotifs, isLoading } = useMergedNotifications(filters.limit || 200);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const all = useMemo(() => {
    let merged = [...tenantNotifs, ...userNotifs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    if (filters.status === "unread") merged = merged.filter(n => !n.is_read);
    if (filters.status === "read") merged = merged.filter(n => n.is_read);
    if (filters.severity && filters.severity !== "all") merged = merged.filter(n => n.severity === filters.severity);
    if (filters.query) {
      const q = filters.query.toLowerCase();
      merged = merged.filter(n =>
        n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
      );
    }
    return merged;
  }, [tenantNotifs, userNotifs, filters.status, filters.severity, filters.query]);

  const visible = useMemo(() => all.slice(0, visibleCount), [all, visibleCount]);
  const hasMore = visibleCount < all.length;
  const loadMore = useCallback(() => setVisibleCount(c => c + PAGE_SIZE), []);

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filters.status, filters.severity, filters.query]);

  return { notifications: visible, total: all.length, isLoading, hasMore, loadMore };
}

// ── Unread count ──
export function useUnreadCount() {
  const { tenantNotifs, userNotifs } = useMergedNotifications(200);
  return useMemo(() => {
    return [...tenantNotifs, ...userNotifs].filter(n => !n.is_read).length;
  }, [tenantNotifs, userNotifs]);
}

// ── Bell notifications (top 8) ──
export function useBellNotifications() {
  const { tenantNotifs, userNotifs, isLoading } = useMergedNotifications(30);

  const notifications = useMemo(() => {
    return [...tenantNotifs, ...userNotifs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
  }, [tenantNotifs, userNotifs]);

  const unreadCount = useMemo(() =>
    [...tenantNotifs, ...userNotifs].filter(n => !n.is_read).length,
    [tenantNotifs, userNotifs]
  );

  return { notifications, unreadCount, isLoading };
}

// ── Mark read ──
export function useMarkRead() {
  const { user, tenantId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, source }: { id: string; source: "tenant" | "user" }) => {
      const table = source === "user" ? "user_notifications" : "tenant_notifications";
      const { error } = await supabase.from(table).update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, source }) => {
      const key = source === "user"
        ? ["user_notifications_full", user?.id]
        : ["tenant_notifications_full", tenantId];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<MergedNotification[]>(key);
      queryClient.setQueryData<MergedNotification[]>(key, old =>
        (old || []).map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.key) queryClient.setQueryData(ctx.key, ctx.prev);
      toast({ title: "خطأ", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant_notifications"] });
      queryClient.invalidateQueries({ queryKey: ["user_notifications"] });
    },
  });
}

// ── Mark unread ──
export function useMarkUnread() {
  const { user, tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, source }: { id: string; source: "tenant" | "user" }) => {
      const table = source === "user" ? "user_notifications" : "tenant_notifications";
      const { error } = await supabase.from(table).update({ is_read: false, read_at: null }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, source }) => {
      const key = source === "user"
        ? ["user_notifications_full", user?.id]
        : ["tenant_notifications_full", tenantId];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<MergedNotification[]>(key);
      queryClient.setQueryData<MergedNotification[]>(key, old =>
        (old || []).map(n => n.id === id ? { ...n, is_read: false, read_at: null } : n)
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
}

// ── Mark all read ──
export function useMarkAllRead() {
  const { user, tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      if (tenantId) {
        await supabase.from("tenant_notifications").update({ is_read: true, read_at: now }).eq("tenant_id", tenantId).eq("is_read", false);
      }
      if (user?.id) {
        await supabase.from("user_notifications").update({ is_read: true, read_at: now }).eq("user_id", user.id).eq("is_read", false);
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
}

// ── Archive ──
export function useArchiveNotification() {
  const { user, tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, source }: { id: string; source: "tenant" | "user" }) => {
      const table = source === "user" ? "user_notifications" : "tenant_notifications";
      const { error } = await supabase.from(table).update({ archived_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
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
}
