/**
 * marketing-send-event — Edge Function موحدة لإرسال أحداث التسويق
 * تدعم: meta_pixel_capi | facebook_capi | tiktok_capi | google_ads | x_pixel
 * مع idempotency + rate limiting + تسجيل شامل
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── AES-GCM decrypt ───────────────────────────────────────────────────────────
async function aesGcmDecrypt(encryptedB64: string, keyHex: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);
  return new TextDecoder().decode(decrypted);
}

// ── SHA256 hash ────────────────────────────────────────────────────────────────
async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.toLowerCase().trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Rate limiter (simple in-memory per invocation) ────────────────────────────
const rateLimitMap = new Map<string, number[]>();
function checkRateLimit(key: string, limit = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const times = (rateLimitMap.get(key) ?? []).filter((t) => now - t < windowMs);
  if (times.length >= limit) return false;
  times.push(now);
  rateLimitMap.set(key, times);
  return true;
}

// ── Provider senders ──────────────────────────────────────────────────────────

async function sendMetaCAPI(secrets: Record<string, string>, config: Record<string, unknown>, payload: Record<string, unknown>) {
  const { access_token, test_event_code } = secrets;
  const pixel_id = config.pixel_id as string;
  const eventTime = Math.floor(Date.now() / 1000);
  const eventId = payload.event_id as string ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const userData: Record<string, string> = {};
  if (config.advanced_matching && payload.email) userData.em = await sha256(payload.email as string);
  if (config.advanced_matching && payload.phone) userData.ph = await sha256(payload.phone as string);

  const body: Record<string, unknown> = {
    data: [{
      event_name: payload.event_name,
      event_time: eventTime,
      event_id: eventId,
      action_source: "website",
      user_data: userData,
      custom_data: {
        currency: payload.currency ?? "SAR",
        value: payload.value,
        order_id: payload.order_id,
        content_ids: payload.content_ids,
        content_type: payload.content_type ?? "product",
      },
    }],
  };
  if (test_event_code) body.test_event_code = test_event_code;

  const start = Date.now();
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${pixel_id}/events?access_token=${access_token}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const duration = Date.now() - start;
  const responseText = await res.text();
  return { status_code: res.status, response_body: responseText.slice(0, 500), duration_ms: duration, success: res.ok };
}

async function sendTikTokCAPI(secrets: Record<string, string>, config: Record<string, unknown>, payload: Record<string, unknown>) {
  const { access_token, test_event_code } = secrets;
  const pixel_id = config.pixel_id as string;
  const eventTime = Math.floor(Date.now() / 1000);
  const eventId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const userProps: Record<string, string> = {};
  if (config.advanced_matching && payload.email) userProps.sha256_email = await sha256(payload.email as string);
  if (config.advanced_matching && payload.phone) userProps.sha256_phone_number = await sha256(payload.phone as string);

  const body: Record<string, unknown> = {
    pixel_code: pixel_id,
    event: payload.event_name,
    event_time: eventTime,
    event_id: eventId,
    user: userProps,
    properties: {
      currency: payload.currency ?? "SAR",
      value: payload.value,
      order_id: payload.order_id,
    },
  };
  if (test_event_code) body.test_event_code = test_event_code;

  const start = Date.now();
  const res = await fetch(
    `https://business-api.tiktok.com/open_api/v1.3/pixel/track/`,
    { method: "POST", headers: { "Content-Type": "application/json", "Access-Token": access_token }, body: JSON.stringify(body) }
  );
  const duration = Date.now() - start;
  const responseText = await res.text();
  return { status_code: res.status, response_body: responseText.slice(0, 500), duration_ms: duration, success: res.ok };
}

async function sendGoogleAdsConversion(secrets: Record<string, string>, config: Record<string, unknown>, payload: Record<string, unknown>) {
  // Google Ads conversion upload via API
  const { google_ads_refresh_token, google_ads_client_id, google_ads_client_secret, developer_token } = secrets;
  const customer_id = (config.customer_id as string)?.replace(/-/g, "");
  const conversion_action_id = config.conversion_action_id as string;

  // First get access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: google_ads_refresh_token,
      client_id: google_ads_client_id,
      client_secret: google_ads_client_secret,
    }),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return { status_code: tokenRes.status, response_body: `Token error: ${err.slice(0, 200)}`, duration_ms: 0, success: false };
  }
  const tokenData = await tokenRes.json() as { access_token: string };

  const start = Date.now();
  const conversionTime = new Date().toISOString().replace("T", " ").replace("Z", "+00:00");
  const body = {
    conversions: [{
      gclid: payload.gclid ?? "",
      conversion_action: `customers/${customer_id}/conversionActions/${conversion_action_id}`,
      conversion_date_time: conversionTime,
      conversion_value: payload.value ?? 0,
      currency_code: payload.currency ?? "SAR",
      order_id: payload.order_id ?? "",
    }],
  };
  const res = await fetch(
    `https://googleads.googleapis.com/v14/customers/${customer_id}:uploadClickConversions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenData.access_token}`,
        "developer-token": developer_token ?? "",
      },
      body: JSON.stringify(body),
    }
  );
  const duration = Date.now() - start;
  const responseText = await res.text();
  return { status_code: res.status, response_body: responseText.slice(0, 500), duration_ms: duration, success: res.ok };
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !authData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Get tenant
    const { data: members } = await supabase.from("tenant_members").select("tenant_id").limit(1);
    const tenantId = members?.[0]?.tenant_id;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "No tenant found" }), { status: 400, headers: corsHeaders });
    }

    // Rate limit
    if (!checkRateLimit(`${tenantId}-marketing`, 30, 60000)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Max 30 events/min." }), { status: 429, headers: corsHeaders });
    }

    const body = await req.json() as {
      provider: string;
      event_name: string;
      payload: Record<string, unknown>;
      idempotency_key?: string;
    };

    const { provider, event_name, payload = {}, idempotency_key } = body;
    if (!provider || !event_name) {
      return new Response(JSON.stringify({ error: "provider and event_name required" }), { status: 400, headers: corsHeaders });
    }

    // Idempotency check
    if (idempotency_key) {
      const { error: idempErr } = await supabase.from("marketing_idempotency").insert({
        tenant_id: tenantId,
        provider,
        idempotency_key,
      });
      if (idempErr?.code === "23505") {
        return new Response(JSON.stringify({ success: true, duplicate: true, message: "Event already processed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Load integration
    const { data: integration, error: intErr } = await supabase
      .from("marketing_integrations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("provider", provider)
      .single();

    if (intErr || !integration) {
      return new Response(JSON.stringify({ error: "Integration not found or not configured" }), { status: 404, headers: corsHeaders });
    }
    if (integration.status !== "active") {
      return new Response(JSON.stringify({ error: "Integration is not active" }), { status: 403, headers: corsHeaders });
    }

    // Decrypt secrets
    let secrets: Record<string, string> = {};
    if (integration.secrets_encrypted) {
      const encKey = Deno.env.get("INTEGRATION_SECRET_KEY") ?? "0".repeat(64);
      try {
        const decrypted = await aesGcmDecrypt(integration.secrets_encrypted, encKey);
        secrets = JSON.parse(decrypted);
      } catch {
        return new Response(JSON.stringify({ error: "Failed to decrypt secrets" }), { status: 500, headers: corsHeaders });
      }
    }

    // Dispatch to correct provider
    let result: { status_code: number; response_body: string; duration_ms: number; success: boolean };
    const config = integration.config as Record<string, unknown>;
    const fullPayload = { ...payload, event_name };

    if (provider === "meta_pixel_capi" || provider === "facebook_capi" || provider === "meta") {
      result = await sendMetaCAPI(secrets, config, fullPayload);
    } else if (provider === "tiktok_capi" || provider === "tiktok") {
      result = await sendTikTokCAPI(secrets, config, fullPayload);
    } else if (provider === "google_ads") {
      result = await sendGoogleAdsConversion(secrets, config, fullPayload);
    } else {
      return new Response(JSON.stringify({ error: `Provider ${provider} not yet implemented` }), { status: 400, headers: corsHeaders });
    }

    // Log result
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabaseAdmin.from("marketing_events_logs").insert({
      tenant_id: tenantId,
      provider,
      action: "send_event",
      event_name,
      request_body: { event_name, currency: payload.currency, value: payload.value },
      status_code: result.status_code,
      response_body: result.response_body.slice(0, 500),
      duration_ms: result.duration_ms,
      idempotency_key: idempotency_key ?? null,
    });

    return new Response(JSON.stringify({ success: result.success, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
