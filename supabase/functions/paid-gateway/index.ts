import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

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
    // Rate limiting
    const rlAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const blocked = await checkRateLimit(req, rlAdmin, "paid_gateway", corsHeaders);
    if (blocked) return blocked;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ---- Webhook callback (no auth needed) ----
    if (action === "webhook") {
      return await handleWebhook(req, supabase);
    }

    // ---- Authenticated actions ----
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return json({ error: "Invalid token" }, 401);
    }

    // Get user's tenant
    const { data: member } = await supabase
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!member) {
      return json({ error: "No tenant found" }, 403);
    }
    const tenantId = member.tenant_id;

    if (action === "test-connection" && req.method === "POST") {
      return await handleTestConnection(req, supabase, tenantId);
    }

    if (action === "create-session") {
      return await handleCreateSession(req, supabase, user.id, tenantId);
    }

    if (action === "check-status") {
      return await handleCheckStatus(req, supabase, tenantId);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err: any) {
    console.error("paid-gateway error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});

// ===================== TEST CONNECTION =====================
async function handleTestConnection(req: Request, supabase: any, tenantId: string) {
  const body = await req.json();
  const { gatewayKey, apiKey } = body;

  if (!gatewayKey || !apiKey) {
    return json({ error: "gatewayKey and apiKey are required" }, 400);
  }

  let result: { success: boolean; message: string };

  switch (gatewayKey) {
    case "pay_moyasar":
      result = await testMoyasar(apiKey);
      break;
    case "pay_hyperpay":
      result = await testHyperPay(apiKey);
      break;
    case "pay_tap":
      result = await testTap(apiKey);
      break;
    default:
      result = { success: false, message: `بوابة غير معروفة: ${gatewayKey}` };
  }

  // If successful, activate the integration
  if (result.success) {
    const { data: integ } = await supabase
      .from("paid_integrations")
      .select("id")
      .eq("key", gatewayKey)
      .single();

    if (integ) {
      await supabase
        .from("tenant_paid_integrations")
        .update({
          status: "active",
          activated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("integration_id", integ.id);
    }
  }

  return json(result);
}

async function testMoyasar(apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch("https://api.moyasar.com/v1/payments?page=1&per=1", {
      headers: { Authorization: `Basic ${btoa(apiKey + ":")}` },
    });
    if (res.status === 401) return { success: false, message: "مفتاح API غير صالح — تحقق من المفتاح السري (sk_...)" };
    if (res.status === 403) return { success: false, message: "المفتاح لا يمتلك الصلاحيات المطلوبة" };
    if (!res.ok) {
      const text = await res.text();
      return { success: false, message: `خطأ من Moyasar: ${res.status} — ${text.substring(0, 200)}` };
    }
    return { success: true, message: "تم الاتصال بنجاح مع Moyasar ✅" };
  } catch (err: any) {
    return { success: false, message: `فشل الاتصال بـ Moyasar: ${err.message}` };
  }
}

async function testHyperPay(accessToken: string): Promise<{ success: boolean; message: string }> {
  try {
    // HyperPay format: "entityId:accessToken"
    const [entityId, token] = accessToken.includes(":") ? accessToken.split(":") : ["", accessToken];
    const testUrl = entityId 
      ? `https://eu-test.oppwa.com/v1/checkouts/test123/payment?entityId=${entityId}`
      : `https://eu-test.oppwa.com/v1/checkouts/test123/payment?entityId=test`;
    
    const res = await fetch(testUrl, {
      headers: { Authorization: `Bearer ${token || accessToken}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { success: false, message: "Access Token غير صالح — تحقق من التوكن" };
    }
    // 400 or 404 means token works but test ID doesn't exist (expected)
    return { success: true, message: "تم الاتصال بنجاح مع HyperPay ✅" };
  } catch (err: any) {
    return { success: false, message: `فشل الاتصال بـ HyperPay: ${err.message}` };
  }
}

async function testTap(secretKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch("https://api.tap.company/v2/charges/list", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ period: { date: { from: Date.now(), to: Date.now() } }, limit: 1 }),
    });
    if (res.status === 401) return { success: false, message: "مفتاح API غير صالح — تحقق من Secret Key (sk_live_...)" };
    if (res.status === 403) return { success: false, message: "المفتاح لا يمتلك الصلاحيات المطلوبة" };
    // 400 from Tap often means key is valid but request format issue
    if (res.status === 400) return { success: true, message: "تم الاتصال بنجاح مع Tap ✅" };
    if (!res.ok) {
      const text = await res.text();
      return { success: false, message: `خطأ من Tap: ${res.status} — ${text.substring(0, 200)}` };
    }
    return { success: true, message: "تم الاتصال بنجاح مع Tap ✅" };
  } catch (err: any) {
    return { success: false, message: `فشل الاتصال بـ Tap: ${err.message}` };
  }
}

// ===================== CREATE SESSION =====================
async function handleCreateSession(
  req: Request,
  supabase: any,
  userId: string,
  tenantId: string
) {
  const body = await req.json();
  const { invoiceId, gatewayKey } = body;

  if (!invoiceId || !gatewayKey) {
    return json({ error: "invoiceId and gatewayKey are required" }, 400);
  }

  // Verify invoice belongs to tenant
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount_due, currency, customer_id, customers(name, email, phone)")
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .single();

  if (!invoice) {
    return json({ error: "Invoice not found" }, 404);
  }

  if (invoice.amount_due <= 0) {
    return json({ error: "Invoice already fully paid" }, 400);
  }

  // Get the paid integration and tenant's subscription
  const { data: integration } = await supabase
    .from("paid_integrations")
    .select("id, key")
    .eq("key", gatewayKey)
    .in("integration_type", ["payment", "payment_gateway"])
      .eq("is_ready", true)
    .single();

  if (!integration) {
    return json({ error: "Gateway not available" }, 404);
  }

  const { data: subscription } = await supabase
    .from("tenant_paid_integrations")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integration.id)
    .eq("status", "active")
    .single();

  if (!subscription) {
    return json({ error: "Gateway not activated for this tenant" }, 403);
  }

  // Decrypt API key via service-role–only RPC (never reads plaintext from client)
  const { data: decryptedSecrets, error: secretErr } = await supabase.rpc(
    "get_integration_secrets_for_edge_only",
    { p_tenant_id: tenantId, p_integration_id: integration.id } as any
  );

  if (secretErr || !decryptedSecrets) {
    return json({ error: "API key not configured or decryption failed" }, 400);
  }

  let apiKey: string;
  try {
    const parsed = JSON.parse(decryptedSecrets as string);
    apiKey = parsed.api_key || decryptedSecrets;
  } catch {
    apiKey = decryptedSecrets as string;
  }

  if (!apiKey) {
    return json({ error: "API key not configured" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const callbackUrl = `${supabaseUrl}/functions/v1/paid-gateway?action=webhook&gateway=${gatewayKey}`;
  const amount = invoice.amount_due;
  const currency = invoice.currency || "SAR";
  const description = `Invoice ${invoice.invoice_number}`;
  const customerName = invoice.customers?.name || "Customer";
  const customerEmail = invoice.customers?.email || "";
  const customerPhone = invoice.customers?.phone || "";

  let sessionId = "";
  let paymentUrl = "";
  let gatewayResponse: any = {};

  try {
    if (gatewayKey === "pay_tap") {
      const result = await createTapSession(apiKey, {
        amount, currency, description, callbackUrl,
        customerName, customerEmail, customerPhone, invoiceId, tenantId,
      });
      sessionId = result.id;
      paymentUrl = result.url;
      gatewayResponse = result.raw;
    } else if (gatewayKey === "pay_moyasar") {
      const result = await createMoyasarSession(apiKey, {
        amount, currency, description, callbackUrl,
        invoiceId, tenantId,
      });
      sessionId = result.id;
      paymentUrl = result.url;
      gatewayResponse = result.raw;
    } else if (gatewayKey === "pay_hyperpay") {
      const result = await createHyperpaySession(apiKey, {
        amount, currency, description, invoiceId, tenantId,
      });
      sessionId = result.id;
      paymentUrl = result.url;
      gatewayResponse = result.raw;
    } else {
      return json({ error: "Unsupported gateway" }, 400);
    }
  } catch (err: any) {
    console.error(`Gateway ${gatewayKey} error:`, err);
    return json({ error: `Gateway error: ${err.message}` }, 502);
  }

  // Record transaction
  const { data: tx, error: txErr } = await supabase
    .from("paid_gateway_transactions")
    .insert({
      tenant_id: tenantId,
      invoice_id: invoiceId,
      integration_id: integration.id,
      gateway_key: gatewayKey,
      session_id: sessionId,
      payment_url: paymentUrl,
      amount,
      currency,
      status: "pending",
      gateway_response: gatewayResponse,
      created_by: userId,
    })
    .select("id")
    .single();

  if (txErr) {
    console.error("Failed to record transaction:", txErr);
  }

  return json({ paymentUrl, sessionId, transactionId: tx?.id });
}

// ===================== CHECK STATUS =====================
async function handleCheckStatus(req: Request, supabase: any, tenantId: string) {
  const body = await req.json();
  const { transactionId } = body;

  const { data } = await supabase
    .from("paid_gateway_transactions")
    .select("id, status, paid_at, gateway_response")
    .eq("id", transactionId)
    .eq("tenant_id", tenantId)
    .single();

  if (!data) return json({ error: "Transaction not found" }, 404);
  return json(data);
}

// ===================== WEBHOOK =====================
async function handleWebhook(req: Request, supabase: any) {
  const url = new URL(req.url);
  const gateway = url.searchParams.get("gateway");

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = Object.fromEntries(url.searchParams);
  }

  console.log(`Webhook received for ${gateway}:`, JSON.stringify(body).slice(0, 500));

  let sessionId = "";
  let isPaid = false;

  if (gateway === "pay_tap") {
    sessionId = body.id || body.charge_id || "";
    isPaid = body.status === "CAPTURED";
  } else if (gateway === "pay_moyasar") {
    sessionId = body.id || "";
    isPaid = body.status === "paid";
  } else if (gateway === "pay_hyperpay") {
    sessionId = body.id || "";
    const code = body.result?.code || "";
    isPaid = /^(000\.000\.|000\.100\.|000\.[36])/.test(code);
  }

  if (!sessionId) {
    return json({ error: "No session ID found" }, 400);
  }

  // Find the transaction
  const { data: tx } = await supabase
    .from("paid_gateway_transactions")
    .select("id, invoice_id, tenant_id, amount, status")
    .eq("session_id", sessionId)
    .single();

  if (!tx) {
    console.error("Transaction not found for session:", sessionId);
    return json({ ok: false, error: "Transaction not found" }, 404);
  }

  if (tx.status === "paid") {
    return json({ ok: true, message: "Already processed" });
  }

  const newStatus = isPaid ? "paid" : "failed";

  // Update transaction
  await supabase
    .from("paid_gateway_transactions")
    .update({
      status: newStatus,
      paid_at: isPaid ? new Date().toISOString() : null,
      gateway_response: body,
    })
    .eq("id", tx.id);

  // If paid, record payment on the invoice
  if (isPaid) {
    // Insert invoice payment
    await supabase.from("invoice_payments").insert({
      invoice_id: tx.invoice_id,
      tenant_id: tx.tenant_id,
      amount: tx.amount,
      payment_method: `gateway_${gateway}`,
      payment_date: new Date().toISOString().split("T")[0],
      reference_number: sessionId,
      notes: `دفع عبر بوابة ${gateway === "pay_tap" ? "تاب" : gateway === "pay_moyasar" ? "ميسر" : "هايبرباي"}`,
      created_by: tx.created_by || "00000000-0000-0000-0000-000000000000",
    });

    // The existing invoice_payments trigger should update amount_paid/amount_due/status
  }

  return json({ ok: true, status: newStatus });
}

// ===================== GATEWAY IMPLEMENTATIONS =====================

async function createTapSession(apiKey: string, opts: any) {
  const res = await fetch("https://api.tap.company/v2/charges", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: opts.amount,
      currency: opts.currency,
      description: opts.description,
      customer: {
        first_name: opts.customerName,
        email: opts.customerEmail || undefined,
        phone: opts.customerPhone ? { number: opts.customerPhone, country_code: "966" } : undefined,
      },
      source: { id: "src_all" },
      redirect: { url: opts.callbackUrl },
      post: { url: opts.callbackUrl },
      metadata: { invoice_id: opts.invoiceId, tenant_id: opts.tenantId },
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(data.message || data.errors?.[0]?.description || "Tap API error");
  }
  return { id: data.id, url: data.transaction?.url || data.redirect?.url || "", raw: data };
}

async function createMoyasarSession(apiKey: string, opts: any) {
  const res = await fetch("https://api.moyasar.com/v1/invoices", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(apiKey + ":")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(opts.amount * 100), // Moyasar uses halalas
      currency: opts.currency,
      description: opts.description,
      callback_url: opts.callbackUrl,
      metadata: { invoice_id: opts.invoiceId, tenant_id: opts.tenantId },
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(data.message || data.type || "Moyasar API error");
  }
  return { id: data.id, url: data.url || "", raw: data };
}

async function createHyperpaySession(apiKey: string, opts: any) {
  const params = new URLSearchParams({
    entityId: apiKey.split(":")[0] || apiKey,
    amount: opts.amount.toFixed(2),
    currency: opts.currency,
    paymentType: "DB",
    "merchantTransactionId": opts.invoiceId.slice(0, 32),
    "customer.email": "customer@example.com",
  });

  const accessToken = apiKey.includes(":") ? apiKey.split(":")[1] : apiKey;

  const res = await fetch("https://eu-prod.oppwa.com/v1/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = await res.json();
  if (!data.id) {
    throw new Error(data.result?.description || "HyperPay API error");
  }
  return {
    id: data.id,
    url: `https://eu-prod.oppwa.com/v1/paymentWidgets.js?checkoutId=${data.id}`,
    raw: data,
  };
}

// ===================== HELPERS =====================
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
