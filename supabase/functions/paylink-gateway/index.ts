import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { withRequestTimeout } from "../_shared/timeout-guard.ts";
import { verifyWebhookSignature, checkIdempotency, markWebhookCompleted, logWebhookAudit } from "../_shared/webhook-verify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYLINK_BASE_URL = "https://restapi.paylink.sa";

// ─── helpers ────────────────────────────────────────────────────────
async function paylinkAuth(): Promise<string> {
  const apiId = Deno.env.get("PAYLINK_API_ID");
  const secretKey = Deno.env.get("PAYLINK_SECRET_KEY");
  if (!apiId || !secretKey) throw new Error("Paylink credentials not configured");

  const res = await fetch(`${PAYLINK_BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiId, secretKey, persistToken: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paylink auth failed: ${res.status} – ${text}`);
  }

  const data = await res.json();
  return data.id_token;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── main handler ───────────────────────────────────────────────────
Deno.serve(withRequestTimeout(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const rlAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const blocked = await checkRateLimit(req, rlAdmin, "paylink", corsHeaders);
    if (blocked) return blocked;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ─── ACTION: callback (webhook) — no user auth required ─────
    if (action === "callback" && req.method === "POST") {
      return await handleCallback(req);
    }

    // Authenticate the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // Get user's tenant
    const { data: memberData } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!memberData) {
      return jsonResponse({ error: "No tenant found" }, 403);
    }
    const tenantId = memberData.tenant_id;

    // ─── ACTION: create-invoice ─────────────────────────────────
    if (action === "create-invoice" && req.method === "POST") {
      const body = await req.json();
      const {
        amount,
        clientName,
        clientMobile,
        clientEmail,
        orderNumber,
        callBackUrl,
        note,
        products,
      } = body;

      if (!amount || !clientName || !clientMobile || !orderNumber) {
        return jsonResponse({ error: "Missing required fields: amount, clientName, clientMobile, orderNumber" }, 400);
      }

      const paylinkToken = await paylinkAuth();

      const paylinkProducts = products && products.length > 0
        ? products.map((p: any) => ({
            title: p.title || p.description || "منتج",
            price: p.price || p.unit_price || 0,
            qty: p.qty || p.quantity || 1,
            description: p.description || "",
            isDigital: false,
            imageSrc: null,
            specificVat: null,
            productCost: null,
          }))
        : [{ title: "دفعة", price: amount, qty: 1 }];

      const invoiceRes = await fetch(`${PAYLINK_BASE_URL}/api/addInvoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${paylinkToken}`,
        },
        body: JSON.stringify({
          amount,
          callBackUrl: callBackUrl || "",
          clientEmail: clientEmail || "",
          clientMobile,
          clientName,
          currency: "SAR",
          note: note || "",
          orderNumber,
          products: paylinkProducts,
        }),
      });

      if (!invoiceRes.ok) {
        const errText = await invoiceRes.text();
        console.error("Paylink addInvoice error:", errText);
        return jsonResponse({ error: "Failed to create Paylink invoice", details: errText }, 502);
      }

      const invoiceData = await invoiceRes.json();

      const txNum = `PL-${invoiceData.transactionNo || Date.now()}`;
      const { data: txData, error: txError } = await supabase
        .from("paylink_transactions")
        .insert({
          tenant_id: tenantId,
          transaction_number: txNum,
          transaction_type: "deposit",
          description: `فاتورة دفع: ${clientName} – ${orderNumber}`,
          gross_amount: amount,
          fee_amount: 0,
          net_amount: amount,
          status: "pending",
          payment_method: "paylink",
          created_by: userId,
          paylink_transaction_no: invoiceData.transactionNo || null,
        })
        .select()
        .single();

      if (txError) {
        console.error("DB insert error:", txError);
      }

      return jsonResponse({
        success: true,
        transactionNo: invoiceData.transactionNo,
        paymentUrl: invoiceData.url,
        checkUrl: invoiceData.checkUrl,
        qrUrl: invoiceData.qrUrl,
        mobileUrl: invoiceData.mobileUrl,
        localTransaction: txData,
      });
    }

    // ─── ACTION: check-status ───────────────────────────────────
    if (action === "check-status") {
      const transactionNo = url.searchParams.get("transactionNo");
      if (!transactionNo) {
        return jsonResponse({ error: "transactionNo is required" }, 400);
      }

      const paylinkToken = await paylinkAuth();

      const statusRes = await fetch(
        `${PAYLINK_BASE_URL}/api/getInvoice/${transactionNo}`,
        {
          headers: { Authorization: `Bearer ${paylinkToken}` },
        }
      );

      if (!statusRes.ok) {
        const errText = await statusRes.text();
        return jsonResponse({ error: "Failed to check status", details: errText }, 502);
      }

      const statusData = await statusRes.json();

      if (statusData.orderStatus === "Paid" || statusData.orderStatus === "paid") {
        await supabase
          .from("paylink_transactions")
          .update({ status: "completed", payment_method: statusData.paymentMethod || "paylink" })
          .eq("tenant_id", tenantId)
          .eq("paylink_transaction_no", transactionNo);
      } else if (statusData.orderStatus === "Canceled" || statusData.orderStatus === "canceled") {
        await supabase
          .from("paylink_transactions")
          .update({ status: "failed" })
          .eq("tenant_id", tenantId)
          .eq("paylink_transaction_no", transactionNo);
      }

      return jsonResponse({
        orderStatus: statusData.orderStatus,
        paymentMethod: statusData.paymentMethod,
        amount: statusData.amount,
        transactionNo: statusData.transactionNo,
        orderNumber: statusData.orderNumber,
      });
    }

    // ─── ACTION: cancel-invoice ─────────────────────────────────
    if (action === "cancel-invoice" && req.method === "POST") {
      const body = await req.json();
      const { transactionNo } = body;
      if (!transactionNo) {
        return jsonResponse({ error: "transactionNo is required" }, 400);
      }

      const paylinkToken = await paylinkAuth();

      const cancelRes = await fetch(
        `${PAYLINK_BASE_URL}/api/cancelInvoice`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${paylinkToken}`,
          },
          body: JSON.stringify({ transactionNo }),
        }
      );

      const cancelData = await cancelRes.json();

      await supabase
        .from("paylink_transactions")
        .update({ status: "failed" })
        .eq("tenant_id", tenantId)
        .eq("paylink_transaction_no", transactionNo);

      return jsonResponse({ success: true, ...cancelData });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("paylink-gateway error:", err);
    return jsonResponse({ error: err.message || "Internal error" }, 500);
  }
}, 30000, corsHeaders));

// ─── SECURED CALLBACK HANDLER ──────────────────────────────────────
async function handleCallback(req: Request) {
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const bodyText = await req.text();
  let body: any;
  try {
    body = JSON.parse(bodyText);
  } catch {
    await logWebhookAudit(serviceClient, null, "webhook_rejected", {
      provider: "paylink",
      reason: "Invalid JSON body",
    });
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  // 1. Signature verification
  const webhookSecret = Deno.env.get("WEBHOOK_SIGNING_SECRET");
  if (webhookSecret) {
    const { valid, reason } = await verifyWebhookSignature(req, bodyText, webhookSecret);
    if (!valid) {
      await logWebhookAudit(serviceClient, null, "webhook_signature_failed", {
        provider: "paylink",
        reason,
        transaction_no: body.transactionNo,
      });
      return jsonResponse({ error: "Invalid signature" }, 403);
    }
  }

  const { transactionNo, orderStatus } = body;
  if (!transactionNo) {
    return jsonResponse({ error: "Missing transactionNo" }, 400);
  }

  // 2. Idempotency check
  const eventId = `paylink-${transactionNo}-${orderStatus || "unknown"}`;
  const { duplicate, existingStatus } = await checkIdempotency(
    serviceClient,
    "paylink",
    eventId,
    null,
    { transactionNo, orderStatus }
  );

  if (duplicate) {
    await logWebhookAudit(serviceClient, null, "webhook_duplicate", {
      provider: "paylink",
      event_id: eventId,
      existing_status: existingStatus,
    });
    return jsonResponse({ success: true, note: "Already processed" });
  }

  // 3. Process the callback
  let processStatus = "completed";
  try {
    // Find tenant from transaction
    const { data: txData } = await serviceClient
      .from("paylink_transactions")
      .select("tenant_id")
      .eq("paylink_transaction_no", transactionNo)
      .maybeSingle();

    if (orderStatus === "Paid" || orderStatus === "paid") {
      await serviceClient
        .from("paylink_transactions")
        .update({ status: "completed" })
        .eq("paylink_transaction_no", transactionNo);
    } else if (orderStatus === "Canceled" || orderStatus === "canceled") {
      await serviceClient
        .from("paylink_transactions")
        .update({ status: "failed" })
        .eq("paylink_transaction_no", transactionNo);
      processStatus = "failed";
    }

    // 4. Audit log
    await logWebhookAudit(serviceClient, txData?.tenant_id || null, "webhook_processed", {
      provider: "paylink",
      event_id: eventId,
      transaction_no: transactionNo,
      order_status: orderStatus,
      result: processStatus,
    });
  } catch (err: any) {
    processStatus = "error";
    console.error("Paylink callback processing error:", err);
  }

  // 5. Mark webhook event completed
  await markWebhookCompleted(serviceClient, "paylink", eventId, processStatus, {
    transactionNo,
    orderStatus,
  });

  return jsonResponse({ success: true });
}
