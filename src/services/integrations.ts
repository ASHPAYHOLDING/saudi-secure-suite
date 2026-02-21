/** Integrations Domain Service */
import { secureRpc } from "@/lib/secure-rpc";
import type { ServiceResult } from "./types";

export const IntegrationsService = {
  /** Log an integration event (emits domain event) */
  async logEvent(
    tenantId: string,
    provider: string,
    eventType: string,
    payload: Record<string, unknown> = {},
  ): Promise<ServiceResult<string>> {
    const { data, error } = await secureRpc("integrations_log_event", {
      p_tenant_id: tenantId,
      p_provider: provider,
      p_event_type: eventType,
      p_payload: payload,
    });
    return { data: data as string | null, error: error?.message ?? null };
  },
};
