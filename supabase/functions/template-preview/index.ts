/**
 * template-preview — Render + Test Send for notification templates
 *
 * Actions:
 *   preview: Render template with variables → returns rendered HTML/text
 *   test_send: Render + send test email to specified address
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeReplace(template: string, variables: Record<string, string>, schema: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in variables) {
      return escapeHtml(variables[key]);
    }
    if (schema[key]?.example) {
      return escapeHtml(schema[key].example);
    }
    return "—";
  });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeReplaceHtml(template: string, variables: Record<string, string>, schema: Record<string, any>): string {
  // For HTML templates, allow HTML in the template itself but escape variable values
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in variables) {
      return escapeHtml(variables[key]);
    }
    if (schema[key]?.example) {
      return escapeHtml(schema[key].example);
    }
    return "—";
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { action } = body;

    // ── PREVIEW ──
    if (action === "preview") {
      const { event_key, channel, lang, tenant_id, variables = {} } = body;

      if (!event_key || !channel || !lang) {
        return json({ error: "event_key, channel, lang required" }, 400);
      }

      const { data: resolved } = await admin.rpc("resolve_template", {
        p_event_key: event_key,
        p_channel: channel,
        p_lang: lang,
        p_tenant_id: tenant_id || null,
      });

      if (!resolved) {
        return json({ error: "Template not found", subject: null, html: null, text: null, title: null });
      }

      const schema = resolved.variables_schema || {};
      const mergedVars = { ...Object.fromEntries(Object.entries(schema).map(([k, v]: any) => [k, v.example || ""])), ...variables };

      const result: any = {
        template_id: resolved.id,
        scope: resolved.scope,
        version: resolved.version,
        lang: resolved.lang,
      };

      if (resolved.subject) result.subject = safeReplace(resolved.subject, mergedVars, schema);
      if (resolved.body_html) result.html = safeReplaceHtml(resolved.body_html, mergedVars, schema);
      if (resolved.body_text) result.text = safeReplace(resolved.body_text, mergedVars, schema);
      if (resolved.body) result.body = safeReplace(resolved.body, mergedVars, schema);
      if (resolved.title) result.title = safeReplace(resolved.title, mergedVars, schema);
      result.variables_schema = schema;

      return json(result);
    }

    // ── TEST SEND ──
    if (action === "test_send") {
      const { to_email, event_key, lang, variables = {}, tenant_id } = body;

      if (!to_email || !event_key || !lang) {
        return json({ error: "to_email, event_key, lang required" }, 400);
      }

      // Verify permissions
      if (tenant_id) {
        const { data: membership } = await admin
          .from("tenant_members")
          .select("role")
          .eq("user_id", user.id)
          .eq("tenant_id", tenant_id)
          .single();

        if (!membership || !["owner", "admin"].includes(membership.role)) {
          return json({ error: "Only owner/admin can test send" }, 403);
        }
      } else {
        // Platform admin check
        const { data: isAdmin } = await admin
          .from("platform_admins")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!isAdmin) return json({ error: "Platform admin required" }, 403);
      }

      // Resolve template
      const { data: resolved } = await admin.rpc("resolve_template", {
        p_event_key: event_key,
        p_channel: "email",
        p_lang: lang,
        p_tenant_id: tenant_id || null,
      });

      if (!resolved || !resolved.body_html) {
        return json({ error: "No email template found for this event" }, 404);
      }

      const schema = resolved.variables_schema || {};
      const mergedVars = { ...Object.fromEntries(Object.entries(schema).map(([k, v]: any) => [k, v.example || ""])), ...variables };

      const renderedSubject = safeReplace(resolved.subject || event_key, mergedVars, schema);
      const renderedHtml = safeReplaceHtml(resolved.body_html, mergedVars, schema);

      // Send via appropriate SMTP
      let result: { success: boolean; provider_message_id?: string; error?: string };

      if (tenant_id) {
        const { data: provider } = await admin
          .from("email_providers")
          .select("*")
          .eq("tenant_id", tenant_id)
          .eq("scope", "tenant")
          .eq("is_active", true)
          .maybeSingle();

        if (provider) {
          // Tenant SMTP
          try {
            const password = await decryptSecret(provider.smtp_password_encrypted, INTEGRATION_SECRET_KEY);
            const conn = await Deno.connect({ hostname: provider.smtp_host, port: provider.smtp_port });
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();

            async function read(): Promise<string> { const buf = new Uint8Array(1024); const n = await conn.read(buf); return decoder.decode(buf.subarray(0, n || 0)); }
            async function send(cmd: string): Promise<string> { await conn.write(encoder.encode(cmd + "\r\n")); return await read(); }

            await read();
            await send("EHLO numaxio.com");
            await send("AUTH LOGIN");
            await send(btoa(provider.smtp_username));
            const authResp = await send(btoa(password));

            if (!authResp.startsWith("235")) { conn.close(); result = { success: false, error: "SMTP auth failed" }; }
            else {
              await send(`MAIL FROM:<${provider.from_email}>`);
              await send(`RCPT TO:<${to_email}>`);
              await send("DATA");
              const emailData = [
                `From: ${provider.from_name_ar || provider.from_name_en || "System"} <${provider.from_email}>`,
                `To: <${to_email}>`,
                `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent("[Test] " + renderedSubject)))}?=`,
                `MIME-Version: 1.0`,
                `Content-Type: text/html; charset=UTF-8`,
                ``, renderedHtml, `.`
              ].join("\r\n");
              const dataResp = await send(emailData);
              await send("QUIT");
              conn.close();
              result = dataResp.startsWith("250") ? { success: true, provider_message_id: `smtp-test-${Date.now()}` } : { success: false, error: "SMTP send failed" };
            }
          } catch (err) {
            result = { success: false, error: err instanceof Error ? err.message : "SMTP error" };
          }
        } else {
          // Fallback to platform
          result = await sendViaResend(to_email, renderedSubject, renderedHtml);
        }
      } else {
        result = await sendViaResend(to_email, renderedSubject, renderedHtml);
      }

      return json(result);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("template-preview error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

async function sendViaResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { success: false, error: "RESEND_API_KEY not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: "Numaxio <no-reply@numaxio.com>", to: [to], subject: `[Test] ${subject}`, html }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: JSON.stringify(data) };
    return { success: true, provider_message_id: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Resend error" };
  }
}
