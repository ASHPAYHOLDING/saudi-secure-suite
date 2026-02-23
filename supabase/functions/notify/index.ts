/**
 * Unified Notification Dispatcher
 * Creates in-app notifications + enqueues email jobs atomically.
 * 
 * Scope rules:
 *   scope=platform → email via Platform SMTP (Resend) ONLY
 *   scope=tenant  → email via Tenant SMTP ONLY; if inactive → block + owner alert
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface NotifyRequest {
  event_key: string;
  tenant_id?: string;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
  email_subject?: string;
  email_html?: string;
  channels?: ("in_app" | "email" | "whatsapp")[];
  target_user_ids?: string[];
  target_roles?: string[];
  idempotency_key?: string;
  /** WhatsApp-specific fields */
  whatsapp_template_name?: string;
  whatsapp_language_code?: string;
  whatsapp_components?: any[];
  whatsapp_to_phones?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload: NotifyRequest = await req.json();
    const {
      event_key,
      tenant_id,
      title,
      body,
      link,
      metadata = {},
      email_subject,
      email_html,
      channels: overrideChannels,
      target_user_ids,
      target_roles,
      idempotency_key,
    } = payload;

    if (!event_key || !title) {
      return new Response(JSON.stringify({ error: "event_key and title required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1) Resolve event definition ──
    const { data: eventDef } = await admin
      .from("notification_events")
      .select("*")
      .eq("key", event_key)
      .eq("is_active", true)
      .maybeSingle();

    const scope = eventDef?.scope || (tenant_id ? "tenant" : "platform");
    const severity = eventDef?.severity || "info";
    const channels = overrideChannels || eventDef?.default_channels || ["in_app"];
    const audienceRoles = target_roles || eventDef?.default_audience_roles || [];

    // ── 2) Resolve target users ──
    let userIds: string[] = target_user_ids || [];

    if (userIds.length === 0 && tenant_id && audienceRoles.length > 0) {
      const { data: members } = await admin
        .from("tenant_members")
        .select("user_id, role")
        .eq("tenant_id", tenant_id);

      if (members) {
        userIds = members
          .filter((m: any) => audienceRoles.includes(m.role))
          .map((m: any) => m.user_id);
      }
    }

    // Fallback: if still no users and it's tenant scope, notify owner
    if (userIds.length === 0 && tenant_id) {
      const { data: owners } = await admin
        .from("tenant_members")
        .select("user_id")
        .eq("tenant_id", tenant_id)
        .eq("role", "owner");
      if (owners) {
        userIds = owners.map((o: any) => o.user_id);
      }
    }

    const results = { in_app: 0, email_queued: 0, skipped_email: 0, smtp_blocked: false, whatsapp_queued: 0, whatsapp_blocked: false };

    // ── 3) Create In-App Notifications ──
    if (channels.includes("in_app") && userIds.length > 0) {
      const notifRows = userIds.map((uid) => ({
        tenant_id: tenant_id!,
        user_id: uid,
        type: event_key.split(".")[0] || "info",
        title,
        body,
        link: link || null,
        event_key,
        metadata,
        is_read: false,
      }));

      const { error: insertErr } = await admin
        .from("user_notifications")
        .insert(notifRows);

      if (!insertErr) {
        results.in_app = notifRows.length;
      } else {
        console.error("In-app notification insert error:", insertErr.message);
      }
    }

    // Also create tenant-level notification for visibility
    if (channels.includes("in_app") && tenant_id) {
      await admin.from("tenant_notifications").insert({
        tenant_id,
        type: event_key.split(".")[0] || "info",
        title,
        message: body,
        severity,
        link,
        event_key,
        metadata,
      });
    }

    // ── 4) Enqueue Email Jobs ──
    if (channels.includes("email") && userIds.length > 0) {
      let providerId: string | null = null;
      let smtpBlocked = false;

      if (scope === "tenant" && tenant_id) {
        // Tenant emails MUST use tenant SMTP
        const { data: tenantProvider } = await admin
          .from("email_providers")
          .select("id, is_active")
          .eq("tenant_id", tenant_id)
          .eq("scope", "tenant")
          .maybeSingle();

        if (tenantProvider?.is_active) {
          providerId = tenantProvider.id;
        } else {
          // BLOCK: tenant SMTP not active → no email + warn owner
          smtpBlocked = true;
        }
      } else if (scope === "platform") {
        // Platform emails use platform SMTP (Resend) — no provider_id needed
        const { data: platformProvider } = await admin
          .from("email_providers")
          .select("id")
          .eq("scope", "platform")
          .eq("is_active", true)
          .maybeSingle();

        providerId = platformProvider?.id || null;
        // Platform emails always go through Resend even without DB provider
      }

      if (smtpBlocked) {
        results.skipped_email = userIds.length;
        results.smtp_blocked = true;

        // Create blocked email_job records for audit trail
        const blockedJobs = userIds.slice(0, 10).map((uid) => ({
          scope,
          tenant_id: tenant_id || null,
          provider_id: null,
          event_key,
          to_email: "blocked@placeholder",
          to_name: null,
          subject: email_subject || title,
          html_body: "<p>Blocked - tenant SMTP inactive</p>",
          payload: metadata,
          status: "blocked",
          block_reason: "tenant_smtp_inactive",
          idempotency_key: idempotency_key ? `${idempotency_key}:blocked:${uid}` : null,
        }));

        await admin.from("email_jobs").insert(blockedJobs);

        // ── CRITICAL: Notify Owner that SMTP is not active ──
        const { data: ownerMembers } = await admin
          .from("tenant_members")
          .select("user_id")
          .eq("tenant_id", tenant_id!)
          .eq("role", "owner");

        if (ownerMembers && ownerMembers.length > 0) {
          // Check idempotency: don't spam owner with duplicate warnings
          const today = new Date().toISOString().split("T")[0];
          const warnKey = `smtp_warn:${tenant_id}:${today}`;

          const { data: existing } = await admin
            .from("tenant_notifications")
            .select("id")
            .eq("tenant_id", tenant_id!)
            .eq("event_key", "system.smtp_inactive_warning")
            .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

          if (!existing || existing.length === 0) {
            // Create tenant notification
            await admin.from("tenant_notifications").insert({
              tenant_id: tenant_id!,
              type: "integrations",
              title: "فعّل SMTP لإرسال البريد",
              message: "تم منع إرسال إشعارات البريد الإلكتروني لأن إعدادات SMTP غير مفعّلة. انتقل إلى الإعدادات > البريد (SMTP) لتفعيلها.",
              severity: "warning",
              link: "/dashboard/settings/email",
              event_key: "system.smtp_inactive_warning",
              metadata: { blocked_event: event_key },
            });

            // Create user notifications for each owner
            const ownerNotifs = ownerMembers.map((o: any) => ({
              tenant_id: tenant_id!,
              user_id: o.user_id,
              type: "integrations",
              title: "فعّل SMTP لإرسال البريد",
              body: "تم منع إرسال إشعارات البريد الإلكتروني لأن إعدادات SMTP غير مفعّلة. انتقل إلى الإعدادات > البريد (SMTP) لتفعيلها.",
              link: "/dashboard/settings/email",
              event_key: "system.smtp_inactive_warning",
              metadata: { blocked_event: event_key },
              is_read: false,
            }));

            await admin.from("user_notifications").insert(ownerNotifs);
          }
        }
      } else {
        // Get user emails and enqueue
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        const emailJobs = (profiles || []).map((p: any) => {
          const ikey = idempotency_key ? `${idempotency_key}:${p.id}` : null;
          return {
            scope,
            tenant_id: tenant_id || null,
            provider_id: providerId,
            event_key,
            to_email: p.email,
            to_name: p.full_name || null,
            subject: email_subject || title,
            html_body: email_html || buildDefaultEmailHtml(title, body, link, severity),
            payload: metadata,
            status: "queued",
            block_reason: null,
            idempotency_key: ikey,
          };
        });

        if (emailJobs.length > 0) {
          const { error: emailErr } = await admin
            .from("email_jobs")
            .upsert(emailJobs, { onConflict: "idempotency_key", ignoreDuplicates: true });

          if (!emailErr) {
            results.email_queued = emailJobs.length;
          } else {
            console.error("Email job enqueue error:", emailErr.message);
          }
        }
      }
    }

    // ── 5) WhatsApp Channel ──
    if (channels.includes("whatsapp") && tenant_id) {
      const { data: waAccount } = await admin
        .from("tenant_whatsapp_accounts")
        .select("id, status")
        .eq("tenant_id", tenant_id)
        .eq("status", "active")
        .maybeSingle();

      const phones = payload.whatsapp_to_phones || [];
      const templateName = payload.whatsapp_template_name || event_key.replace(/\./g, "_");
      const langCode = payload.whatsapp_language_code || "ar";

      if (!waAccount) {
        // Block: no active WhatsApp account
        results.whatsapp_blocked = true;
        if (phones.length > 0) {
          await admin.from("notification_outbox").insert(
            phones.slice(0, 10).map((ph: string) => ({
              tenant_id,
              channel: "whatsapp",
              template_key: event_key,
              recipient: ph,
              payload_json: metadata,
              status: "blocked",
              block_reason: "whatsapp_not_configured",
            }))
          );
        }
      } else if (phones.length > 0) {
        // Check rate limits
        const { data: rl } = await admin
          .from("notification_rate_limits")
          .select("daily_limit, daily_count")
          .eq("tenant_id", tenant_id)
          .eq("channel", "whatsapp")
          .maybeSingle();

        const limitOk = !rl || rl.daily_count < rl.daily_limit;

        if (!limitOk) {
          await admin.from("notification_outbox").insert(
            phones.map((ph: string) => ({
              tenant_id,
              channel: "whatsapp",
              template_key: event_key,
              recipient: ph,
              payload_json: metadata,
              status: "blocked",
              block_reason: "rate_limit_exceeded",
            }))
          );
        } else {
          // Enqueue for sending
          await admin.from("notification_outbox").insert(
            phones.map((ph: string) => ({
              tenant_id,
              channel: "whatsapp",
              template_key: event_key,
              recipient: ph,
              payload_json: { ...metadata, template_name: templateName, language_code: langCode, components: payload.whatsapp_components || [] },
              status: "queued",
            }))
          );
          results.whatsapp_queued = phones.length;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Notify error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Default email HTML builder ──
function buildDefaultEmailHtml(
  title: string,
  body: string,
  link?: string,
  severity = "info"
): string {
  const severityColor = {
    info: "#3b82f6",
    warning: "#f59e0b",
    critical: "#ef4444",
  }[severity] || "#3b82f6";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; padding: 0; background: #f4f5f7; font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
  .container { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
  .card { background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
  .header { background: #0f172a; color: #ffffff; padding: 20px 24px; border-top: 3px solid ${severityColor}; }
  .header h1 { margin: 0; font-size: 17px; font-weight: 600; }
  .body { padding: 24px; }
  .body p { margin: 0 0 12px; font-size: 14px; line-height: 1.8; color: #334155; }
  .btn { display: inline-block; background: #0f172a; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600; margin: 8px 0; }
  .footer { padding: 16px 24px; text-align: center; }
  .footer p { margin: 0; font-size: 11px; color: #94a3b8; }
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
