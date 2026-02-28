import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";

export interface Favorite {
  id: string;
  type: string;
  ref_id: string | null;
  label: string;
  path: string;
  icon_name: string | null;
  sort_order: number;
}

const QUERY_KEY = "user_favorites";

export const useFavorites = () => {
  const { user, tenantId } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: [QUERY_KEY, tenantId, userId],
    queryFn: async (): Promise<Favorite[]> => {
      if (!userId || !tenantId) return [];
      const { data, error } = await supabase
        .from("user_favorites" as any)
        .select("id, type, ref_id, label, path, icon_name, sort_order")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true });
      if (error) {
        console.error("[favorites]", error.message);
        return [];
      }
      return (data as any[]) ?? [];
    },
    enabled: !!userId && !!tenantId,
    staleTime: 60_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [QUERY_KEY, tenantId, userId] });

  const addFavorite = useMutation({
    mutationFn: async (fav: { label: string; path: string; type?: string; ref_id?: string; icon_name?: string }) => {
      if (!userId || !tenantId) throw new Error("Not authenticated");
      const maxOrder = favorites.length > 0 ? Math.max(...favorites.map((f) => f.sort_order)) + 1 : 0;
      const { error } = await supabase.from("user_favorites" as any).insert({
        user_id: userId,
        tenant_id: tenantId,
        type: fav.type || "page",
        ref_id: fav.ref_id || null,
        label: fav.label,
        path: fav.path,
        icon_name: fav.icon_name || null,
        sort_order: maxOrder,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeFavorite = useMutation({
    mutationFn: async (path: string) => {
      if (!userId || !tenantId) return;
      const { error } = await supabase
        .from("user_favorites" as any)
        .delete()
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .eq("path", path);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reorderFavorites = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, i) =>
        supabase.from("user_favorites" as any).update({ sort_order: i } as any).eq("id", id)
      );
      await Promise.all(updates);
    },
    onSuccess: invalidate,
  });

  const isFavorite = useCallback(
    (path: string) => favorites.some((f) => f.path === path),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (fav: { label: string; path: string; type?: string; ref_id?: string; icon_name?: string }) => {
      if (isFavorite(fav.path)) {
        removeFavorite.mutate(fav.path);
      } else {
        addFavorite.mutate(fav);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  return {
    favorites,
    isLoading,
    addFavorite: addFavorite.mutate,
    removeFavorite: removeFavorite.mutate,
    reorderFavorites: reorderFavorites.mutate,
    isFavorite,
    toggleFavorite,
  };
};
