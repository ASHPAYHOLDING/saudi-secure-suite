import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

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
});

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

// ===================== TOPUP (Card — requires real gateway) =====================
async function handleTopup(
  _req: Request,
  _supabase: any,
  _userId: string,
  _tenantId: string
) {
  // Card payment requires a real payment gateway integration (Moyasar, Tap, etc.)
  // This is a placeholder — actual gateway should be connected
  return json({
    error: "الدفع بالبطاقة غير متاح حالياً — يرجى استخدام التحويل البنكي",
    code: "CARD_NOT_AVAILABLE",
  }, 400);
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

  // Get wallet
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

  // Create pending topup request
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
