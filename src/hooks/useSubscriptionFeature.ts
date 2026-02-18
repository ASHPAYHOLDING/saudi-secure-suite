/**
 * @deprecated Use `useEntitlements` or `useFeatureGate` from `@/hooks/useEntitlements` instead.
 * This file is kept for backward compatibility and now delegates to the unified entitlements system.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureGate, type FeatureKey } from "@/hooks/useEntitlements";

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
 * @deprecated Use useEntitlements hook instead for feature gating.
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

      // Get enabled entitlements from plan_entitlements (single source of truth)
      const { data: entitlements } = await supabase
        .from("plan_entitlements")
        .select("feature_key")
        .eq("plan_id", sub.plan_id)
        .eq("is_enabled", true);

      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("slug, name_ar")
        .eq("id", sub.plan_id)
        .single();

      const features = entitlements?.map((e) => e.feature_key) ?? [];

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
 * @deprecated Use useFeatureGate from useEntitlements instead.
 */
export const useHasFeature = (featureKey: string): { allowed: boolean; loading: boolean } => {
  return useFeatureGate(featureKey as FeatureKey);
};
