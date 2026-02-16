import { useEffect, useState, useMemo, useCallback } from "react";
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

/**
 * Fetches the current user's granular permissions from custom_roles + role_permissions.
 * Falls back to the old hasPermission system if no custom_roles are found.
 */
export const useGranularPermissions = (): GranularPermissions => {
  const { user, tenantId, userRole: role } = useAuth();
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!user || !tenantId || !role) {
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      setLoading(true);
      
      // Find the custom_role for this tenant that matches the user's base role
      const { data: customRole } = await supabase
        .from("custom_roles")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("base_role", role)
        .maybeSingle();

      if (!customRole) {
        setPermissionKeys([]);
        setLoading(false);
        return;
      }

      const { data: perms } = await supabase
        .from("role_permissions")
        .select("permission_key")
        .eq("role_id", customRole.id)
        .eq("tenant_id", tenantId);

      setPermissionKeys(perms?.map((p) => p.permission_key) ?? []);
      setLoading(false);
    };

    fetchPermissions();
  }, [user, tenantId, role, refreshCounter]);

  const permissions = useMemo(() => new Set(permissionKeys), [permissionKeys]);

  const can = useCallback(
    (permission: PermissionKey) => {
      // Owner always has all permissions as fallback
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

  const refresh = useCallback(() => setRefreshCounter((c) => c + 1), []);

  return { permissions, loading, can, canAny, canAll, refresh };
};
