import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";

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

export function useOnboardingState() {
  const { user, tenantId } = useAuth();
  const qc = useQueryClient();

  const { data: state, isLoading } = useQuery({
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
  // needsOnboarding: true if state exists and is incomplete
  const needsOnboarding = !isLoading && !!state && !isCompleted && !requiredDone;

  /** Call once after signup to create initial onboarding state row */
  const initOnboarding = useCallback(async () => {
    if (state || !user || !tenantId) return;
    await upsertMutation.mutateAsync({
      current_step: 1,
      completed_steps: [],
      step_data: {},
    });
  }, [state, user, tenantId, upsertMutation]);

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
