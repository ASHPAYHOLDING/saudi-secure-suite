/**
 * Email Worker — processes queued email_jobs.
 * Supports:
 *   - Platform emails via Resend API
 *   - Tenant SMTP via direct SMTP connection
 *   - Retry with exponential backoff (1m, 5m, 15m, 1h, 6h)
 *   - Audit logging to email_logs
 * 
 * Triggered by cron (every 2 minutes) or manually.
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
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const INTEGRATION_SECRET_KEY = Deno.env.get("INTEGRATION_SECRET_KEY")!;

// Retry intervals in seconds: 1m, 5m, 15m, 1h, 6h
const RETRY_INTERVALS = [60, 300, 900, 3600, 21600];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const now = new Date().toISOString();

    // ── 1) Fetch queued/retry jobs ──
    const { data: jobs, error: fetchErr } = await admin
      .from("email_jobs")
      .select("*")
      .or(`status.eq.queued,and(status.eq.retry,next_retry_at.lte.${now})`)
      .lte("scheduled_at", now)
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchErr || !jobs?.length) {
      return new Response(JSON.stringify({ processed: 0, message: fetchErr?.message || "No jobs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const job of jobs) {
      // Mark as sending
      await admin.from("email_jobs").update({ status: "sending" }).eq("id", job.id);

      const startTime = Date.now();
      let result: { success: boolean; providerId?: string; error?: string };

      try {
        if (job.provider_id) {
          // Look up provider config
          const { data: provider } = await admin
            .from("email_providers")
            .select("*")
            .eq("id", job.provider_id)
            .single();

          if (provider && provider.scope === "tenant") {
            // Send via tenant SMTP
            result = await sendViaSMTP(provider, job);
          } else {
            // Platform provider or unknown → Resend
            result = await sendViaResend(job);
          }
        } else {
          // No provider → default to Resend (platform)
          result = await sendViaResend(job);
        }
      } catch (err) {
        result = { success: false, error: err instanceof Error ? err.message : "Unknown error" };
      }

      const latencyMs = Date.now() - startTime;

      if (result.success) {
        await admin.from("email_jobs").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: null,
        }).eq("id", job.id);
        sent++;
      } else {
        const newAttempts = (job.attempts || 0) + 1;
        if (newAttempts >= job.max_attempts) {
          await admin.from("email_jobs").update({
            status: "failed",
            attempts: newAttempts,
            last_error: result.error || "Max retries exceeded",
          }).eq("id", job.id);
          failed++;
        } else {
          const retryDelay = RETRY_INTERVALS[Math.min(newAttempts - 1, RETRY_INTERVALS.length - 1)];
          const nextRetry = new Date(Date.now() + retryDelay * 1000).toISOString();
          await admin.from("email_jobs").update({
            status: "retry",
            attempts: newAttempts,
            last_error: result.error,
            next_retry_at: nextRetry,
          }).eq("id", job.id);
        }
      }

      // ── Audit log ──
      await admin.from("email_logs").insert({
        tenant_id: job.tenant_id,
        email_type: job.event_key || "notification",
        sender_address: "system",
        recipient_email: job.to_email,
        subject: job.subject,
        status: result.success ? "sent" : "failed",
        provider_id: result.providerId || null,
        failure_reason: result.success ? null : result.error,
        sent_at: result.success ? new Date().toISOString() : null,
        metadata: job.payload,
        job_id: job.id,
        provider_used: job.provider_id ? "tenant_smtp" : "resend",
        latency_ms: latencyMs,
        smtp_response_snippet: result.error?.substring(0, 200) || null,
      });
    }

    return new Response(JSON.stringify({ processed: jobs.length, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Email worker error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Send via Resend (Platform default) ──
async function sendViaResend(job: any): Promise<{ success: boolean; providerId?: string; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Numaxio <no-reply@numaxio.com>",
        to: [job.to_email],
        subject: job.subject,
        html: job.html_body,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: JSON.stringify(data) };
    }
    return { success: true, providerId: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Resend error" };
  }
}

// ── Send via Tenant SMTP ──
async function sendViaSMTP(
  provider: any,
  job: any
): Promise<{ success: boolean; providerId?: string; error?: string }> {
  try {
    // Decrypt password
    const password = await decryptSecret(provider.smtp_password_encrypted, INTEGRATION_SECRET_KEY);

    // Use Deno's built-in SMTP (via fetch to smtp-relay or direct)
    // For edge functions, we use a lightweight SMTP approach via net API
    const conn = await Deno.connect({
      hostname: provider.smtp_host,
      port: provider.smtp_port,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function readResponse(): Promise<string> {
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n || 0));
    }

    async function sendCommand(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + "\r\n"));
      return await readResponse();
    }

    // SMTP handshake
    await readResponse(); // greeting
    await sendCommand(`EHLO numaxio.com`);
    
    // AUTH LOGIN
    await sendCommand("AUTH LOGIN");
    await sendCommand(btoa(provider.smtp_username));
    const authResp = await sendCommand(btoa(password));
    
    if (!authResp.startsWith("235")) {
      conn.close();
      return { success: false, error: "SMTP auth failed: " + authResp.trim() };
    }

    const fromEmail = provider.from_email;
    await sendCommand(`MAIL FROM:<${fromEmail}>`);
    await sendCommand(`RCPT TO:<${job.to_email}>`);
    await sendCommand("DATA");

    const emailData = [
      `From: ${provider.from_name_ar || provider.from_name_en || "System"} <${fromEmail}>`,
      `To: ${job.to_name || job.to_email} <${job.to_email}>`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(job.subject)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      job.html_body,
      `.`,
    ].join("\r\n");

    const dataResp = await sendCommand(emailData);
    await sendCommand("QUIT");
    conn.close();

    if (dataResp.startsWith("250")) {
      return { success: true, providerId: `smtp-${Date.now()}` };
    }
    return { success: false, error: "SMTP send failed: " + dataResp.trim() };
  } catch (err) {
    return { success: false, error: `SMTP error: ${err instanceof Error ? err.message : String(err)}` };
  }
}
