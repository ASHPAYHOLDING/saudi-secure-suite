/** Accounting Domain Service */
import { secureRpc } from "@/lib/secure-rpc";
import type { ServiceResult } from "./types";

export const AccountingService = {
  /** Post a draft journal entry (sets status='posted', emits domain event) */
  async postJournal(tenantId: string, journalId: string): Promise<ServiceResult> {
    const { error } = await secureRpc("accounting_post_journal", {
      p_tenant_id: tenantId,
      p_journal_id: journalId,
    });
    return { data: null, error: error?.message ?? null };
  },

  /** Close an accounting period */
  async closePeriod(tenantId: string, periodId: string, closedBy: string): Promise<ServiceResult> {
    const { error } = await secureRpc("accounting_close_period", {
      p_tenant_id: tenantId,
      p_period_id: periodId,
      p_closed_by: closedBy,
    });
    return { data: null, error: error?.message ?? null };
  },
};
