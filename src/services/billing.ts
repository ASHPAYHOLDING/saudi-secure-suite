/** Billing Domain Service */
import { secureRpc } from "@/lib/secure-rpc";
import type { ServiceResult } from "./types";

export interface CreateInvoiceInput {
  customer_id: string;
  invoice_number: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  currency_code?: string;
  created_by: string;
  branch_id?: string;
  status?: string;
}

export const BillingService = {
  /** Create an invoice via the billing domain (emits domain event) */
  async createInvoice(tenantId: string, input: CreateInvoiceInput): Promise<ServiceResult<string>> {
    const { data, error } = await secureRpc("billing_create_invoice", {
      p_tenant_id: tenantId,
      p_invoice_data: input,
    });
    return { data: data as string | null, error: error?.message ?? null };
  },
};
