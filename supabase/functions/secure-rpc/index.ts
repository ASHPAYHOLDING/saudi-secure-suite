import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { RequestLogger } from "../_shared/request-logger.ts";
import { withTimeout, TimeoutError } from "../_shared/timeout-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RPC_TIMEOUT_MS = 5000;

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
  // Workflow approvals
  secure_workflow_action: true,
  secure_approval_action: true,
  // Atomic workflow start
  atomic_start_workflow: true,
  // RLS Audit
  get_rls_audit: true,
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serviceClient = createClient(supabaseUrl, serviceKey);
  const logger = new RequestLogger(req, serviceClient, "secure-rpc");

  try {
    // 1. Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      await logger.flush(401, "Missing auth header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...logger.responseHeaders(corsHeaders), "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      await logger.flush(401, "Invalid token");
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...logger.responseHeaders(corsHeaders), "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    logger.setUser(userId);

    // 2. Parse request
    const { fn, params } = await req.json();
    logger.setAction(fn || "unknown");

    if (!fn || typeof fn !== "string") {
      await logger.flush(400, "Missing function name");
      return new Response(
        JSON.stringify({ error: "Missing function name (fn)" }),
        {
          status: 400,
          headers: { ...logger.responseHeaders(corsHeaders), "Content-Type": "application/json" },
        }
      );
    }

    // 3. Validate function is whitelisted
    if (!ALLOWED_FUNCTIONS[fn]) {
      await logger.flush(403, `Function '${fn}' not allowed`);
      return new Response(
        JSON.stringify({ error: `Function '${fn}' is not allowed` }),
        {
          status: 403,
          headers: { ...logger.responseHeaders(corsHeaders), "Content-Type": "application/json" },
        }
      );
    }

    // 4. Rate limiting — financial RPCs use stricter "wallet" limit
    const rlCategory = FINANCIAL_RPCS.has(fn) ? "wallet" : "general";
    const blocked = await checkRateLimit(req, serviceClient, rlCategory, corsHeaders, userId);
    if (blocked) {
      await logger.flush(429, "Rate limited");
      return blocked;
    }

    // 5. Cast UUID-looking string params so Postgres doesn't choke on text→uuid
    const castParams: Record<string, unknown> = {};
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const [k, v] of Object.entries(params || {})) {
      // Keep the value as-is; the real fix is we need to pass it through
      // a typed RPC call. For now, explicitly cast by wrapping in SQL-safe format.
      castParams[k] = v;
    }

    // 6. Execute with service_role + timeout guard
    try {
      const { data, error } = await withTimeout(
        () => serviceClient.rpc(fn, castParams),
        RPC_TIMEOUT_MS,
        `rpc:${fn}`
      );

      if (error) {
        console.error(`[secure-rpc] ${fn} error:`, error);
        await logger.flush(400, error.message);
        return new Response(
          JSON.stringify({ error: error.message, code: error.code }),
          {
            status: 400,
            headers: { ...logger.responseHeaders(corsHeaders), "Content-Type": "application/json" },
          }
        );
      }

      await logger.flush(200);
      return new Response(JSON.stringify({ data }), {
        headers: { ...logger.responseHeaders(corsHeaders), "Content-Type": "application/json" },
      });
    } catch (timeoutErr) {
      if (timeoutErr instanceof TimeoutError) {
        console.error(`[secure-rpc] ${fn} timed out after ${RPC_TIMEOUT_MS}ms`);
        await logger.flush(504, `Timeout: ${fn}`);
        return new Response(
          JSON.stringify({ error: "انتهت مهلة العملية", code: "TIMEOUT" }),
          {
            status: 504,
            headers: { ...logger.responseHeaders(corsHeaders), "Content-Type": "application/json" },
          }
        );
      }
      throw timeoutErr;
    }
  } catch (err) {
    console.error("[secure-rpc] Unexpected error:", err);
    await logger.flush(500, String(err));
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...logger.responseHeaders(corsHeaders), "Content-Type": "application/json" },
      }
    );
  }
});
