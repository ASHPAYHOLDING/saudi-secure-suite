/**
 * notify-dispatch — Fan-out dispatcher using resolve_notification_plan RPC
 *
 * Input: { tenant_id, event_key, lang, event_instance_id, variables, deep_link? }
 * 
 * 1) Calls resolve_notification_plan to get channels + templates + audience
 * 2) Resolves recipients from audience type
 * 3) Creates idempotent outbox rows per channel+recipient
 * 4) Returns { queued_count, skipped, reason? }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface DispatchRequest {
  tenant_id: string;
  event_key: string;
  lang?: string;
  event_instance_id: string;
  variables?: Record<string, string>;
  deep_link?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body: DispatchRequest = await req.json();
    const {
      tenant_id,
      event_key,
      lang = "ar",
      event_instance_id,
      variables = {},
      deep_link,
    } = body;

    if (!tenant_id || !event_key || !event_instance_id) {
      return json({ error: "tenant_id, event_key, and event_instance_id are required" }, 400);
    }

    // ── 1) Resolve notification plan ──
    const { data: plan, error: planErr } = await admin.rpc("resolve_notification_plan", {
      p_tenant_id: tenant_id,
      p_event_key: event_key,
      p_lang: lang,
    });

    if (planErr) {
      console.error("resolve_notification_plan error:", planErr.message);
      return json({ skipped: true, reason: "plan_resolution_failed", error: planErr.message });
    }

    if (!plan || !plan.enabled) {
      return json({ skipped: true, reason: plan?.reason || "event_disabled", queued_count: 0 });
    }

    const channels: Array<{ channel: string; email_mode: string | null; template_id: string | null; lang: string }> = plan.channels || [];
    if (channels.length === 0) {
      return json({ skipped: true, reason: "no_channels", queued_count: 0 });
    }

    const audience = plan.audience || { type: "owner_only" };

    // ── 2) Resolve recipients ──
    let userIds: string[] = [];

    if (audience.type === "custom" && audience.custom_recipients) {
      // Custom recipients: could be user_ids, emails, phones
      const cr = audience.custom_recipients;
      if (Array.isArray(cr.user_ids)) userIds = cr.user_ids;
      // For emails/phones we'll handle separately in outbox
    } else {
      // Role-based audience
      const roleMap: Record<string, string[]> = {
        owner_only: ["owner"],
        admins: ["owner", "admin"],
        finance: ["owner", "admin", "finance"],
        hr: ["owner", "admin", "hr"],
      };

      const roles = roleMap[audience.type] || ["owner"];

      const { data: members } = await admin
        .from("tenant_members")
        .select("user_id, role")
        .eq("tenant_id", tenant_id);

      if (members) {
        userIds = members
          .filter((m: any) => roles.includes(m.role))
          .map((m: any) => m.user_id);
      }
    }

    if (userIds.length === 0) {
      // Fallback: notify owner
      const { data: owners } = await admin
        .from("tenant_members")
        .select("user_id")
        .eq("tenant_id", tenant_id)
        .eq("role", "owner");
      userIds = (owners || []).map((o: any) => o.user_id);
    }

    if (userIds.length === 0) {
      return json({ skipped: true, reason: "no_recipients", queued_count: 0 });
    }

    // ── 3) Get user profiles for email ──
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, full_name, phone")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    // ── 4) Load templates for rendering ──
    const templateIds = channels.map(c => c.template_id).filter(Boolean);
    let templateMap = new Map<string, any>();
    if (templateIds.length > 0) {
      const { data: templates } = await admin
        .from("notification_event_templates")
        .select("id, subject, body, channel, lang")
        .in("id", templateIds);
      templateMap = new Map((templates || []).map((t: any) => [t.id, t]));
    }

    // ── 5) Fan-out: create outbox rows ──
    const outboxRows: any[] = [];

    for (const ch of channels) {
      const template = ch.template_id ? templateMap.get(ch.template_id) : null;

      // Render template with variables
      let renderedSubject = template?.subject || event_key;
      let renderedBody = template?.body || event_key;

      for (const [key, val] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        renderedSubject = renderedSubject.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), val);
        renderedBody = renderedBody.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), val);
      }

      for (const uid of userIds) {
        const profile = profileMap.get(uid);
        if (!profile) continue;

        // Determine recipient value based on channel
        let recipientValue: string;
        if (ch.channel === "email") {
          recipientValue = profile.email;
          if (!recipientValue) continue;
        } else if (ch.channel === "whatsapp") {
          recipientValue = profile.phone;
          if (!recipientValue) continue;
        } else {
          recipientValue = uid; // in_app
        }

        const idempotencyKey = `${event_key}:${event_instance_id}:${ch.channel}:${recipientValue}`;

        outboxRows.push({
          tenant_id,
          event_key,
          channel: ch.channel,
          email_mode: ch.email_mode || null,
          recipient: { type: ch.channel === "email" ? "email" : ch.channel === "whatsapp" ? "phone" : "user_id", value: recipientValue },
          payload: {
            variables,
            deep_link: deep_link || null,
            template_id: ch.template_id || null,
            lang: ch.lang,
            subject: renderedSubject,
            body: renderedBody,
            user_id: uid,
            user_name: profile.full_name || null,
          },
          status: "queued",
          idempotency_key: idempotencyKey,
          meta: { event_instance_id, dispatched_at: new Date().toISOString() },
        });
      }
    }

    if (outboxRows.length === 0) {
      return json({ skipped: true, reason: "no_valid_recipients", queued_count: 0 });
    }

    // Upsert with idempotency — ignore duplicates
    const { error: insertErr, count } = await admin
      .from("notification_event_outbox")
      .upsert(outboxRows, { onConflict: "tenant_id,idempotency_key,channel", ignoreDuplicates: true, count: "exact" });

    if (insertErr) {
      console.error("Outbox insert error:", insertErr.message);
      return json({ error: "outbox_insert_failed", details: insertErr.message }, 500);
    }

    return json({ success: true, queued_count: count || outboxRows.length });
  } catch (err) {
    console.error("notify-dispatch error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
