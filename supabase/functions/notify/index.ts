/**
 * Unified Notification Dispatcher
 * Creates in-app notifications + enqueues email jobs atomically.
 * 
 * Called by other edge functions or RPCs to dispatch notifications.
 * Uses service_role — never expose to client directly.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptSecret } from "../_shared/aes-gcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface NotifyRequest {
  event_key: string;
  tenant_id?: string;        // null for platform scope
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
  // Email-specific
  email_subject?: string;
  email_html?: string;
  // Override defaults
  channels?: ("in_app" | "email")[];
  target_user_ids?: string[];   // specific users
  target_roles?: string[];      // or by role
  idempotency_key?: string;
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

    const results = { in_app: 0, email_queued: 0, skipped_email: 0 };

    // ── 3) Create In-App Notifications ──
    if (channels.includes("in_app") && userIds.length > 0) {
      // Use user_notifications for targeted notifications
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
      // Check if tenant has active SMTP
      let providerId: string | null = null;
      let smtpBlocked = false;

      if (scope === "tenant" && tenant_id) {
        const { data: tenantProvider } = await admin
          .from("email_providers")
          .select("id, is_active")
          .eq("tenant_id", tenant_id)
          .eq("scope", "tenant")
          .maybeSingle();

        if (tenantProvider?.is_active) {
          providerId = tenantProvider.id;
        } else {
          // Option X: Block tenant email if no SMTP configured
          // (Feature flag for Option Y fallback can be added later)
          smtpBlocked = true;
        }
      } else if (scope === "platform") {
        // Platform emails use platform SMTP (Resend)
        const { data: platformProvider } = await admin
          .from("email_providers")
          .select("id")
          .eq("scope", "platform")
          .eq("is_active", true)
          .maybeSingle();

        providerId = platformProvider?.id || null;
        // Platform emails always go through Resend even without DB provider
      }

      if (!smtpBlocked) {
        // Get user emails
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        const emailJobs = (profiles || []).map((p: any) => {
          const ikey = idempotency_key
            ? `${idempotency_key}:${p.id}`
            : null;

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
      } else {
        results.skipped_email = userIds.length;
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
