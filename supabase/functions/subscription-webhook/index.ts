import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYLINK_BASE_URL = "https://restapi.paylink.sa";

async function paylinkAuth(): Promise<string> {
  const apiId = Deno.env.get("PAYLINK_API_ID");
  const secretKey = Deno.env.get("PAYLINK_SECRET_KEY");
  if (!apiId || !secretKey) throw new Error("Paylink credentials not configured");

  const res = await fetch(`${PAYLINK_BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiId, secretKey, persistToken: true }),
  });

  if (!res.ok) throw new Error(`Paylink auth failed: ${res.status}`);
  const data = await res.json();
  return data.id_token;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const supabaseRl = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const blocked = await checkRateLimit(req, supabaseRl, "webhook", corsHeaders);
    if (blocked) return blocked;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── ACTION: webhook (called by Paylink callback - NO AUTH required) ──
    if (action === "webhook" && req.method === "POST") {
      const body = await req.json();
      const { transactionNo, orderStatus } = body;

      console.log("Subscription webhook received:", { transactionNo, orderStatus });

      if (!transactionNo) {
        return jsonResponse({ error: "transactionNo is required" }, 400);
      }

      // Find the pending upgrade request by bank_reference (which stores transactionNo)
      const { data: upgradeReq } = await supabase
        .from("subscription_upgrade_requests")
        .select("*")
        .eq("bank_reference", transactionNo)
        .eq("payment_method", "paylink")
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();

      if (!upgradeReq) {
        console.log("No pending upgrade request found for transaction:", transactionNo);
        return jsonResponse({ success: true, message: "No matching request" });
      }

      // ── IDEMPOTENCY: Skip if already processed ──
      if (upgradeReq.status !== "pending") {
        console.log("Request already processed:", upgradeReq.id);
        return jsonResponse({ success: true, already_processed: true });
      }

      if (orderStatus === "Paid" || orderStatus === "paid") {
        // Server-side payment verification: double-check with Paylink API
        let verified = false;
        try {
          const paylinkToken = await paylinkAuth();
          const verifyRes = await fetch(
            `${PAYLINK_BASE_URL}/api/getInvoice/${transactionNo}`,
            { headers: { Authorization: `Bearer ${paylinkToken}` } }
          );

          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            verified = verifyData.orderStatus === "Paid" || verifyData.orderStatus === "paid";
            console.log("Paylink verification result:", verifyData.orderStatus, "verified:", verified);
          }
        } catch (verifyErr) {
          console.error("Paylink verification failed:", verifyErr);
          // Don't activate without verification
          return jsonResponse({ error: "Payment verification failed" }, 502);
        }

        if (!verified) {
          console.error("Payment not verified by Paylink API for transaction:", transactionNo);
          return jsonResponse({ error: "Payment not verified" }, 400);
        }

        // ── Activate subscription (server-side only) ──
        const { data: plan } = await supabase
          .from("subscription_plans")
          .select("*")
          .eq("id", upgradeReq.plan_id)
          .eq("is_active", true)
          .maybeSingle();

        if (!plan) {
          await supabase
            .from("subscription_upgrade_requests")
            .update({ status: "failed", notes: "الخطة غير موجودة أو غير متاحة" })
            .eq("id", upgradeReq.id);
          return jsonResponse({ error: "Plan not found" }, 400);
        }

        // Block enterprise direct purchase
        if (plan.slug === "enterprise") {
          await supabase
            .from("subscription_upgrade_requests")
            .update({ status: "failed", notes: "لا يمكن شراء باقة المؤسسي مباشرة" })
            .eq("id", upgradeReq.id);
          return jsonResponse({ error: "Enterprise cannot be purchased directly" }, 400);
        }

        // Get current subscription
        const { data: currentSub } = await supabase
          .from("subscriptions")
          .select("*, subscription_plans!inner(sort_order)")
          .eq("tenant_id", upgradeReq.tenant_id)
          .in("status", ["active", "trial", "past_due"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!currentSub) {
          await supabase
            .from("subscription_upgrade_requests")
            .update({ status: "failed", notes: "لا يوجد اشتراك فعال" })
            .eq("id", upgradeReq.id);
          return jsonResponse({ error: "No active subscription" }, 400);
        }

        // Update subscription
        const periodDays = upgradeReq.billing_cycle === "yearly" ? 365 : upgradeReq.billing_cycle === "quarterly" ? 90 : 30;
        const newEnd = new Date(Date.now() + periodDays * 86400000).toISOString();
        const isUpgrade = (currentSub.subscription_plans?.sort_order || 0) < plan.sort_order;

        const { error: subUpdateErr } = await supabase
          .from("subscriptions")
          .update({
            plan_id: plan.id,
            billing_cycle: upgradeReq.billing_cycle,
            current_period_start: new Date().toISOString(),
            current_period_end: newEnd,
            status: "active",
            grace_ends_at: null,
            cancel_at_period_end: false,
          })
          .eq("id", currentSub.id);

        if (subUpdateErr) {
          console.error("Subscription update error:", subUpdateErr);
          await supabase
            .from("subscription_upgrade_requests")
            .update({ status: "failed", notes: "فشل تحديث الاشتراك: " + subUpdateErr.message })
            .eq("id", upgradeReq.id);
          return jsonResponse({ error: "Failed to update subscription" }, 500);
        }

        // Consume discount code if present
        if (upgradeReq.discount_code) {
          await supabase.rpc("apply_subscription_discount", {
            _code: upgradeReq.discount_code,
            _tenant_id: upgradeReq.tenant_id,
            _plan_id: upgradeReq.plan_id,
          });
        }

        // Mark upgrade request as approved
        await supabase
          .from("subscription_upgrade_requests")
          .update({
            status: "approved",
            reviewed_at: new Date().toISOString(),
            notes: `تم التفعيل تلقائياً بعد تأكيد الدفع من Paylink - Transaction: ${transactionNo}`,
          })
          .eq("id", upgradeReq.id);

        // Log
        await supabase.from("subscription_logs").insert({
          subscription_id: currentSub.id,
          tenant_id: upgradeReq.tenant_id,
          action: isUpgrade ? "upgrade" : "downgrade",
          old_plan_id: currentSub.plan_id,
          new_plan_id: plan.id,
          old_status: currentSub.status,
          new_status: "active",
          performed_by: upgradeReq.requested_by,
          notes: `${isUpgrade ? "ترقية" : "تخفيض"} إلى ${plan.name_ar} - دفع بالبطاقة عبر Paylink (${transactionNo})`,
        });

        // Audit
        await supabase.from("audit_logs").insert({
          tenant_id: upgradeReq.tenant_id,
          user_id: upgradeReq.requested_by,
          action: "subscription_payment_paylink",
          entity_type: "subscription",
          entity_id: currentSub.id,
          entity_label: plan.name_ar,
          changes: {
            plan_id: plan.id,
            amount_paid: upgradeReq.amount,
            billing_cycle: upgradeReq.billing_cycle,
            paylink_transaction: transactionNo,
            payment_verified: true,
          },
        });

        console.log("Subscription activated successfully for tenant:", upgradeReq.tenant_id);
        return jsonResponse({ success: true, activated: true });

      } else if (orderStatus === "Canceled" || orderStatus === "canceled" || orderStatus === "Declined") {
        // Mark as failed
        await supabase
          .from("subscription_upgrade_requests")
          .update({
            status: "failed",
            notes: `تم رفض/إلغاء الدفع من Paylink - الحالة: ${orderStatus}`,
          })
          .eq("id", upgradeReq.id);

        return jsonResponse({ success: true, cancelled: true });
      }

      return jsonResponse({ success: true });
    }

    // ─── ACTION: verify-payment (called by frontend after redirect) ──
    if (action === "verify-payment") {
      // Requires auth
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
      if (authErr || !user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const requestId = url.searchParams.get("request_id");
      if (!requestId) {
        return jsonResponse({ error: "request_id is required" }, 400);
      }

      const { data: upgradeReq } = await supabase
        .from("subscription_upgrade_requests")
        .select("*")
        .eq("id", requestId)
        .eq("requested_by", user.id)
        .maybeSingle();

      if (!upgradeReq) {
        return jsonResponse({ error: "Request not found" }, 404);
      }

      return jsonResponse({
        status: upgradeReq.status,
        plan_id: upgradeReq.plan_id,
        amount: upgradeReq.amount,
      });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error("Subscription webhook error:", err);
    return jsonResponse({ error: err.message || "Internal error" }, 500);
  }
});
