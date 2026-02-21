/** Governance Domain Service */
import { secureRpc } from "@/lib/secure-rpc";
import type { ServiceResult } from "./types";

export interface LogViolationInput {
  policy_type: string;
  violation_type: string;
  severity?: string;
  entity_type?: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  user_id: string;
}

export const GovernanceService = {
  /** Log a policy violation (emits domain event) */
  async logViolation(tenantId: string, input: LogViolationInput): Promise<ServiceResult<string>> {
    const { data, error } = await secureRpc("governance_log_violation", {
      p_tenant_id: tenantId,
      p_violation_data: input,
    });
    return { data: data as string | null, error: error?.message ?? null };
  },
};
