/**
 * meta-capi — Meta (Facebook) Conversions API Edge Function
 *
 * يُرسل Server-side events إلى Meta Graph API
 * ويسجّل النتائج في marketing_events_logs
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── AES-GCM decrypt ───────────────────────────────────────────────────────────
async function aesGcmDecrypt(base64Cipher: string, keyHex: string): Promise<string> {
  const combined = Uint8Array.from(atob(base64Cipher), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const cipherData = combined.slice(12);
  const keyBytes = new Uint8Array(
    keyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
  );
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    cipherData.buffer as ArrayBuffer
  );
  return new TextDecoder().decode(plain);
}

// ── SHA-256 hash (for Advanced Matching) ─────────────────────────────────────
async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.toLowerCase().trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Rate Limiting (30 events/min per tenant) ──────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(tenantId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(tenantId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(tenantId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

// ── Main Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Tenant ────────────────────────────────────────────────────────────────
  const { data: memberRow } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();
  if (!memberRow) {
    return new Response(JSON.stringify({ error: "No tenant" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const tenantId: string = memberRow.tenant_id;

  // ── Rate limit ────────────────────────────────────────────────────────────
  if (!checkRateLimit(tenantId)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();

  // ── Save config action ────────────────────────────────────────────────────
  if (body._action === "save_config") {
    const { config, access_token } = body;
    const encKey = Deno.env.get("INTEGRATION_ENCRYPTION_KEY") ?? "0".repeat(64);

    let secrets_encrypted: string | undefined;
    if (access_token) {
      // Re-encrypt using server key (not client-side fallback key)
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const keyBytes = new Uint8Array(
        encKey.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
      );
      const cryptoKey = await crypto.subtle.importKey(
        "raw", keyBytes.buffer as ArrayBuffer, { name: "AES-GCM" }, false, ["encrypt"]
      );
      const cipher = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv }, cryptoKey,
        new TextEncoder().encode(JSON.stringify({ access_token, test_event_code: config.test_event_code }))
      );
      const combined = new Uint8Array(12 + cipher.byteLength);
      combined.set(iv, 0); combined.set(new Uint8Array(cipher), 12);
      secrets_encrypted = btoa(String.fromCharCode(...Array.from(combined)));
    }

    const { error } = await supabase
      .from("tenant_marketing_integrations")
      .upsert({
        tenant_id: tenantId,
        provider: "meta",
        config,
        status: "connected",
        updated_at: new Date().toISOString(),
        ...(secrets_encrypted ? { secrets_encrypted } : {}),
      }, { onConflict: "tenant_id,provider" });

    if (error) return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Fetch integration record ──────────────────────────────────────────────
  const { data: integration } = await supabase
    .from("tenant_marketing_integrations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("provider", "meta")
    .single();

  if (!integration) {
    return new Response(JSON.stringify({ error: "Meta integration not configured" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (integration.status !== "active") {
    return new Response(JSON.stringify({ error: "Integration is not active" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Decrypt secrets ───────────────────────────────────────────────────────
  const encKey = Deno.env.get("INTEGRATION_ENCRYPTION_KEY") ?? "0".repeat(64);
  let accessToken = "";
  let testEventCode = "";
  try {
    if (integration.secrets_encrypted) {
      const secrets = JSON.parse(await aesGcmDecrypt(integration.secrets_encrypted, encKey));
      accessToken = secrets.access_token ?? "";
      testEventCode = secrets.test_event_code ?? "";
    }
  } catch {
    return new Response(JSON.stringify({ error: "Failed to decrypt secrets" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Access token not configured" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const config = (integration.config ?? {}) as Record<string, unknown>;
  const pixelId = config.pixel_id as string;
  const advancedMatching = config.advanced_matching as boolean ?? false;
  const serverEventsEnabled = config.server_events_enabled as boolean ?? true;

  if (!serverEventsEnabled) {
    return new Response(JSON.stringify({ error: "Server events are disabled" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Build event payload ───────────────────────────────────────────────────
  const {
    event_name,
    properties = {},
    user_data = {},
    event_id,
  } = body;

  if (!event_name) {
    return new Response(JSON.stringify({ error: "event_name is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const finalEventId = event_id ?? `meta_${tenantId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Build user_data with optional Advanced Matching hashes
  const userData: Record<string, string> = {};
  if (advancedMatching) {
    if (user_data.email) userData.em = await sha256(user_data.email);
    if (user_data.phone) userData.ph = await sha256(user_data.phone.replace(/\D/g, ""));
    if (user_data.first_name) userData.fn = await sha256(user_data.first_name);
    if (user_data.last_name) userData.ln = await sha256(user_data.last_name);
  }
  userData.client_user_agent = user_data.user_agent ?? "Numaxio-Server/1.0";

  const eventPayload: Record<string, unknown> = {
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: finalEventId,
    action_source: "website",
    user_data: userData,
    custom_data: {
      currency: properties.currency ?? "SAR",
      value: properties.value ?? 0,
      order_id: properties.order_id ?? finalEventId,
      ...properties,
    },
  };

  // ── POST to Meta CAPI ─────────────────────────────────────────────────────
  const metaApiVersion = "v21.0";
  const metaUrl = `https://graph.facebook.com/${metaApiVersion}/${pixelId}/events?access_token=${accessToken}`;

  const metaBody: Record<string, unknown> = { data: [eventPayload] };
  if (testEventCode) metaBody.test_event_code = testEventCode;

  const t0 = Date.now();
  let statusCode = 0;
  let responseBody = "";
  let success = false;

  try {
    const res = await fetch(metaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metaBody),
    });
    statusCode = res.status;
    const json = await res.json();
    responseBody = JSON.stringify(json).slice(0, 500);
    success = res.ok;
  } catch (fetchErr) {
    responseBody = String(fetchErr);
    statusCode = 0;
  }

  const durationMs = Date.now() - t0;

  // ── Log to marketing_events_logs ──────────────────────────────────────────
  await supabase.from("marketing_events_logs").insert({
    tenant_id: tenantId,
    provider: "meta",
    event_name,
    status_code: statusCode,
    response_body: responseBody,
    duration_ms: durationMs,
  });

  return new Response(
    JSON.stringify({ success, status_code: statusCode, response: responseBody, duration_ms: durationMs, event_id: finalEventId }),
    { status: success ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
