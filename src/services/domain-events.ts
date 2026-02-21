/** Domain Events service — cross-domain communication hub */
import { secureRpc } from "@/lib/secure-rpc";
import type { DomainEvent, DomainName, ServiceResult } from "./types";

export const DomainEventsService = {
  /** Publish a domain event */
  async publish(
    tenantId: string,
    domain: DomainName,
    eventType: string,
    payload: Record<string, unknown> = {},
    sourceEntityId?: string,
    sourceEntityType?: string,
  ): Promise<ServiceResult<string>> {
    const { data, error } = await secureRpc("publish_domain_event", {
      p_tenant_id: tenantId,
      p_domain: domain,
      p_event_type: eventType,
      p_payload: payload,
      p_source_entity_id: sourceEntityId ?? null,
      p_source_entity_type: sourceEntityType ?? null,
    });
    return { data: data as string | null, error: error?.message ?? null };
  },

  /** Query recent domain events */
  async list(
    tenantId: string,
    domain?: DomainName,
    limit = 100,
  ): Promise<ServiceResult<DomainEvent[]>> {
    const { data, error } = await secureRpc("get_domain_events", {
      p_tenant_id: tenantId,
      p_domain: domain ?? null,
      p_limit: limit,
    });
    return { data: (data as DomainEvent[]) ?? [], error: error?.message ?? null };
  },
};
