/** Shared types for domain service layer */

export type DomainName = 'accounting' | 'billing' | 'inventory' | 'crm' | 'hr' | 'governance' | 'integrations';

export interface DomainEvent {
  id: string;
  tenant_id: string;
  domain: DomainName;
  event_type: string;
  payload: Record<string, unknown>;
  source_entity_id?: string;
  source_entity_type?: string;
  correlation_id?: string;
  processed: boolean;
  processed_at?: string;
  created_at: string;
}

export interface ServiceResult<T = void> {
  data: T | null;
  error: string | null;
}
