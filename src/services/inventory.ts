/** Inventory Domain Service */
import { secureRpc } from "@/lib/secure-rpc";
import type { ServiceResult } from "./types";

export const InventoryService = {
  /** Adjust stock quantity for a product (emits domain event) */
  async adjustStock(
    tenantId: string,
    productId: string,
    quantityChange: number,
    reason = "manual_adjustment",
    adjustedBy?: string,
  ): Promise<ServiceResult> {
    const { error } = await secureRpc("inventory_adjust_stock", {
      p_tenant_id: tenantId,
      p_product_id: productId,
      p_quantity_change: quantityChange,
      p_reason: reason,
      p_adjusted_by: adjustedBy ?? null,
    });
    return { data: null, error: error?.message ?? null };
  },
};
