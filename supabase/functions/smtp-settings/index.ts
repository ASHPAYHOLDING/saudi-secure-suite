/**
 * SMTP Settings Management — Owner-only
 * Actions: get, upsert, test, delete
 * All SMTP passwords are encrypted with AES-GCM before storage.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Rate limit
  const blocked = await checkRateLimit(req, admin, "general", corsHeaders);
  if (blocked) return blocked;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, tenant_id } = body;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is owner of this tenant
    const { data: membership } = await admin
      .from("tenant_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!membership || membership.role !== "owner") {
      return new Response(JSON.stringify({ error: "Only owners can manage SMTP settings" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET ──
    if (action === "get") {
      const { data: provider } = await admin
        .from("email_providers")
        .select("id, from_name_ar, from_name_en, from_email, reply_to, smtp_host, smtp_port, smtp_secure, smtp_username, is_active, last_test_at, last_test_status, last_error, created_at, updated_at")
        .eq("tenant_id", tenant_id)
        .eq("scope", "tenant")
        .maybeSingle();

      return new Response(JSON.stringify({ provider: provider || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPSERT ──
    if (action === "upsert") {
      const { smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password, from_name_ar, from_name_en, from_email, reply_to } = body;

      if (!smtp_host || !smtp_username || !from_email) {
        return new Response(JSON.stringify({ error: "smtp_host, smtp_username, and from_email are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
          return new Response(JSON.stringify({ error: "Password required for new SMTP setup" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        providerData.smtp_password_encrypted = encryptedPassword;
        const { error } = await admin.from("email_providers").insert(providerData);
        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── TEST ──
    if (action === "test") {
      const { data: provider } = await admin
        .from("email_providers")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("scope", "tenant")
        .single();

      if (!provider) {
        return new Response(JSON.stringify({ error: "No SMTP configured" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
          testSuccess = true;
        } else {
          testError = "فشل المصادقة: " + authResp.trim();
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

      return new Response(JSON.stringify({
        success: testSuccess,
        error: testSuccess ? null : testError,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE ──
    if (action === "delete") {
      await admin
        .from("email_providers")
        .delete()
        .eq("tenant_id", tenant_id)
        .eq("scope", "tenant");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("SMTP settings error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
