import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { verifyWebhookSignature, checkIdempotency, markWebhookCompleted, logWebhookAudit } from "../_shared/webhook-verify.ts";
import { withRequestTimeout } from "../_shared/timeout-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WALLET_TIMEOUT_MS = 8000;

Deno.serve(withRequestTimeout(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Rate limiting
    const rlAdmin = createClient(supabaseUrl, serviceKey);
    const blocked = await checkRateLimit(req, rlAdmin, "wallet", corsHeaders);
    if (blocked) return blocked;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Paylink callback doesn't require user auth — secured via signature
    if (action === "paylink-callback") {
      return await handlePaylinkCallback(req, supabaseUrl, serviceKey);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Authenticate
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "Invalid token" }, 401);

    // Get tenant
    const { data: member } = await supabase
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!member) return json({ error: "No tenant found" }, 403);

    const tenantId = member.tenant_id;

    if (action === "get-balance") {
      return await handleGetBalance(supabase, tenantId);
    }

    if (action === "purchase-integration" && req.method === "POST") {
      return await handlePurchaseIntegration(req, supabase, user.id, tenantId);
    }

    if (action === "topup" && req.method === "POST") {
      return await handleTopup(req, supabase, user.id, tenantId);
    }

    if (action === "bank-transfer-topup" && req.method === "POST") {
      return await handleBankTransferTopup(req, supabase, user.id, tenantId);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err: any) {
    console.error("wallet-purchase error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
}, WALLET_TIMEOUT_MS, corsHeaders));

// ===================== GET BALANCE =====================
async function handleGetBalance(supabase: any, tenantId: string) {
  const { data: wallet } = await supabase
    .from("tenant_wallets")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("currency", "SAR")
    .maybeSingle();

  if (!wallet) {
    return json({ balance_available: 0, balance_pending: 0, status: "active", exists: false });
  }

  return json({
    balance_available: wallet.balance_available,
    balance_pending: wallet.balance_pending,
    status: wallet.status,
    exists: true,
  });
}

// ===================== PURCHASE INTEGRATION =====================
async function handlePurchaseIntegration(
  req: Request,
  supabase: any,
  userId: string,
  tenantId: string
) {
  const body = await req.json();
  const { integrationId } = body;

  if (!integrationId) {
    return json({ error: "integrationId is required" }, 400);
  }

  const { data: integration, error: intErr } = await supabase
    .from("paid_integrations")
    .select("id, key, name_ar, name_en, price_once, requires_api_keys, is_ready, is_listed")
    .eq("id", integrationId)
    .single();

  if (intErr || !integration) {
    return json({ error: "Integration not found" }, 404);
  }

  if (!integration.is_ready || !integration.is_listed) {
    return json({ error: "Integration is not available" }, 400);
  }

  const { data: existing } = await supabase
    .from("tenant_paid_integrations")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (existing?.status === "active") {
    return json({ error: "Integration already active" }, 400);
  }

  const price = integration.price_once;

  const { data: wallet } = await supabase
    .from("tenant_wallets")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("currency", "SAR")
    .maybeSingle();

  if (!wallet) {
    return json({ error: "لا توجد محفظة — يرجى التواصل مع الإدارة", code: "NO_WALLET" }, 400);
  }

  const { data: txId, error: txErr } = await supabase.rpc("process_wallet_transaction", {
    p_wallet_id: wallet.id,
    p_type: "debit",
    p_amount: price,
    p_reason: "integration",
    p_reference_type: "integration",
    p_reference_id: integrationId,
    p_actor_id: userId,
    p_source: "system",
  });

  if (txErr) {
    console.error("process_wallet_transaction error:", txErr);
    const msg = txErr.message || "فشل تنفيذ العملية";

    let code = "TX_FAILED";
    let userMsg = "حدث خطأ أثناء معالجة العملية";
    let statusCode = 400;

    if (msg.includes("مجمّدة")) {
      code = "WALLET_FROZEN";
      userMsg = "المحفظة مجمّدة — لا يمكن إتمام عملية الشراء. يرجى التواصل مع الإدارة لإلغاء التجميد.";
    } else if (msg.includes("غير كافٍ")) {
      code = "INSUFFICIENT_BALANCE";
      userMsg = `الرصيد غير كافٍ لشراء "${integration.name_ar}". المبلغ المطلوب: ${price} ر.س — يرجى شحن المحفظة أولاً.`;
    } else if (msg.includes("غير صالح") || msg.includes("مطلوب")) {
      code = "INVALID_REFERENCE";
      userMsg = "بيانات العملية غير مكتملة — يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.";
    } else if (msg.includes("غير موجودة")) {
      code = "NO_WALLET";
      userMsg = "لا توجد محفظة مرتبطة بحسابك — يرجى التواصل مع الإدارة.";
    }

    return json({ error: userMsg, code, detail: msg }, statusCode);
  }

  const activationData = {
    tenant_id: tenantId,
    integration_id: integrationId,
    status: integration.requires_api_keys ? "disabled" : "active",
    activated_by: userId,
    purchased_at: new Date().toISOString(),
    activated_at: new Date().toISOString(),
    activation_source: "wallet",
  };

  let activateErr;
  if (existing) {
    const { error } = await supabase
      .from("tenant_paid_integrations")
      .update(activationData)
      .eq("id", existing.id);
    activateErr = error;
  } else {
    const { error } = await supabase
      .from("tenant_paid_integrations")
      .insert(activationData);
    activateErr = error;
  }

  if (activateErr) {
    console.error("Failed to activate integration:", activateErr);
    await supabase.rpc("process_wallet_transaction", {
      p_wallet_id: wallet.id,
      p_type: "credit",
      p_amount: price,
      p_reason: "refund",
      p_reference_type: "integration",
      p_reference_id: integrationId,
      p_actor_id: userId,
      p_source: "system",
    });
    return json({ error: "فشل تفعيل التكامل — تم استرداد المبلغ" }, 500);
  }

  const receiptNumber = `WR-${Date.now()}`;
  await supabase.from("wallet_receipts").insert({
    wallet_transaction_id: txId,
    tenant_id: tenantId,
    invoice_number: receiptNumber,
    pdf_url: null,
    issued_at: new Date().toISOString(),
  });

  const { data: updatedWallet } = await supabase
    .from("tenant_wallets")
    .select("balance_available")
    .eq("id", wallet.id)
    .single();

  return json({
    success: true,
    message: `تم شراء ${integration.name_ar} بنجاح`,
    receipt_number: receiptNumber,
    new_balance: updatedWallet?.balance_available ?? 0,
    requires_api_keys: integration.requires_api_keys,
  });
}

// ===================== TOPUP (Card / Apple Pay via Paylink) =====================
async function handleTopup(
  req: Request,
  supabase: any,
  userId: string,
  tenantId: string
) {
  const body = await req.json();
  const { amount } = body;

  if (!amount || amount <= 0) {
    return json({ error: "المبلغ غير صالح" }, 400);
  }
  if (amount > 50000) {
    return json({ error: "الحد الأقصى للشحن الواحد 50,000 ر.س" }, 400);
  }

  const { data: wallet } = await supabase
    .from("tenant_wallets")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("currency", "SAR")
    .maybeSingle();

  if (!wallet) {
    return json({ error: "لا توجد محفظة", code: "NO_WALLET" }, 400);
  }
  if (wallet.status === "frozen") {
    return json({ error: "المحفظة مجمّدة", code: "WALLET_FROZEN" }, 400);
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", userId)
    .single();

  const PAYLINK_BASE_URL = "https://restapi.paylink.sa";
  const apiId = Deno.env.get("PAYLINK_API_ID");
  const secretKey = Deno.env.get("PAYLINK_SECRET_KEY");

  if (!apiId || !secretKey) {
    return json({ error: "بوابة الدفع غير مهيأة — يرجى التواصل مع الإدارة" }, 500);
  }

  const authRes = await fetch(`${PAYLINK_BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiId, secretKey, persistToken: true }),
  });

  if (!authRes.ok) {
    return json({ error: "فشل الاتصال ببوابة الدفع" }, 502);
  }

  const { id_token: paylinkToken } = await authRes.json();

  const orderNumber = `WT-${Date.now()}`;
  const callBackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/wallet-purchase?action=paylink-callback`;

  const invoiceRes = await fetch(`${PAYLINK_BASE_URL}/api/addInvoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${paylinkToken}`,
    },
    body: JSON.stringify({
      amount,
      callBackUrl,
      clientEmail: profile?.email || "",
      clientMobile: profile?.phone || "0500000000",
      clientName: profile?.full_name || tenant?.name || "عميل",
      currency: "SAR",
      note: `شحن محفظة - ${tenant?.name || ""}`,
      orderNumber,
      products: [{ title: "شحن رصيد المحفظة", price: amount, qty: 1 }],
    }),
  });

  if (!invoiceRes.ok) {
    const errText = await invoiceRes.text();
    console.error("Paylink addInvoice error:", errText);
    return json({ error: "فشل إنشاء رابط الدفع" }, 502);
  }

  const invoiceData = await invoiceRes.json();

  await supabase.from("wallet_topup_requests").insert({
    tenant_id: tenantId,
    wallet_id: wallet.id,
    amount,
    payment_method: "card",
    bank_reference: invoiceData.transactionNo || null,
    receipt_url: invoiceData.url || null,
    receipt_filename: null,
    status: "pending",
    created_by: userId,
  });

  return json({
    success: true,
    paymentUrl: invoiceData.url,
    transactionNo: invoiceData.transactionNo,
    orderNumber,
  });
}

// ===================== SECURED PAYLINK CALLBACK =====================
async function handlePaylinkCallback(
  req: Request,
  supabaseUrl: string,
  serviceKey: string
) {
  const supabase = createClient(supabaseUrl, serviceKey);

  const bodyText = await req.text();
  let body: any;
  try {
    body = JSON.parse(bodyText);
  } catch {
    await logWebhookAudit(supabase, null, "webhook_rejected", {
      provider: "paylink-wallet",
      reason: "Invalid JSON body",
    });
    return json({ error: "Invalid JSON" }, 400);
  }

  // 1. Signature verification
  const webhookSecret = Deno.env.get("WEBHOOK_SIGNING_SECRET");
  if (webhookSecret) {
    const { valid, reason } = await verifyWebhookSignature(req, bodyText, webhookSecret);
    if (!valid) {
      await logWebhookAudit(supabase, null, "webhook_signature_failed", {
        provider: "paylink-wallet",
        reason,
        transaction_no: body.transactionNo,
      });
      return json({ error: "Invalid signature" }, 403);
    }
  }

  let transactionNo: string | null = body.transactionNo || body.orderNumber;
  let orderStatus: string | null = body.orderStatus;

  if (!transactionNo) {
    const url = new URL(req.url);
    transactionNo = url.searchParams.get("transactionNo");
    orderStatus = orderStatus || url.searchParams.get("orderStatus");
  }

  if (!transactionNo) {
    return json({ error: "Missing transactionNo" }, 400);
  }

  // 2. Idempotency check
  const eventId = `paylink-wallet-${transactionNo}-${orderStatus || "unknown"}`;
  const { duplicate, existingStatus } = await checkIdempotency(
    supabase,
    "paylink-wallet",
    eventId,
    null,
    { transactionNo, orderStatus }
  );

  if (duplicate) {
    await logWebhookAudit(supabase, null, "webhook_duplicate", {
      provider: "paylink-wallet",
      event_id: eventId,
      existing_status: existingStatus,
    });
    // Still redirect user
    const appOrigin = Deno.env.get("APP_ORIGIN") || "https://numaxio.com";
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: `${appOrigin}/dashboard/wallet?topup=already_processed` },
    });
  }

  // 3. Process the callback
  let processStatus = "completed";
  let tenantId: string | null = null;

  try {
    // Get the topup request
    const { data: topupReq } = await supabase
      .from("wallet_topup_requests")
      .select("id, tenant_id, wallet_id, amount, status")
      .eq("bank_reference", transactionNo)
      .eq("payment_method", "card")
      .eq("status", "pending")
      .maybeSingle();

    if (!topupReq) {
      console.log("No pending topup found for transactionNo:", transactionNo);
      processStatus = "no_pending_request";
    } else {
      tenantId = topupReq.tenant_id;

      // Verify with Paylink API
      const apiId = Deno.env.get("PAYLINK_API_ID");
      const secretKey = Deno.env.get("PAYLINK_SECRET_KEY");
      const PAYLINK_BASE_URL = "https://restapi.paylink.sa";

      const authRes = await fetch(`${PAYLINK_BASE_URL}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiId, secretKey, persistToken: true }),
      });
      const { id_token: paylinkToken } = await authRes.json();

      const statusRes = await fetch(`${PAYLINK_BASE_URL}/api/getInvoice/${transactionNo}`, {
        headers: { Authorization: `Bearer ${paylinkToken}` },
      });
      const statusData = await statusRes.json();

      if (statusData.orderStatus === "Paid" || statusData.orderStatus === "paid") {
        await supabase.rpc("process_wallet_transaction", {
          p_wallet_id: topupReq.wallet_id,
          p_type: "credit",
          p_amount: topupReq.amount,
          p_reason: "topup",
          p_reference_type: "topup",
          p_reference_id: topupReq.id,
          p_actor_id: "00000000-0000-0000-0000-000000000000",
          p_source: "payment_gateway",
        });

        await supabase
          .from("wallet_topup_requests")
          .update({ status: "approved", reviewed_at: new Date().toISOString() })
          .eq("id", topupReq.id);
      } else if (statusData.orderStatus === "Canceled" || statusData.orderStatus === "canceled") {
        await supabase
          .from("wallet_topup_requests")
          .update({ status: "rejected", rejection_reason: "تم إلغاء الدفع", reviewed_at: new Date().toISOString() })
          .eq("id", topupReq.id);
        processStatus = "payment_canceled";
      }

      // Store provider response
      await markWebhookCompleted(supabase, "paylink-wallet", eventId, processStatus, statusData);
    }

    // 4. Audit log
    await logWebhookAudit(supabase, tenantId, "webhook_processed", {
      provider: "paylink-wallet",
      event_id: eventId,
      transaction_no: transactionNo,
      order_status: orderStatus,
      result: processStatus,
    });
  } catch (err: any) {
    processStatus = "error";
    console.error("Paylink wallet callback error:", err);
    await markWebhookCompleted(supabase, "paylink-wallet", eventId, "error", { error: err.message });
  }

  // Redirect user back to wallet page
  const appOrigin = Deno.env.get("APP_ORIGIN") || "https://numaxio.com";
  const redirectUrl = `${appOrigin}/dashboard/wallet?topup=${processStatus === "completed" ? "success" : "failed"}`;

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: redirectUrl },
  });
}

// ===================== BANK TRANSFER TOPUP =====================
async function handleBankTransferTopup(
  req: Request,
  supabase: any,
  userId: string,
  tenantId: string
) {
  const body = await req.json();
  const { amount, bankReference, receiptUrl, receiptFilename } = body;

  if (!amount || amount <= 0) {
    return json({ error: "المبلغ غير صالح" }, 400);
  }
  if (amount > 50000) {
    return json({ error: "الحد الأقصى للشحن الواحد 50,000 ر.س" }, 400);
  }
  if (!receiptUrl) {
    return json({ error: "يرجى رفع إيصال التحويل" }, 400);
  }

  const { data: wallet } = await supabase
    .from("tenant_wallets")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("currency", "SAR")
    .maybeSingle();

  if (!wallet) {
    return json({ error: "لا توجد محفظة — يرجى التواصل مع الإدارة", code: "NO_WALLET" }, 400);
  }

  if (wallet.status === "frozen") {
    return json({ error: "المحفظة مجمّدة — لا يمكن شحن الرصيد", code: "WALLET_FROZEN" }, 400);
  }

  const { data: topupRequest, error: insertErr } = await supabase
    .from("wallet_topup_requests")
    .insert({
      tenant_id: tenantId,
      wallet_id: wallet.id,
      amount,
      payment_method: "bank_transfer",
      bank_reference: bankReference || null,
      receipt_url: receiptUrl,
      receipt_filename: receiptFilename || null,
      status: "pending",
      created_by: userId,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("Failed to create topup request:", insertErr);
    return json({ error: "فشل إنشاء طلب الشحن — يرجى المحاولة مرة أخرى", detail: insertErr.message }, 500);
  }

  const requestNumber = `BTR-${Date.now()}`;

  return json({
    success: true,
    message: `تم إرسال طلب شحن بمبلغ ${amount} ر.س بنجاح — سيتم مراجعته وتأكيده خلال 24 ساعة`,
    request_id: topupRequest.id,
    request_number: requestNumber,
    status: "pending",
  });
}

// ===================== HELPERS =====================
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
