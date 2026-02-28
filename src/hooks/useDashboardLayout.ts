/**
 * useDashboardLayout — persists user's widget layout to DB.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultLayout, type LayoutItem } from "@/components/dashboard-builder/widget-registry";
import { useCallback, useRef } from "react";

export function useDashboardLayout() {
  const { user, tenantId } = useAuth();
  const qc = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const queryKey = ["dashboard-layout", user?.id, tenantId];

  const { data: layout, isLoading } = useQuery({
    queryKey,
    enabled: !!user?.id && !!tenantId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("user_dashboard_layouts")
        .select("layout")
        .eq("user_id", user!.id)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      return (data?.layout as LayoutItem[]) || null;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newLayout: LayoutItem[]) => {
      if (!user?.id || !tenantId) return;
      const { error } = await (supabase as any)
        .from("user_dashboard_layouts")
        .upsert(
          { user_id: user.id, tenant_id: tenantId, layout: newLayout },
          { onConflict: "user_id,tenant_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const saveLayout = useCallback(
    (newLayout: LayoutItem[]) => {
      // Debounce saves to avoid spamming on drag
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveMutation.mutate(newLayout);
      }, 800);
    },
    [saveMutation]
  );

  const resetLayout = useCallback(() => {
    const defaultLayout = getDefaultLayout();
    saveMutation.mutate(defaultLayout);
  }, [saveMutation]);

  return {
    layout: layout ?? getDefaultLayout(),
    isLoading,
    saveLayout,
    resetLayout,
    saving: saveMutation.isPending,
  };
}
