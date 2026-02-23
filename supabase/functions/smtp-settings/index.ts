/**
 * SMTP Settings Management — Owner-only
 * Actions: get, upsert, test, delete, toggle
 * All SMTP passwords are encrypted with AES-GCM before storage.
 * Test action: rate limited to 3 per 10 minutes per tenant.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptSecret, decryptSecret } from "../_shared/aes-gcm.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTEGRATION_SECRET_KEY = Deno.env.get("INTEGRATION_SECRET_KEY")!;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // General rate limit
  const blocked = await checkRateLimit(req, admin, "general", corsHeaders);
  if (blocked) return blocked;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action, tenant_id } = body;

    if (!tenant_id) return jsonResponse({ error: "tenant_id required" }, 400);

    // Verify user is owner of this tenant
    const { data: membership } = await admin
      .from("tenant_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!membership || membership.role !== "owner") {
      return jsonResponse({ error: "Only owners can manage SMTP settings" }, 403);
    }

    // ── GET ──
    if (action === "get") {
      const { data: provider } = await admin
        .from("email_providers")
        .select("id, from_name_ar, from_name_en, from_email, reply_to, smtp_host, smtp_port, smtp_secure, smtp_username, is_active, last_test_at, last_test_status, last_error, created_at, updated_at")
        .eq("tenant_id", tenant_id)
        .eq("scope", "tenant")
        .maybeSingle();

      return jsonResponse({ provider: provider || null });
    }

    // ── UPSERT ──
    if (action === "upsert") {
      const { smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password, from_name_ar, from_name_en, from_email, reply_to } = body;

      if (!smtp_host || !smtp_username || !from_email) {
        return jsonResponse({ error: "smtp_host, smtp_username, and from_email are required" }, 400);
      }

      // Encrypt password
      let encryptedPassword: string | undefined;
      if (smtp_password) {
        encryptedPassword = await encryptSecret(smtp_password, INTEGRATION_SECRET_KEY);
      }

      // Check if exists
      const { data: existing } = await admin
        .from("email_providers")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("scope", "tenant")
        .maybeSingle();

      const providerData: any = {
        scope: "tenant",
        tenant_id,
        provider_type: "smtp",
        from_name_ar: from_name_ar || null,
        from_name_en: from_name_en || null,
        from_email,
        reply_to: reply_to || null,
        smtp_host,
        smtp_port: smtp_port || 587,
        smtp_secure: smtp_secure ?? true,
        smtp_username,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (encryptedPassword) {
        providerData.smtp_password_encrypted = encryptedPassword;
      }

      if (existing) {
        const { error } = await admin
          .from("email_providers")
          .update(providerData)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        if (!smtp_password) {
          return jsonResponse({ error: "Password required for new SMTP setup" }, 400);
        }
        providerData.smtp_password_encrypted = encryptedPassword;
        const { error } = await admin.from("email_providers").insert(providerData);
        if (error) throw error;
      }

      return jsonResponse({ success: true });
    }

    // ── TOGGLE ──
    if (action === "toggle") {
      const { is_active } = body;
      const { data: existing } = await admin
        .from("email_providers")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("scope", "tenant")
        .maybeSingle();

      if (!existing) return jsonResponse({ error: "No SMTP configured" }, 404);

      const { error } = await admin
        .from("email_providers")
        .update({ is_active: !!is_active, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw error;

      return jsonResponse({ success: true });
    }

    // ── TEST (rate limited: 3 per 10 min per tenant) ──
    if (action === "test") {
      // Custom rate limit for test: 3 per 10 min
      const tenantKey = `smtp_test:${tenant_id}`;
      const { data: recentTests } = await admin
        .from("rate_limits")
        .select("id, created_at")
        .eq("key", tenantKey)
        .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false });

      if (recentTests && recentTests.length >= 3) {
        return jsonResponse({ error: "Rate limit exceeded. Max 3 tests per 10 minutes." }, 429);
      }

      // Record this test attempt
      await admin.from("rate_limits").insert({ key: tenantKey, created_at: new Date().toISOString() }).maybeSingle();

      const { recipient_email } = body;
      if (!recipient_email) {
        return jsonResponse({ error: "recipient_email required" }, 400);
      }

      const { data: provider } = await admin
        .from("email_providers")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("scope", "tenant")
        .single();

      if (!provider) return jsonResponse({ error: "No SMTP configured" }, 404);

      let testSuccess = false;
      let testError = "";

      try {
        const password = await decryptSecret(provider.smtp_password_encrypted, INTEGRATION_SECRET_KEY);

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

        if (authResp.startsWith("235")) {
          // Auth success — send a test email
          const fromName = provider.from_name_en || provider.from_name_ar || "Numaxio";
          await send(`MAIL FROM:<${provider.from_email}>`);
          await send(`RCPT TO:<${recipient_email}>`);
          await send("DATA");
          const emailBody = [
            `From: "${fromName}" <${provider.from_email}>`,
            `To: <${recipient_email}>`,
            `Subject: SMTP Test — Numaxio`,
            `Content-Type: text/plain; charset=UTF-8`,
            ``,
            `This is a test email from your Numaxio SMTP configuration.`,
            `If you received this, your SMTP settings are working correctly.`,
            ``,
            `— Numaxio Platform`,
          ].join("\r\n");
          const dataResp = await send(emailBody + "\r\n.");

          if (dataResp.startsWith("250")) {
            testSuccess = true;
          } else {
            testError = "Email send failed: " + dataResp.trim();
          }
        } else {
          testError = "Authentication failed";
        }

        await send("QUIT");
        conn.close();
      } catch (err) {
        testError = err instanceof Error ? err.message : String(err);
      }

      // Update test status
      await admin.from("email_providers").update({
        last_test_at: new Date().toISOString(),
        last_test_status: testSuccess ? "success" : "failed",
        last_error: testSuccess ? null : testError,
      }).eq("id", provider.id);

      return jsonResponse({
        success: testSuccess,
        error: testSuccess ? null : testError,
      });
    }

    // ── DELETE ──
    if (action === "delete") {
      await admin
        .from("email_providers")
        .delete()
        .eq("tenant_id", tenant_id)
        .eq("scope", "tenant");

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("SMTP settings error:", err);
    return jsonResponse({ error: "An internal error occurred" }, 500);
  }
});
