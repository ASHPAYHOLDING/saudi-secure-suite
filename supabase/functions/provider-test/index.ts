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

  if (!["tap", "moyasar", "hyperpay"].includes(provider)) {
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

function json(data: any, status = 200, headers = corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
