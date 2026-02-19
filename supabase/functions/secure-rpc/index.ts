import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Whitelist of functions allowed through this proxy
const ALLOWED_FUNCTIONS: Record<string, boolean> = {
  // Inventory
  process_inventory_movement: true,
  record_stock_movement: true,
  generate_inventory_number: true,
  reserve_stock_for_order: true,
  release_stock_reservation: true,
  // Budget
  activate_budget: true,
  sync_budget_actuals_for_tenant: true,
  // Subscription
  apply_subscription_discount: true,
  check_subscription_integrity: true,
  auto_activate_enterprise_integrations: true,
  // Financial
  create_document_access_token: true,
  revoke_document_token: true,
  encrypt_zatca_private_key: true,
  // Affiliate
  request_affiliate_payout: true,
  process_affiliate_payout: true,
  // Admin Wallet
  admin_review_topup_request: true,
  admin_set_wallet_status: true,
  // Reconciliation
  reconcile_invoices_vs_payments: true,
  reconcile_invoices_without_journals: true,
  reconcile_subscription_revenue: true,
  reconcile_unbalanced_journals: true,
  reconcile_vat_totals: true,
  reconcile_wallet_vs_journal: true,
};

// Financial RPCs get stricter rate limits (10/min)
const FINANCIAL_RPCS = new Set([
  "apply_subscription_discount",
  "request_affiliate_payout",
  "process_affiliate_payout",
  "admin_review_topup_request",
  "admin_set_wallet_status",
  "create_document_access_token",
  "revoke_document_token",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // 2. Parse request
    const { fn, params } = await req.json();

    if (!fn || typeof fn !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing function name (fn)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Validate function is whitelisted
    if (!ALLOWED_FUNCTIONS[fn]) {
      return new Response(
        JSON.stringify({ error: `Function '${fn}' is not allowed` }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Rate limiting — financial RPCs use stricter "wallet" limit
    const serviceClient = createClient(supabaseUrl, serviceKey);
    const rlCategory = FINANCIAL_RPCS.has(fn) ? "wallet" : "general";
    const blocked = await checkRateLimit(req, serviceClient, rlCategory, corsHeaders, userId);
    if (blocked) return blocked;

    // 5. Execute with service_role
    // The functions have their own internal guards (assert_tenant_member etc.)
    // Since we validated the JWT above, we trust the caller identity.
    const { data, error } = await serviceClient.rpc(fn, params || {});

    if (error) {
      console.error(`[secure-rpc] ${fn} error:`, error);
      return new Response(
        JSON.stringify({ error: error.message, code: error.code }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[secure-rpc] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
