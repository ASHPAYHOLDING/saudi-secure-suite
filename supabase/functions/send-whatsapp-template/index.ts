/**
 * send-whatsapp-template
 * Sends a WhatsApp template message via Meta Cloud API.
 * Supports Platform mode (Option A) and Tenant mode (Option B).
 * Checks opt-in compliance before sending.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WA_ENCRYPTION_KEY = Deno.env.get("WA_ENCRYPTION_KEY") || "numaxio-wa-default-key-change-me";

function decryptToken(encrypted: string): string {
  const keyBytes = new TextEncoder().encode(WA_ENCRYPTION_KEY);
  const encBytes = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const decrypted = new Uint8Array(encBytes.length);
  for (let i = 0; i < encBytes.length; i++) {
    decrypted[i] = encBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      tenant_id,
      to_phone,
      template_name,
      language_code = "ar",
      components = [],
      template_key = "manual_send",
      skip_optin_check = false,
    } = await req.json();

    if (!tenant_id || !to_phone || !template_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedPhone = to_phone.replace(/[^0-9+]/g, "").replace(/^\+/, "");

    // ── Opt-in compliance check ──
    if (!skip_optin_check) {
      const { data: optinRecord } = await admin
        .from("whatsapp_optins")
        .select("opted_in")
        .eq("tenant_id", tenant_id)
        .eq("phone_e164", normalizedPhone)
        .maybeSingle();

      if (!optinRecord?.opted_in) {
        // Check with + prefix too
        const { data: optinAlt } = await admin
          .from("whatsapp_optins")
          .select("opted_in")
          .eq("tenant_id", tenant_id)
          .eq("phone_e164", `+${normalizedPhone}`)
          .maybeSingle();

        if (!optinAlt?.opted_in) {
          await admin.from("notification_outbox").insert({
            tenant_id,
            channel: "whatsapp",
            template_key,
            recipient: to_phone,
            payload_json: { template_name, language_code, components },
            status: "blocked",
            block_reason: "no_optin",
            error: "Recipient has not opted in to WhatsApp notifications",
          });

          // Log to message log too
          await admin.from("whatsapp_message_log").insert({
            tenant_id,
            to_phone: normalizedPhone,
            template_key,
            template_name,
            language_code,
            status: "failed",
            error_code: "NO_OPTIN",
            error_message: "Recipient has not opted in",
          });

          return new Response(
            JSON.stringify({ error: "Recipient not opted in", status: "blocked", reason: "no_optin" }),
            { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // ── Determine WhatsApp config: Platform (A) or Tenant (B) ──
    let wabaId: string;
    let phoneNumberId: string;
    let accessToken: string;
    let mode = "platform";

    // First check tenant-specific account
    const { data: tenantWa } = await admin
      .from("tenant_whatsapp_accounts")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .maybeSingle();

    if (tenantWa) {
      mode = "tenant";
      wabaId = tenantWa.waba_id;
      phoneNumberId = tenantWa.phone_number_id;
      accessToken = decryptToken(tenantWa.access_token_encrypted);
    } else {
      // Fallback to platform config (Option A)
      const { data: platformConfig } = await admin
        .from("platform_whatsapp_config")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!platformConfig) {
        await admin.from("notification_outbox").insert({
          tenant_id,
          channel: "whatsapp",
          template_key,
          recipient: to_phone,
          payload_json: { template_name, language_code, components },
          status: "blocked",
          block_reason: "whatsapp_not_configured",
          error: "No WhatsApp configuration available",
        });

        return new Response(
          JSON.stringify({ error: "WhatsApp not configured", status: "blocked" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      wabaId = platformConfig.waba_id;
      phoneNumberId = platformConfig.phone_number_id;
      accessToken = decryptToken(platformConfig.access_token_encrypted);
    }

    // ── Rate limit check ──
    const { data: rateLimit } = await admin
      .from("notification_rate_limits")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("channel", "whatsapp")
      .maybeSingle();

    if (rateLimit) {
      const today = new Date().toISOString().split("T")[0];
      const thisMonth = today.substring(0, 7);
      let dailyCount = rateLimit.daily_count;
      let monthlyCount = rateLimit.monthly_count;

      if (rateLimit.last_reset_daily !== today) dailyCount = 0;
      if (rateLimit.last_reset_monthly?.substring(0, 7) !== thisMonth) monthlyCount = 0;

      if (dailyCount >= rateLimit.daily_limit || monthlyCount >= rateLimit.monthly_limit) {
        await admin.from("notification_outbox").insert({
          tenant_id,
          channel: "whatsapp",
          template_key,
          recipient: to_phone,
          payload_json: { template_name, language_code, components },
          status: "blocked",
          block_reason: "rate_limit_exceeded",
          error: `Daily: ${dailyCount}/${rateLimit.daily_limit}, Monthly: ${monthlyCount}/${rateLimit.monthly_limit}`,
        });

        return new Response(
          JSON.stringify({ error: "Rate limit exceeded", status: "blocked" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Send via Meta Cloud API ──
    const metaPayload = {
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "template",
      template: {
        name: template_name,
        language: { code: language_code },
        components: components.length > 0 ? components : undefined,
      },
    };

    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaPayload),
      }
    );

    const metaData = await metaRes.json();

    let status: string;
    let providerMsgId: string | null = null;
    let error: string | null = null;

    if (metaData.messages?.[0]?.id) {
      status = "sent";
      providerMsgId = metaData.messages[0].id;
    } else {
      status = "failed";
      error = metaData.error?.message || JSON.stringify(metaData);
    }

    // ── Log to outbox ──
    const { data: outboxRow } = await admin.from("notification_outbox").insert({
      tenant_id,
      channel: "whatsapp",
      template_key,
      recipient: to_phone,
      payload_json: { template_name, language_code, components, mode },
      status,
      provider_message_id: providerMsgId,
      error,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    }).select("id").maybeSingle();

    // ── Log to whatsapp_message_log ──
    await admin.from("whatsapp_message_log").insert({
      tenant_id,
      to_phone: normalizedPhone,
      provider_message_id: providerMsgId,
      template_key,
      template_name,
      language_code,
      status,
      error_code: status === "failed" ? (metaData.error?.code?.toString() || "UNKNOWN") : null,
      error_message: error,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      outbox_id: outboxRow?.id || null,
    });

    // ── Update rate limits ──
    if (status === "sent" && rateLimit) {
      const today = new Date().toISOString().split("T")[0];
      await admin.rpc("increment_notification_rate_limit" as any, {
        p_tenant_id: tenant_id,
        p_channel: "whatsapp",
      }).catch(() => {
        admin.from("notification_rate_limits")
          .update({
            daily_count: (rateLimit.last_reset_daily === today ? rateLimit.daily_count : 0) + 1,
            monthly_count: rateLimit.monthly_count + 1,
            last_reset_daily: today,
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", tenant_id)
          .eq("channel", "whatsapp");
      });
    }

    return new Response(
      JSON.stringify({
        success: status === "sent",
        status,
        mode,
        provider_message_id: providerMsgId,
        error,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-whatsapp-template error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
