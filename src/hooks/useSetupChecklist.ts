import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingState } from "./useOnboardingState";

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
  optional?: boolean;
}

export function useSetupChecklist() {
  const { user, tenantId } = useAuth();
  const qc = useQueryClient();
  const { state: onboarding, isCompleted: onboardingDone, isLoading: onbLoading } = useOnboardingState();

  // Fetch real counts
  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["setup-checklist-counts", tenantId],
    queryFn: async () => {
      const [customers, invoices, members] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!),
      ]);
      return {
        customers: customers.count ?? 0,
        invoices: invoices.count ?? 0,
        members: members.count ?? 0,
      };
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  // Dismissal state
  const { data: dismissal, isLoading: dismissLoading } = useQuery({
    queryKey: ["checklist-dismissal", tenantId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("onboarding_checklist_dismissals")
        .select("dismissed_until")
        .eq("tenant_id", tenantId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!tenantId,
    staleTime: 60_000,
  });

  const snoozeMutation = useMutation({
    mutationFn: async () => {
      const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("onboarding_checklist_dismissals")
        .upsert(
          { user_id: user!.id, tenant_id: tenantId!, dismissed_until: until },
          { onConflict: "user_id,tenant_id" }
        );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-dismissal", tenantId, user?.id] }),
  });

  const companyDone = !!(onboarding?.completed_steps as number[] | null)?.includes(1);
  const hasCust = (counts?.customers ?? 0) > 0;
  const hasInv = (counts?.invoices ?? 0) > 0;
  const hasTeam = (counts?.members ?? 0) > 1; // >1 means at least one invited
  const paymentDone = !!(onboarding?.completed_steps as number[] | null)?.includes(5);

  const items: ChecklistItem[] = [
    { key: "company", label: "أكمل بيانات الشركة", done: companyDone, href: "/dashboard/company" },
    { key: "customer", label: "أضف أول عميل", done: hasCust, href: "/dashboard/customers" },
    { key: "invoice", label: "أنشئ أول فاتورة", done: hasInv, href: "/dashboard/billing" },
    { key: "team", label: "دعوة عضو فريق", done: hasTeam, href: "/dashboard/team" },
    { key: "payment", label: "تفعيل بوابة الدفع", done: paymentDone, href: "/dashboard/integrations", optional: true },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;
  const isDismissed = dismissal?.dismissed_until ? new Date(dismissal.dismissed_until) > new Date() : false;
  const isLoading = onbLoading || countsLoading || dismissLoading;

  // Show if onboarding state exists, not all done, and not snoozed
  const visible = !isLoading && !allDone && !isDismissed && !!onboarding;

  return {
    items,
    doneCount,
    total: items.length,
    allDone,
    visible,
    isLoading,
    snooze: () => snoozeMutation.mutateAsync(),
    snoozing: snoozeMutation.isPending,
  };
}
