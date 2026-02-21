/** CRM Domain Service */
import { secureRpc } from "@/lib/secure-rpc";
import type { ServiceResult } from "./types";

export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  tax_number?: string;
  address?: string;
  customer_type?: string;
  created_by: string;
}

export const CrmService = {
  /** Create a customer via the CRM domain (emits domain event) */
  async createCustomer(tenantId: string, input: CreateCustomerInput): Promise<ServiceResult<string>> {
    const { data, error } = await secureRpc("crm_create_customer", {
      p_tenant_id: tenantId,
      p_customer_data: input,
    });
    return { data: data as string | null, error: error?.message ?? null };
  },
};
