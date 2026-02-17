import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Check if a paid integration is active for the current tenant.
 * Returns { active, loading }.
 * Data is never deleted — only the `status` flag controls access.
 */
export const usePaidIntegration = (integrationKey: string) => {
  const { tenantId } = useAuth();
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const check = async () => {
      const { data } = await supabase
        .from("tenant_paid_integrations")
        .select("status, paid_integrations!inner(key)")
        .eq("tenant_id", tenantId)
        .eq("paid_integrations.key", integrationKey)
        .eq("status", "active")
        .maybeSingle();

      setActive(!!data);
      setLoading(false);
    };

    check();
  }, [tenantId, integrationKey]);

  return { active, loading };
};
