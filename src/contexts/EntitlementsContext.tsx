import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { type EntitlementResult } from "@/lib/entitlement-types";

interface EntitlementsContextValue {
  entitlements: Record<string, EntitlementResult>;
  loading: boolean;
  isTrial: boolean;
  planSlug: string | null;
  /** Force refetch (e.g. after plan change) */
  invalidate: () => void;
}

const EntitlementsContext = createContext<EntitlementsContextValue>({
  entitlements: {},
  loading: true,
  isTrial: false,
  planSlug: null,
  invalidate: () => {},
});

export const useEntitlementsContext = () => useContext(EntitlementsContext);

const CACHE_KEY = "entitlements";
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export const EntitlementsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [CACHE_KEY, tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_entitlements_cached", {
        p_tenant_id: tenantId!,
      });

      if (error || !data) {
        console.error("Entitlements cache read failed:", error);
        return null;
      }

      return data as unknown as Record<string, EntitlementResult>;
    },
    enabled: !!tenantId,
    staleTime: STALE_TIME,
    gcTime: STALE_TIME * 2,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  const entitlements = data ?? {};
  const firstKey = Object.keys(entitlements)[0];
  const isTrial = firstKey ? entitlements[firstKey]?.reason === "trial" : false;
  const planSlug = firstKey ? entitlements[firstKey]?.plan ?? null : null;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [CACHE_KEY] });
  }, [queryClient]);

  return (
    <EntitlementsContext.Provider
      value={{
        entitlements,
        loading: isLoading,
        isTrial,
        planSlug,
        invalidate,
      }}
    >
      {children}
    </EntitlementsContext.Provider>
  );
};
