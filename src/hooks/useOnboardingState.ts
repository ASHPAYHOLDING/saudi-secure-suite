import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback, useEffect, useRef } from "react";

export interface OnboardingState {
  id: string;
  tenant_id: string;
  user_id: string;
  current_step: number;
  completed_steps: number[];
  step_data: Record<string, any>;
  completed_at: string | null;
}

const ONBOARDING_KEY = "onboarding-state";
const REQUIRED_STEPS = [1, 2, 4]; // company + finance + first customer
const TOTAL_STEPS = 5;

/** Roles that must go through onboarding wizard */
const ONBOARDING_ROLES = new Set(["owner", "admin"]);

export function useOnboardingState() {
  const { user, tenantId, userRole } = useAuth();
  const qc = useQueryClient();
  const initAttempted = useRef(false);

  const { data: state, isLoading, isError } = useQuery({
    queryKey: [ONBOARDING_KEY, tenantId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_state")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as OnboardingState | null;
    },
    enabled: !!user && !!tenantId,
    staleTime: 60_000,
    retry: 2,
  });

  const upsertMutation = useMutation({
    mutationFn: async (updates: Partial<Pick<OnboardingState, "current_step" | "completed_steps" | "step_data" | "completed_at">>) => {
      const { data, error } = await supabase
        .from("onboarding_state")
        .upsert(
          {
            tenant_id: tenantId!,
            user_id: user!.id,
            ...updates,
          },
          { onConflict: "tenant_id,user_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ONBOARDING_KEY, tenantId, user?.id] });
    },
  });

  const completeStep = useCallback(
    async (step: number, stepData?: Record<string, any>) => {
      const current = state?.completed_steps ?? [];
      const newCompleted = Array.from(new Set([...current, step])).sort();
      const newStepData = { ...(state?.step_data ?? {}), ...stepData };
      const allDone = newCompleted.length >= TOTAL_STEPS;

      await upsertMutation.mutateAsync({
        current_step: allDone ? TOTAL_STEPS : Math.min(step + 1, TOTAL_STEPS),
        completed_steps: newCompleted,
        step_data: newStepData,
        completed_at: allDone ? new Date().toISOString() : null,
      });
    },
    [state, upsertMutation]
  );

  const skipStep = useCallback(
    async (step: number) => {
      const current = state?.completed_steps ?? [];
      const newCompleted = Array.from(new Set([...current, step])).sort();
      const allDone = newCompleted.length >= TOTAL_STEPS;

      await upsertMutation.mutateAsync({
        current_step: allDone ? TOTAL_STEPS : Math.min(step + 1, TOTAL_STEPS),
        completed_steps: newCompleted,
        completed_at: allDone ? new Date().toISOString() : null,
      });
    },
    [state, upsertMutation]
  );

  const isCompleted = !!state?.completed_at;
  const requiredDone = REQUIRED_STEPS.every((s) => state?.completed_steps?.includes(s));

  /** Should this role go through onboarding? */
  const isOnboardingRole = !!userRole && ONBOARDING_ROLES.has(userRole);

  /**
   * needsOnboarding logic:
   * - member/manager/hr/accountant → never needs onboarding (skip wizard)
   * - owner/admin with no state row → needs onboarding
   * - owner/admin with state but incomplete required steps → needs onboarding
   * - query error (safeguard) → treat as needs onboarding for owner/admin
   */
  const needsOnboarding =
    !isLoading &&
    isOnboardingRole &&
    (
      isError ||           // DB error → safeguard: block access
      !state ||            // no row = new user → needs onboarding
      (!isCompleted && !requiredDone) // row exists but incomplete
    );

  /** Create initial onboarding state row (upsert = no duplicates) */
  const initOnboarding = useCallback(async () => {
    if (!user || !tenantId) return;
    await upsertMutation.mutateAsync({
      current_step: 1,
      completed_steps: [],
      step_data: {},
    });
  }, [user, tenantId, upsertMutation]);

  /**
   * Auto-init: if auth is ready, state is null (not loading, no error),
   * and user is owner/admin → auto-create the onboarding row.
   * Uses a ref to prevent double-init.
   */
  useEffect(() => {
    if (
      !isLoading &&
      !isError &&
      state === null &&
      isOnboardingRole &&
      user &&
      tenantId &&
      !initAttempted.current &&
      !upsertMutation.isPending
    ) {
      initAttempted.current = true;
      initOnboarding().catch((err) => {
        console.error("[Onboarding] auto-init failed:", err);
      });
    }
  }, [isLoading, isError, state, isOnboardingRole, user, tenantId, initOnboarding, upsertMutation.isPending]);

  // Reset the init flag when user/tenant changes
  useEffect(() => {
    initAttempted.current = false;
  }, [user?.id, tenantId]);

  return {
    state,
    isLoading,
    isCompleted,
    requiredDone,
    needsOnboarding,
    completeStep,
    skipStep,
    initOnboarding,
    saving: upsertMutation.isPending,
    TOTAL_STEPS,
    REQUIRED_STEPS,
  };
}
