import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptSecret } from "../_shared/aes-gcm.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const masterKey = Deno.env.get("INTEGRATION_SECRET_KEY") || "";

  const adminClient = createClient(supabaseUrl, serviceKey);

  // Rate limiting
  const blocked = await checkRateLimit(req, adminClient, "provider_test", corsHeaders);
  if (blocked) return blocked;

  // Auth
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, corsHeaders);

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
  if (authErr || !user) return json({ error: "Invalid token" }, 401, corsHeaders);

  // Get tenant
  const { data: member } = await adminClient
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!member) return json({ error: "No tenant found" }, 403, corsHeaders);
  const tenantId = member.tenant_id;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400, corsHeaders); }

  const { provider } = body;

  const VALID_PROVIDERS = [
    "tap", "moyasar", "hyperpay", "stripe", "geidea",
    "paytabs", "myfatoorah", "telr", "paypal", "tabby", "tamara",
  ];
  if (!VALID_PROVIDERS.includes(provider)) {
    return json({ error: "Invalid provider" }, 400, corsHeaders);
  }

  // Fetch encrypted credentials for this tenant
  const { data: record, error: fetchErr } = await adminClient
    .from("tenant_payment_providers")
    .select("credentials_encrypted, status")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .single();

  if (fetchErr || !record) {
    return json({ success: false, message: "لم يتم إعداد بيانات الاعتماد بعد. احفظ المفاتيح أولاً." }, 400, corsHeaders);
  }

  // Decrypt
  let credentials: any;
  try {
    const decrypted = await decryptSecret(record.credentials_encrypted, masterKey);
    credentials = JSON.parse(decrypted);
  } catch (err: any) {
    return json({ success: false, message: "فشل فك التشفير: " + err.message }, 500, corsHeaders);
  }

  // Test based on provider
  let result: { success: boolean; message: string };

  try {
    if (provider === "tap") {
      result = await testTap(credentials.secret_key || credentials.api_key || "");
    } else if (provider === "moyasar") {
      result = await testMoyasar(credentials.secret_key || credentials.api_key || "");
    } else if (provider === "hyperpay") {
      result = await testHyperPay(credentials.access_token || credentials.api_key || "", credentials.entity_id || "");
    } else if (provider === "stripe") {
      result = await testStripe(credentials.secret_key || "");
    } else if (provider === "geidea") {
      result = await testGeidea(credentials.merchant_public_key || "", credentials.api_password || "");
    } else if (provider === "paytabs") {
      result = await testPayTabs(credentials.profile_id || "", credentials.server_key || "");
    } else if (provider === "myfatoorah") {
      result = await testMyFatoorah(credentials.api_token || "");
    } else if (provider === "telr") {
      result = await testTelr(credentials.store_id || "", credentials.auth_key || "");
    } else if (provider === "paypal") {
      result = await testPayPal(credentials.client_id || "", credentials.client_secret || "");
    } else if (provider === "tabby") {
      result = await testTabby(credentials.secret_key || "");
    } else if (provider === "tamara") {
      result = await testTamara(credentials.api_token || "");
    } else {
      result = { success: false, message: "مزود غير معروف" };
    }
  } catch (err: any) {
    result = { success: false, message: "خطأ أثناء الاختبار: " + err.message };
  }

  // Update status
  const newStatus = result.success ? "tested" : "connected";
  await adminClient
    .from("tenant_payment_providers")
    .update({
      status: newStatus,
      last_tested_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("provider", provider);

  // Audit log
  await adminClient.from("audit_logs").insert({
    tenant_id: tenantId,
    user_id: user.id,
    action: "provider_connection_tested",
    entity_type: "payment_provider",
    entity_label: provider,
    changes: { provider, success: result.success, message: result.message },
  });

  return json({ ...result, status: newStatus }, 200, corsHeaders);
});

async function testTap(secretKey: string): Promise<{ success: boolean; message: string }> {
  if (!secretKey) return { success: false, message: "Secret Key مطلوب" };
  try {
    const res = await fetch("https://api.tap.company/v2/charges/list", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ period: { date: { from: Date.now(), to: Date.now() } }, limit: 1 }),
    });
    if (res.status === 401) return { success: false, message: "مفتاح API غير صالح (401)" };
    if (res.status === 403) return { success: false, message: "المفتاح لا يمتلك الصلاحيات (403)" };
    if (res.status === 400) return { success: true, message: "✅ تم الاتصال بنجاح مع Tap" };
    if (!res.ok) return { success: false, message: `خطأ من Tap: ${res.status}` };
    return { success: true, message: "✅ تم الاتصال بنجاح مع Tap" };
  } catch (err: any) {
    return { success: false, message: "فشل الاتصال: " + err.message };
  }
}

async function testMoyasar(secretKey: string): Promise<{ success: boolean; message: string }> {
  if (!secretKey) return { success: false, message: "Secret Key مطلوب" };
  try {
    const res = await fetch("https://api.moyasar.com/v1/payments?page=1&per=1", {
      headers: { Authorization: `Basic ${btoa(secretKey + ":")}` },
    });
    if (res.status === 401) return { success: false, message: "مفتاح API غير صالح (401)" };
    if (res.status === 403) return { success: false, message: "المفتاح لا يمتلك الصلاحيات (403)" };
    if (!res.ok) return { success: false, message: `خطأ من Moyasar: ${res.status}` };
    return { success: true, message: "✅ تم الاتصال بنجاح مع Moyasar" };
  } catch (err: any) {
    return { success: false, message: "فشل الاتصال: " + err.message };
  }
}

async function testHyperPay(accessToken: string, entityId: string): Promise<{ success: boolean; message: string }> {
  if (!accessToken) return { success: false, message: "Access Token مطلوب" };
  try {
    const eid = entityId || accessToken.split(":")[0] || "";
    const token = accessToken.includes(":") ? accessToken.split(":")[1] : accessToken;
    const url = `https://eu-test.oppwa.com/v1/checkouts/test_id_123/payment${eid ? `?entityId=${eid}` : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { success: false, message: "Access Token غير صالح" };
    }
    return { success: true, message: "✅ تم الاتصال بنجاح مع HyperPay" };
  } catch (err: any) {
    return { success: false, message: "فشل الاتصال: " + err.message };
  }
}

async function testStripe(secretKey: string): Promise<{ success: boolean; message: string }> {
  if (!secretKey) return { success: false, message: "Secret Key مطلوب" };
  if (!secretKey.startsWith("sk_live_") && !secretKey.startsWith("sk_test_")) {
    return { success: false, message: "مفتاح Stripe غير صالح — يجب أن يبدأ بـ sk_live_ أو sk_test_" };
  }
  try {
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (res.status === 401) return { success: false, message: "مفتاح Stripe غير صالح (401 Unauthorized)" };
    if (res.status === 403) return { success: false, message: "المفتاح لا يمتلك الصلاحيات المطلوبة (403)" };
    if (!res.ok) return { success: false, message: `خطأ من Stripe: ${res.status}` };
    return { success: true, message: "✅ تم الاتصال بنجاح مع Stripe" };
  } catch (err: any) {
    return { success: false, message: "فشل الاتصال بـ Stripe: " + err.message };
  }
}

async function testGeidea(merchantPublicKey: string, apiPassword: string): Promise<{ success: boolean; message: string }> {
  if (!merchantPublicKey || !apiPassword) return { success: false, message: "Merchant Public Key و API Password مطلوبان" };
  try {
    const credentials = btoa(`${merchantPublicKey}:${apiPassword}`);
    const res = await fetch("https://api.merchant.geidea.net/pgw/api/v6/direct/session", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: "1.00", currency: "SAR", timestamp: new Date().toISOString() }),
    });
    // 401 = bad credentials, 400 = bad request but auth passed = success
    if (res.status === 401) return { success: false, message: "بيانات اعتماد Geidea غير صالحة (401)" };
    if (res.status === 403) return { success: false, message: "لا توجد صلاحيات على حساب Geidea (403)" };
    // 400 means auth OK but payload issue — credentials are valid
    if (res.status === 400 || res.ok) return { success: true, message: "✅ تم الاتصال بنجاح مع Geidea" };
    return { success: false, message: `استجابة غير متوقعة من Geidea: ${res.status}` };
  } catch (err: any) {
    return { success: false, message: "فشل الاتصال بـ Geidea: " + err.message };
  }
}

function json(data: any, status = 200, headers = corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function testPayTabs(profileId: string, serverKey: string): Promise<{ success: boolean; message: string }> {
  if (!profileId || !serverKey) return { success: false, message: "Profile ID و Server Key مطلوبان" };
  try {
    const res = await fetch("https://secure.paytabs.sa/payment/request", {
      method: "POST",
      headers: { Authorization: serverKey, "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: profileId, tran_type: "auth", tran_class: "ecom",
        cart_id: "test", cart_currency: "SAR", cart_amount: 1, cart_description: "test",
        paypage_lang: "ar", return: "https://example.com", callback: "https://example.com" }),
    });
    if (res.status === 401 || res.status === 403) return { success: false, message: "بيانات PayTabs غير صالحة" };
    if (res.status === 400 || res.ok) return { success: true, message: "✅ تم الاتصال بنجاح مع PayTabs" };
    return { success: false, message: `خطأ من PayTabs: ${res.status}` };
  } catch (err: any) {
    return { success: false, message: "فشل الاتصال: " + err.message };
  }
}

async function testMyFatoorah(apiToken: string): Promise<{ success: boolean; message: string }> {
  if (!apiToken) return { success: false, message: "API Token مطلوب" };
  try {
    const res = await fetch("https://api.myfatoorah.com/v2/GetPaymentStatus", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ Key: "test", KeyType: "PaymentId" }),
    });
    if (res.status === 401) return { success: false, message: "API Token غير صالح (401)" };
    if (res.status === 400 || res.ok) return { success: true, message: "✅ تم الاتصال بنجاح مع MyFatoorah" };
    return { success: false, message: `خطأ من MyFatoorah: ${res.status}` };
  } catch (err: any) {
    return { success: false, message: "فشل الاتصال: " + err.message };
  }
}

async function testTelr(storeId: string, authKey: string): Promise<{ success: boolean; message: string }> {
  if (!storeId || !authKey) return { success: false, message: "Store ID و Auth Key مطلوبان" };
  try {
    const res = await fetch("https://secure.telr.com/gateway/order.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ivp_method: "check", ivp_store: storeId, ivp_authkey: authKey,
        ivp_cart: "test_cart", ivp_test: 1 }),
    });
    if (res.status === 401 || res.status === 403) return { success: false, message: "بيانات Telr غير صالحة" };
    const data = await res.json().catch(() => ({}));
    if (data?.error?.note?.includes("Unknown Store")) return { success: false, message: "Store ID غير موجود في Telr" };
    return { success: true, message: "✅ تم الاتصال بنجاح مع Telr" };
  } catch (err: any) {
    return { success: false, message: "فشل الاتصال: " + err.message };
  }
}

async function testPayPal(clientId: string, clientSecret: string): Promise<{ success: boolean; message: string }> {
  if (!clientId || !clientSecret) return { success: false, message: "Client ID و Client Secret مطلوبان" };
  try {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const res = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (res.status === 401) return { success: false, message: "بيانات PayPal غير صالحة (401)" };
    if (res.ok) return { success: true, message: "✅ تم الاتصال بنجاح مع PayPal" };
    return { success: false, message: `خطأ من PayPal: ${res.status}` };
  } catch (err: any) {
    return { success: false, message: "فشل الاتصال: " + err.message };
  }
}

async function testTabby(secretKey: string): Promise<{ success: boolean; message: string }> {
  if (!secretKey) return { success: false, message: "Secret Key مطلوب" };
  try {
    const res = await fetch("https://api.tabby.ai/api/v2/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ payment: { amount: "1.00", currency: "SAR", description: "test",
        buyer: { email: "test@test.com", name: "Test", phone: "500000001" },
        order: { reference_id: "test_001", items: [] } } }),
    });
    if (res.status === 401) return { success: false, message: "Secret Key غير صالح (401)" };
    if (res.status === 400 || res.ok) return { success: true, message: "✅ تم الاتصال بنجاح مع Tabby" };
    return { success: false, message: `خطأ من Tabby: ${res.status}` };
  } catch (err: any) {
    return { success: false, message: "فشل الاتصال: " + err.message };
  }
}

async function testTamara(apiToken: string): Promise<{ success: boolean; message: string }> {
  if (!apiToken) return { success: false, message: "API Token مطلوب" };
  try {
    const res = await fetch("https://api-sandbox.tamara.co/merchants/payment-types", {
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    });
    if (res.status === 401) return { success: false, message: "API Token غير صالح (401)" };
    if (res.ok) return { success: true, message: "✅ تم الاتصال بنجاح مع Tamara" };
    return { success: false, message: `خطأ من Tamara: ${res.status}` };
  } catch (err: any) {
    return { success: false, message: "فشل الاتصال: " + err.message };
  }
}
