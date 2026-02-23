/**
 * send-whatsapp-template
 * Sends a WhatsApp template message via Meta Cloud API.
 * Decrypts token server-side, never exposes it.
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

    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
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
    } = await req.json();

    if (!tenant_id || !to_phone || !template_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch WhatsApp account
    const { data: waAccount } = await admin
      .from("tenant_whatsapp_accounts")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .maybeSingle();

    if (!waAccount) {
      // Log blocked
      await admin.from("notification_outbox").insert({
        tenant_id,
        channel: "whatsapp",
        template_key,
        recipient: to_phone,
        payload_json: { template_name, language_code, components },
        status: "blocked",
        block_reason: "whatsapp_not_configured",
        error: "No active WhatsApp account",
      });

      return new Response(
        JSON.stringify({ error: "WhatsApp not configured or inactive", status: "blocked" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limits
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

      if (rateLimit.last_reset_daily !== today) {
        dailyCount = 0;
      }
      if (rateLimit.last_reset_monthly.substring(0, 7) !== thisMonth) {
        monthlyCount = 0;
      }

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

    // Decrypt token
    const token = decryptToken(waAccount.access_token_encrypted);

    // Send via Meta Cloud API
    const metaPayload = {
      messaging_product: "whatsapp",
      to: to_phone.replace(/[^0-9]/g, ""),
      type: "template",
      template: {
        name: template_name,
        language: { code: language_code },
        components: components.length > 0 ? components : undefined,
      },
    };

    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${waAccount.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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

    // Log to outbox
    await admin.from("notification_outbox").insert({
      tenant_id,
      channel: "whatsapp",
      template_key,
      recipient: to_phone,
      payload_json: { template_name, language_code, components },
      status,
      provider_message_id: providerMsgId,
      error,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    });

    // Update rate limits
    if (status === "sent" && rateLimit) {
      const today = new Date().toISOString().split("T")[0];
      await admin.rpc("increment_notification_rate_limit" as any, {
        p_tenant_id: tenant_id,
        p_channel: "whatsapp",
      }).catch(() => {
        // Fallback: manual update
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
