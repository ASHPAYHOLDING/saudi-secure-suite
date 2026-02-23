/**
 * whatsapp-webhook
 * Receives Meta Cloud API webhook callbacks for delivery status updates.
 * Public endpoint — verifies via hub.verify_token for subscription,
 * and processes status updates (sent/delivered/read/failed).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_VERIFY_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") || "numaxio-wa-verify-2024";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET = Meta webhook verification (hub challenge)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
      console.log("Webhook verified successfully");
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // POST = status update from Meta
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const entries = body?.entry || [];
      let processed = 0;

      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const value = change?.value;
          if (!value) continue;

          // Process status updates
          const statuses = value?.statuses || [];
          for (const status of statuses) {
            const providerMsgId = status.id;
            const recipientPhone = status.recipient_id;
            const statusValue = status.status; // sent, delivered, read, failed
            const timestamp = status.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString();

            // Map Meta status to our status
            const statusMap: Record<string, string> = {
              sent: "sent",
              delivered: "delivered",
              read: "read",
              failed: "failed",
            };

            const mappedStatus = statusMap[statusValue] || statusValue;

            // Build update payload
            const updateData: Record<string, any> = {
              status: mappedStatus,
              updated_at: new Date().toISOString(),
            };

            if (mappedStatus === "delivered") updateData.delivered_at = timestamp;
            if (mappedStatus === "read") updateData.read_at = timestamp;
            if (mappedStatus === "failed") {
              updateData.failed_at = timestamp;
              const errors = status.errors || [];
              if (errors.length > 0) {
                updateData.error_code = String(errors[0].code || "");
                updateData.error_message = errors[0].title || errors[0].message || "Unknown error";
              }
            }

            // Update whatsapp_message_log
            const { error: logErr } = await admin
              .from("whatsapp_message_log")
              .update(updateData)
              .eq("provider_message_id", providerMsgId);

            if (logErr) {
              console.error(`Failed to update message log for ${providerMsgId}:`, logErr.message);
            }

            // Also update notification_outbox if exists
            await admin
              .from("notification_outbox")
              .update({ status: mappedStatus === "read" ? "delivered" : mappedStatus })
              .eq("provider_message_id", providerMsgId);

            processed++;
          }

          // Process errors at the message level
          const errors = value?.errors || [];
          for (const error of errors) {
            console.error("WhatsApp API error:", JSON.stringify(error));
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, processed }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("whatsapp-webhook error:", err);
      // Always return 200 to Meta to avoid retry floods
      return new Response(
        JSON.stringify({ error: "Internal error", received: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
