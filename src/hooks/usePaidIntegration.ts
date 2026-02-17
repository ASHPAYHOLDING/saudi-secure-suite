import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Check if a paid integration is active for the current tenant.
 * Active means:
 *   1. Tenant has explicitly activated it (tenant_paid_integrations.status = 'active'), OR
 *   2. The tenant's subscription plan includes it for free (included_in_plans contains plan slug)
 *
 * Data is never deleted — only the status flag controls access.
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
      // Check 1: Explicit activation
      const { data: explicit } = await supabase
        .from("tenant_paid_integrations")
        .select("status, paid_integrations!inner(key)")
        .eq("tenant_id", tenantId)
        .eq("paid_integrations.key", integrationKey)
        .eq("status", "active")
        .maybeSingle();

      if (explicit) {
        setActive(true);
        setLoading(false);
        return;
      }

      // Check 2: Included in subscription plan
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_id, status, subscription_plans!inner(slug)")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "trial"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub) {
        const planSlug = (sub as any).subscription_plans?.slug;
        if (planSlug) {
          const { data: integration } = await supabase
            .from("paid_integrations")
            .select("included_in_plans")
            .eq("key", integrationKey)
            .maybeSingle();

          const includedPlans: string[] = (integration as any)?.included_in_plans || [];
          if (includedPlans.includes(planSlug)) {
            setActive(true);
            setLoading(false);
            return;
          }
        }
      }

      setActive(false);
      setLoading(false);
    };

    check();
  }, [tenantId, integrationKey]);

  return { active, loading };
};
