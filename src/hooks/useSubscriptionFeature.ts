import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SubscriptionInfo {
  planSlug: string | null;
  planNameAr: string | null;
  status: string | null;
  billingCycle: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  features: string[];
  loading: boolean;
}

/**
 * Hook to get subscription info and check feature access for the current tenant.
 * Feature keys come from the `features` jsonb array on subscription_plans.
 */
export const useSubscriptionInfo = (): SubscriptionInfo => {
  const { tenantId } = useAuth();
  const [info, setInfo] = useState<SubscriptionInfo>({
    planSlug: null,
    planNameAr: null,
    status: null,
    billingCycle: null,
    currentPeriodEnd: null,
    graceEndsAt: null,
    features: [],
    loading: true,
  });

  useEffect(() => {
    if (!tenantId) {
      setInfo((prev) => ({ ...prev, loading: false }));
      return;
    }

    const fetch = async () => {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, billing_cycle, current_period_end, grace_ends_at, plan_id")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub) {
        setInfo((prev) => ({ ...prev, loading: false }));
        return;
      }

      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("slug, name_ar, features")
        .eq("id", sub.plan_id)
        .single();

      const features = Array.isArray(plan?.features) ? (plan.features as string[]) : [];

      setInfo({
        planSlug: plan?.slug ?? null,
        planNameAr: plan?.name_ar ?? null,
        status: sub.status,
        billingCycle: sub.billing_cycle,
        currentPeriodEnd: sub.current_period_end,
        graceEndsAt: sub.grace_ends_at,
        features,
        loading: false,
      });
    };

    fetch();
  }, [tenantId]);

  return info;
};

/**
 * Check if a specific feature key is available in the current subscription plan.
 */
export const useHasFeature = (featureKey: string): { allowed: boolean; loading: boolean } => {
  const { features, loading, status } = useSubscriptionInfo();
  const isActive = status === "active" || status === "trial" || status === "past_due";
  return { allowed: isActive && features.includes(featureKey), loading };
};
