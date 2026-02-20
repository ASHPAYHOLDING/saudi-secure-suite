/**
 * tiktok-capi — TikTok Conversion API edge function
 * Handles sending events to TikTok CAPI with rate limiting,
 * encrypted credential retrieval, and event logging.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TIKTOK_CAPI_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";
const RATE_LIMIT_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

// ── AES-GCM decrypt helper ──────────────────────────────────────────────────
async function aesGcmDecrypt(encryptedB64: string, keyHex: string): Promise<string> {
  const keyBytes = hexToBytes(keyHex);
  const combined = base64ToBytes(encryptedB64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]
  );
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
  return new TextDecoder().decode(plain);
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

// ── sha256 hash helper ──────────────────────────────────────────────────────
async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const encKey = Deno.env.get("INTEGRATION_SECRET_KEY") ?? "0".repeat(64);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

    // ── Tenant ────────────────────────────────────────────────────────────
    const { data: member } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!member) return Response.json({ error: "No active tenant" }, { status: 403, headers: corsHeaders });
    const tenantId = member.tenant_id;

    // ── Rate limit ────────────────────────────────────────────────────────
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count: recentCount } = await supabase
      .from("marketing_events_logs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", windowStart);

    if ((recentCount ?? 0) >= RATE_LIMIT_REQUESTS) {
      return Response.json({ error: "Rate limit exceeded. Max 30 events/min." }, { status: 429, headers: corsHeaders });
    }

    // ── Parse body ────────────────────────────────────────────────────────
    const body = await req.json();
    const { event_name, properties = {} } = body;

    if (!event_name) {
      return Response.json({ error: "event_name is required" }, { status: 400, headers: corsHeaders });
    }

    // ── Load integration record ────────────────────────────────────────────
    const { data: integration } = await supabase
      .from("tenant_marketing_integrations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("provider", "tiktok")
      .single();

    if (!integration || integration.status === "disconnected") {
      return Response.json({ error: "TikTok integration not configured or inactive" }, { status: 400, headers: corsHeaders });
    }

    // ── Decrypt secrets ───────────────────────────────────────────────────
    let secrets: { access_token?: string; test_event_code?: string } = {};
    if (integration.secrets_encrypted) {
      try {
        const decrypted = await aesGcmDecrypt(integration.secrets_encrypted, encKey);
        secrets = JSON.parse(decrypted);
      } catch {
        return Response.json({ error: "Failed to decrypt secrets" }, { status: 500, headers: corsHeaders });
      }
    }

    if (!secrets.access_token) {
      return Response.json({ error: "Access Token not configured" }, { status: 400, headers: corsHeaders });
    }

    const config = (integration.config as Record<string, unknown>) ?? {};
    const pixelId = config.pixel_id as string;
    const testEventCode = secrets.test_event_code || (config.test_event_code as string) || "";
    const advancedMatching = config.advanced_matching as boolean ?? false;

    if (!pixelId) {
      return Response.json({ error: "Pixel ID not configured" }, { status: 400, headers: corsHeaders });
    }

    // ── Build event payload ───────────────────────────────────────────────
    const eventId = `${event_name}_${tenantId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = Math.floor(Date.now() / 1000);

    const userProps: Record<string, string> = {};
    if (advancedMatching && properties.email) {
      userProps.email = await sha256Hex(properties.email.trim().toLowerCase());
    }
    if (advancedMatching && properties.phone) {
      userProps.phone_number = await sha256Hex(properties.phone.replace(/\D/g, ""));
    }
    if (properties.ip) userProps.ip = properties.ip;
    if (properties.user_agent) userProps.user_agent = properties.user_agent;

    const eventPayload: Record<string, unknown> = {
      event: event_name,
      event_time: timestamp,
      event_id: eventId,
      user: userProps,
      properties: {
        currency: properties.currency ?? "SAR",
        value: properties.value ?? 0,
        content_type: properties.content_type ?? "product",
        order_id: properties.order_id ?? eventId,
        ...(properties.contents && { contents: properties.contents }),
      },
    };

    const capiPayload: Record<string, unknown> = {
      pixel_code: pixelId,
      timestamp: timestamp.toString(),
      events: [eventPayload],
    };
    if (testEventCode) capiPayload.test_event_code = testEventCode;

    // ── Send to TikTok CAPI ───────────────────────────────────────────────
    const startMs = Date.now();
    let statusCode = 0;
    let responseBody = "";

    try {
      const tikRes = await fetch(TIKTOK_CAPI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": secrets.access_token,
        },
        body: JSON.stringify(capiPayload),
      });
      statusCode = tikRes.status;
      const rawBody = await tikRes.json();
      responseBody = JSON.stringify(rawBody).slice(0, 500);
    } catch (fetchErr: unknown) {
      statusCode = 0;
      responseBody = String(fetchErr);
    }

    const durationMs = Date.now() - startMs;

    // ── Log result ────────────────────────────────────────────────────────
    await supabase.from("marketing_events_logs").insert({
      tenant_id: tenantId,
      provider: "tiktok",
      event_name,
      status_code: statusCode,
      response_body: responseBody,
      duration_ms: durationMs,
    });

    const success = statusCode >= 200 && statusCode < 300;
    return Response.json(
      { success, status_code: statusCode, event_id: eventId, duration_ms: durationMs, response: responseBody },
      { status: success ? 200 : 502, headers: corsHeaders }
    );
  } catch (err: unknown) {
    return Response.json({ error: String(err) }, { status: 500, headers: corsHeaders });
  }
});
