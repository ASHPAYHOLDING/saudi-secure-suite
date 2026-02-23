/**
 * notify-worker — Processes the unified notification_event_outbox.
 *
 * Channels:
 *   in_app  → inserts into user_notifications + tenant_notifications
 *   email   → routes to platform SMTP (Resend) or tenant SMTP based on email_mode
 *   whatsapp → stub adapter; marks as skipped if not configured
 *
 * Features:
 *   - Atomic row locking via claim_outbox_batch RPC (SELECT FOR UPDATE SKIP LOCKED)
 *   - Exponential backoff retries (2^n minutes, capped at 6h)
 *   - Idempotent processing
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptSecret } from "../_shared/aes-gcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const INTEGRATION_SECRET_KEY = Deno.env.get("INTEGRATION_SECRET_KEY") || "";

const MAX_BACKOFF_SECONDS = 6 * 60 * 60; // 6 hours

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // ── 1) Claim batch of outbox rows ──
    const { data: batch, error: claimErr } = await admin.rpc("claim_outbox_batch", { p_limit: 50 });

    if (claimErr || !batch?.length) {
      return json({ processed: 0, message: claimErr?.message || "No pending items" });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of batch) {
      const channel = row.channel;
      const payload = row.payload || {};
      const recipient = row.recipient || {};

      let result: { success: boolean; provider_message_id?: string; error?: string; skip?: boolean };

      try {
        switch (channel) {
          case "in_app":
            result = await handleInApp(admin, row, payload, recipient);
            break;
          case "email":
            result = await handleEmail(admin, row, payload, recipient);
            break;
          case "whatsapp":
            result = await handleWhatsApp(admin, row, payload, recipient);
            break;
          default:
            result = { success: false, error: `Unknown channel: ${channel}` };
        }
      } catch (err) {
        result = { success: false, error: err instanceof Error ? err.message : String(err) };
      }

      // ── Update outbox row ──
      if (result.skip) {
        await admin.from("notification_event_outbox").update({
          status: "skipped",
          error: result.error || "channel_not_configured",
          meta: { ...(row.meta || {}), skipped_at: new Date().toISOString() },
        }).eq("id", row.id);
        skipped++;
      } else if (result.success) {
        await admin.from("notification_event_outbox").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: result.provider_message_id || null,
          error: null,
        }).eq("id", row.id);
        sent++;
      } else {
        const newAttempts = (row.attempt_count || 0) + 1;
        const backoffSeconds = Math.min(Math.pow(2, newAttempts) * 60, MAX_BACKOFF_SECONDS);
        const nextAttempt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

        await admin.from("notification_event_outbox").update({
          status: "failed",
          attempt_count: newAttempts,
          next_attempt_at: nextAttempt,
          error: result.error || "Unknown error",
        }).eq("id", row.id);
        failed++;
      }
    }

    return json({ processed: batch.length, sent, failed, skipped });
  } catch (err) {
    console.error("notify-worker error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

// ═══════════════════════════════════════════
// Channel Handlers
// ═══════════════════════════════════════════

async function handleInApp(
  admin: any,
  row: any,
  payload: any,
  recipient: any
): Promise<{ success: boolean; provider_message_id?: string; error?: string }> {
  const userId = recipient.value || payload.user_id;
  if (!userId) return { success: false, error: "No user_id for in_app" };

  // Insert user notification
  const { error: userErr } = await admin.from("user_notifications").insert({
    tenant_id: row.tenant_id,
    user_id: userId,
    type: row.event_key?.split("_")[0] || "info",
    title: payload.subject || row.event_key,
    body: payload.body || "",
    link: payload.deep_link || null,
    event_key: row.event_key,
    metadata: payload.variables || {},
    is_read: false,
  });

  if (userErr) return { success: false, error: userErr.message };

  // Also create tenant-level notification
  await admin.from("tenant_notifications").insert({
    tenant_id: row.tenant_id,
    type: row.event_key?.split("_")[0] || "info",
    title: payload.subject || row.event_key,
    message: payload.body || "",
    severity: "info",
    link: payload.deep_link || null,
    event_key: row.event_key,
    metadata: payload.variables || {},
  });

  return { success: true, provider_message_id: `inapp-${Date.now()}` };
}

async function handleEmail(
  admin: any,
  row: any,
  payload: any,
  recipient: any
): Promise<{ success: boolean; provider_message_id?: string; error?: string }> {
  const toEmail = recipient.value;
  if (!toEmail) return { success: false, error: "No email address" };

  const emailMode = row.email_mode || "platform";

  if (emailMode === "tenant_smtp") {
    // Load tenant SMTP config
    const { data: provider } = await admin
      .from("email_providers")
      .select("*")
      .eq("tenant_id", row.tenant_id)
      .eq("scope", "tenant")
      .eq("is_active", true)
      .maybeSingle();

    if (!provider) {
      // Fail-closed: tenant SMTP not configured/active
      return { success: false, error: "tenant_smtp_inactive" };
    }

    return await sendViaTenantSMTP(provider, toEmail, payload);
  } else {
    // Platform SMTP via Resend
    return await sendViaResend(toEmail, payload);
  }
}

async function handleWhatsApp(
  admin: any,
  row: any,
  payload: any,
  recipient: any
): Promise<{ success: boolean; provider_message_id?: string; error?: string; skip?: boolean }> {
  const phone = recipient.value;
  if (!phone) return { success: false, error: "No phone number", skip: true };

  // Check if tenant has WhatsApp configured
  const { data: waAccount } = await admin
    .from("tenant_whatsapp_accounts")
    .select("id, status")
    .eq("tenant_id", row.tenant_id)
    .eq("status", "active")
    .maybeSingle();

  if (!waAccount) {
    // Stub: WhatsApp not configured → skip
    return { success: false, error: "whatsapp_not_configured", skip: true };
  }

  // TODO: Implement actual WhatsApp sending via Meta Cloud API
  // For now, mark as skipped with reason
  return { success: false, error: "whatsapp_adapter_not_implemented", skip: true };
}

// ═══════════════════════════════════════════
// SMTP Senders
// ═══════════════════════════════════════════

async function sendViaResend(
  toEmail: string,
  payload: any
): Promise<{ success: boolean; provider_message_id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const htmlBody = buildEmailHtml(payload.subject || "", payload.body || "", payload.deep_link);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Numaxio <no-reply@numaxio.com>",
        to: [toEmail],
        subject: payload.subject || "Notification",
        html: htmlBody,
      }),
    });

    const data = await res.json();
    if (!res.ok) return { success: false, error: JSON.stringify(data) };
    return { success: true, provider_message_id: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Resend error" };
  }
}

async function sendViaTenantSMTP(
  provider: any,
  toEmail: string,
  payload: any
): Promise<{ success: boolean; provider_message_id?: string; error?: string }> {
  try {
    const password = await decryptSecret(provider.smtp_password_encrypted, INTEGRATION_SECRET_KEY);
    const htmlBody = buildEmailHtml(payload.subject || "", payload.body || "", payload.deep_link);

    const conn = await Deno.connect({
      hostname: provider.smtp_host,
      port: provider.smtp_port,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function read(): Promise<string> {
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n || 0));
    }

    async function send(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + "\r\n"));
      return await read();
    }

    await read(); // greeting
    await send("EHLO numaxio.com");
    await send("AUTH LOGIN");
    await send(btoa(provider.smtp_username));
    const authResp = await send(btoa(password));

    if (!authResp.startsWith("235")) {
      conn.close();
      return { success: false, error: "SMTP auth failed: " + authResp.trim() };
    }

    const fromEmail = provider.from_email;
    const fromName = provider.from_name_ar || provider.from_name_en || "System";
    await send(`MAIL FROM:<${fromEmail}>`);
    await send(`RCPT TO:<${toEmail}>`);
    await send("DATA");

    const subject = payload.subject || "Notification";
    const emailData = [
      `From: ${fromName} <${fromEmail}>`,
      `To: <${toEmail}>`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      htmlBody,
      `.`,
    ].join("\r\n");

    const dataResp = await send(emailData);
    await send("QUIT");
    conn.close();

    if (dataResp.startsWith("250")) {
      return { success: true, provider_message_id: `smtp-${Date.now()}` };
    }
    return { success: false, error: "SMTP send failed: " + dataResp.trim() };
  } catch (err) {
    return { success: false, error: `SMTP error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function buildEmailHtml(title: string, body: string, link?: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin:0; padding:0; background:#f4f5f7; font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif; direction:rtl; }
  .container { max-width:600px; margin:0 auto; padding:24px 16px; }
  .card { background:#fff; border-radius:8px; border:1px solid #e2e8f0; overflow:hidden; }
  .header { background:#0f172a; color:#fff; padding:20px 24px; }
  .header h1 { margin:0; font-size:17px; font-weight:600; }
  .body { padding:24px; }
  .body p { margin:0 0 12px; font-size:14px; line-height:1.8; color:#334155; }
  .btn { display:inline-block; background:#0f172a; color:#fff; padding:10px 24px; border-radius:6px; text-decoration:none; font-size:13px; font-weight:600; }
  .footer { padding:16px 24px; text-align:center; }
  .footer p { margin:0; font-size:11px; color:#94a3b8; }
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <div class="header"><h1>${title}</h1></div>
    <div class="body">
      <p>${body}</p>
      ${link ? `<p style="text-align:center;"><a class="btn" href="${link}">عرض التفاصيل</a></p>` : ""}
    </div>
  </div>
  <div class="footer">
    <p>هذه رسالة تشغيلية آلية – لا تتطلب رداً</p>
    <p>© ${new Date().getFullYear()} Numaxio</p>
  </div>
</div>
</body>
</html>`;
}
