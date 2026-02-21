/**
 * madfu-init-token — Edge Function
 * يُجري InitToken request إلى Madfu API ويخزّن التوكن مشفَّراً.
 * POST /functions/v1/madfu-init-token
 *
 * لا يُعيد أي سر إلى العميل — فقط { success, status, message }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptSecret, decryptSecret } from "../_shared/aes-gcm.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { withRequestTimeout } from "../_shared/timeout-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** قناع الحقل الحساس — يُعيد آخر 4 أحرف فقط */
function mask(val?: string) {
  if (!val || val.length < 5) return "****";
  return `****${val.slice(-4)}`;
}

Deno.serve(withRequestTimeout(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const masterKey = Deno.env.get("INTEGRATION_SECRET_KEY") || "";

  if (!masterKey) return json({ success: false, message: "INTEGRATION_SECRET_KEY غير مُعيَّن" }, 500);

  const adminClient = createClient(supabaseUrl, serviceKey);

  const blocked = await checkRateLimit(req, adminClient, "payment_init", corsHeaders);
  if (blocked) return blocked;

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ success: false, message: "Unauthorized" }, 401);

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
  if (authErr || !user) return json({ success: false, message: "Invalid token" }, 401);

  // ── Tenant ────────────────────────────────────────────────────────────────────
  const { data: member } = await adminClient
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!member) return json({ success: false, message: "No tenant found" }, 403);
  const tenantId = member.tenant_id;

  // ── Body ──────────────────────────────────────────────────────────────────────
  let body: any;
  try { body = await req.json(); } catch { return json({ success: false, message: "Invalid JSON" }, 400); }

  const { tenant_id: bodyTenantId } = body;
  // تحقق أن tenant_id في الطلب يطابق tenant المستخدم (أو تجاهله واستخدم من DB)
  if (bodyTenantId && bodyTenantId !== tenantId) {
    return json({ success: false, message: "Tenant mismatch" }, 403);
  }

  // ── جلب بيانات الاعتماد المشفَّرة من DB ─────────────────────────────────────
  const { data: record, error: fetchErr } = await (adminClient as any)
    .from("tenant_payment_providers")
    .select("credentials_encrypted, config_json, status")
    .eq("tenant_id", tenantId)
    .eq("provider", "madfu")
    .maybeSingle();

  if (fetchErr || !record) {
    return json({
      success: false,
      message: "لم يتم إعداد بيانات اعتماد Madfu بعد. احفظ البيانات أولاً من صفحة الإعداد.",
    }, 400);
  }

  // ── فك التشفير ───────────────────────────────────────────────────────────────
  let credentials: any;
  try {
    const decrypted = await decryptSecret(record.credentials_encrypted, masterKey);
    credentials = JSON.parse(decrypted);
  } catch (err: any) {
    return json({ success: false, message: "فشل فك التشفير: " + err.message }, 500);
  }

  const config = record.config_json || {};

  // ── بناء طلب InitToken ───────────────────────────────────────────────────────
  const baseUrl = credentials.base_url || config.base_url || "https://api.staging.madfu.com.sa";
  const endpointPath = config.endpoint_path || "/merchants/token/init";
  const targetUrl = `${baseUrl.replace(/\/$/, "")}${endpointPath}`;

  // بناء body الطلب بناءً على الحقول المتاحة (dynamic mapping)
  const requestBody: Record<string, string> = {};
  if (credentials.merchant_id) requestBody.merchantId = credentials.merchant_id;
  if (credentials.client_id) requestBody.clientId = credentials.client_id;
  if (credentials.client_secret) requestBody.clientSecret = credentials.client_secret;
  if (credentials.username) requestBody.username = credentials.username;
  if (credentials.password) requestBody.password = credentials.password;

  // إذا كان هناك body template مخصص في config_json
  if (config.body_template) {
    try {
      const template = typeof config.body_template === "string"
        ? JSON.parse(config.body_template)
        : config.body_template;
      Object.assign(requestBody, template);
    } catch { /* تجاهل template خاطئ */ }
  }

  // ── إرسال الطلب ──────────────────────────────────────────────────────────────
  let responseData: any;
  let httpStatus: number;
  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    httpStatus = res.status;
    try {
      responseData = await res.json();
    } catch {
      responseData = { raw: await res.text().catch(() => "") };
    }
  } catch (err: any) {
    // ── سجل الفشل (بدون أسرار) ─────────────────────────────────────────────────
    await adminClient.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: user.id,
      action: "integration_connection_test",
      entity_type: "payment_provider",
      entity_label: "madfu",
      changes: {
        provider: "madfu",
        status: "failed",
        error: err.message,
        target_url: targetUrl,
        payload_masked: {
          merchantId: requestBody.merchantId || null,
          clientId: requestBody.clientId ? mask(requestBody.clientId) : null,
          clientSecret: "****",
          username: requestBody.username || null,
          password: requestBody.password ? "****" : null,
        },
      },
    }).catch(() => {});

    return json({ success: false, message: "فشل الاتصال بـ Madfu: " + err.message }, 500);
  }

  // ── استخراج التوكن من الاستجابة ──────────────────────────────────────────────
  const extractedToken: string | null =
    responseData?.token ||
    responseData?.access_token ||
    responseData?.data?.token ||
    responseData?.data?.access_token ||
    responseData?.result?.token ||
    null;

  const isSuccess = httpStatus >= 200 && httpStatus < 300 && (extractedToken || responseData?.success === true);

  // ── تخزين التوكن مشفَّراً ─────────────────────────────────────────────────────
  if (extractedToken) {
    try {
      const tokenEncrypted = await encryptSecret(extractedToken, masterKey);
      // upsert في جدول tenant_provider_tokens
      await (adminClient as any)
        .from("tenant_provider_tokens")
        .upsert({
          tenant_id: tenantId,
          provider: "madfu",
          token_encrypted: tokenEncrypted,
          expires_at: responseData?.expires_at || responseData?.expiry || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,provider" });
    } catch { /* لا نوقف العملية إذا فشل حفظ التوكن */ }
  }

  // ── تحديث حالة المزود في tenant_payment_providers ────────────────────────────
  const newStatus = isSuccess ? "tested" : "connected";
  await (adminClient as any)
    .from("tenant_payment_providers")
    .update({
      status: newStatus,
      last_tested_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("provider", "madfu");

  // ── سجل التدقيق (بدون أي سر) ─────────────────────────────────────────────────
  const maskedPayload = {
    merchantId: requestBody.merchantId || null,
    clientId: requestBody.clientId ? mask(requestBody.clientId) : null,
    clientSecret: requestBody.clientSecret ? "****" : null,
    username: requestBody.username || null,
    password: requestBody.password ? "****" : null,
  };

  const responseSummary = {
    http_status: httpStatus,
    token_received: !!extractedToken,
    response_keys: Object.keys(responseData || {}),
    error_hint: !isSuccess ? (responseData?.message || responseData?.error || `HTTP ${httpStatus}`) : null,
  };

  await adminClient.from("audit_logs").insert({
    tenant_id: tenantId,
    user_id: user.id,
    action: "integration_connection_test",
    entity_type: "payment_provider",
    entity_label: "madfu",
    changes: {
      provider: "madfu",
      status: isSuccess ? "success" : "failed",
      target_url: targetUrl,
      payload_masked: maskedPayload,
      response_summary: responseSummary,
    },
  }).catch(() => {});

  // ── الردّ على العميل ─────────────────────────────────────────────────────────
  if (isSuccess) {
    return json({
      success: true,
      message: "✅ تم الاتصال بـ Madfu بنجاح" + (extractedToken ? " واسترداد التوكن" : ""),
      status: newStatus,
      token_received: !!extractedToken,
    });
  } else {
    const errorHint =
      httpStatus === 401 ? "بيانات الاعتماد غير صالحة (401 Unauthorized)" :
      httpStatus === 403 ? "لا توجد صلاحيات (403 Forbidden)" :
      httpStatus === 404 ? "Endpoint غير موجود (404) — تحقق من Base URL" :
      httpStatus === 422 ? "بيانات الطلب غير مكتملة (422) — تحقق من الحقول المطلوبة" :
      httpStatus >= 500 ? `خطأ في خادم Madfu (${httpStatus}) — حاول لاحقاً` :
      responseData?.message || responseData?.error || `HTTP ${httpStatus}`;

    return json({
      success: false,
      message: `❌ فشل الاتصال بـ Madfu: ${errorHint}`,
      status: newStatus,
      error: errorHint,
    }, 200); // نُعيد 200 مع success:false حتى يعرضها الـ UI
  }
}, 30000, corsHeaders));
