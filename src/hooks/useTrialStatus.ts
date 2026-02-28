import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TrialInfo {
  trialStatus: "none" | "active" | "converted" | "expired";
  trialEndsAt: Date | null;
  daysRemaining: number;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  loading: boolean;
}

export function useTrialStatus(): TrialInfo {
  const { tenantId } = useAuth();
  const [info, setInfo] = useState<TrialInfo>({
    trialStatus: "none",
    trialEndsAt: null,
    daysRemaining: 0,
    isTrialActive: false,
    isTrialExpired: false,
    loading: true,
  });

  const fetch = useCallback(async () => {
    if (!tenantId) {
      setInfo((p) => ({ ...p, loading: false }));
      return;
    }

    const { data } = await supabase
      .from("tenants")
      .select("trial_status, trial_ends_at")
      .eq("id", tenantId)
      .single();

    if (!data) {
      setInfo((p) => ({ ...p, loading: false }));
      return;
    }

    const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
    const now = new Date();
    const daysRemaining = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000))
      : 0;

    const trialStatus = (data.trial_status || "none") as TrialInfo["trialStatus"];
    const isTrialActive = trialStatus === "active" && daysRemaining > 0;
    const isTrialExpired = trialStatus === "expired" || (trialStatus === "active" && daysRemaining <= 0);

    setInfo({
      trialStatus,
      trialEndsAt,
      daysRemaining,
      isTrialActive,
      isTrialExpired,
      loading: false,
    });
  }, [tenantId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return info;
}
