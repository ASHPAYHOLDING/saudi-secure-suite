/**
 * Entitlement enforcement helper for Edge Functions.
 * Call this at the top of any feature-specific edge function to return 403
 * if the tenant's plan doesn't include the required feature.
 *
 * Usage in edge function:
 *   import { enforceEntitlement } from "../_shared/entitlement-check.ts";
 *   const denied = await enforceEntitlement(supabaseAdmin, tenantId, "contracts", corsHeaders);
 *   if (denied) return denied; // 403 response already built
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function enforceEntitlement(
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
  featureKey: string,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  const { data, error } = await supabaseAdmin.rpc("check_entitlement", {
    _tenant_id: tenantId,
    _feature_key: featureKey,
  });

  if (error) {
    console.error("Entitlement check error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to verify entitlement", code: "ENTITLEMENT_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const result = data as { allowed: boolean; reason: string; plan?: string };

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: "هذه الميزة غير متاحة في باقتك الحالية",
        code: "FEATURE_NOT_ENTITLED",
        feature: featureKey,
        reason: result.reason,
        plan: result.plan || null,
        upgrade_url: "/dashboard/subscription",
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return null; // Allowed — proceed
}
