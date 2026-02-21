import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PermissionKey = string;

interface GranularPermissions {
  permissions: Set<PermissionKey>;
  loading: boolean;
  can: (permission: PermissionKey) => boolean;
  canAny: (...permissions: PermissionKey[]) => boolean;
  canAll: (...permissions: PermissionKey[]) => boolean;
  refresh: () => void;
}

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches the current user's granular permissions via a single RPC call.
 * Uses React Query with cache key ["perms", tenantId, userId].
 * Returns a Set<string> for O(1) lookups.
 */
export const useGranularPermissions = (): GranularPermissions => {
  const { user, tenantId, userRole: role } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data: permissionKeys = [], isLoading } = useQuery({
    queryKey: ["perms", tenantId, userId],
    queryFn: async (): Promise<string[]> => {
      if (!userId || !tenantId) return [];
      const { data, error } = await supabase.rpc("get_my_permissions" as any, {
        p_user_id: userId,
        p_tenant_id: tenantId,
      });
      if (error) {
        console.error("[permissions] RPC error:", error.message);
        return [];
      }
      return (data as string[]) ?? [];
    },
    enabled: !!userId && !!tenantId && !!role,
    staleTime: STALE_TIME,
    gcTime: STALE_TIME * 3,
  });

  const permissions = useMemo(() => new Set(permissionKeys), [permissionKeys]);

  const can = useCallback(
    (permission: PermissionKey) => {
      if (role === "owner") return true;
      return permissions.has(permission);
    },
    [permissions, role]
  );

  const canAny = useCallback(
    (...perms: PermissionKey[]) => perms.some((p) => can(p)),
    [can]
  );

  const canAll = useCallback(
    (...perms: PermissionKey[]) => perms.every((p) => can(p)),
    [can]
  );

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["perms", tenantId, userId] }),
    [queryClient, tenantId, userId]
  );

  return { permissions, loading: isLoading, can, canAny, canAll, refresh };
};
