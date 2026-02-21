import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, success, ip_address, user_agent, user_id, tenant_id } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if account is locked BEFORE recording attempt
    if (!success) {
      const { data: isLocked } = await supabase.rpc("check_account_locked", {
        p_email: email,
      });
      if (isLocked) {
        // Log account lock event to audit
        if (tenant_id) {
          await supabase.from("audit_logs").insert({
            tenant_id,
            user_id: user_id || "00000000-0000-0000-0000-000000000000",
            entity_type: "auth",
            action: "account_locked",
            entity_label: email,
            ip_address: ip_address || null,
            changes: { reason: "5 failed login attempts in 10 minutes", email },
          });
        }

        return new Response(
          JSON.stringify({
            locked: true,
            message: "تم قفل الحساب مؤقتاً بسبب محاولات تسجيل دخول متعددة فاشلة. يرجى المحاولة بعد 10 دقائق.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Record the attempt
    await supabase.from("login_attempts").insert({
      email,
      ip_address: ip_address || null,
      success: success || false,
      user_agent: user_agent || null,
    });

    // Log failed attempt to audit
    if (!success && tenant_id) {
      await supabase.from("audit_logs").insert({
        tenant_id,
        user_id: user_id || "00000000-0000-0000-0000-000000000000",
        entity_type: "auth",
        action: "login_failed",
        entity_label: email,
        ip_address: ip_address || null,
        changes: { email },
      });
    }

    // Check if NOW locked after this attempt
    if (!success) {
      const { data: nowLocked } = await supabase.rpc("check_account_locked", {
        p_email: email,
      });
      if (nowLocked) {
        return new Response(
          JSON.stringify({
            locked: true,
            message: "تم قفل الحساب مؤقتاً بسبب محاولات تسجيل دخول متعددة فاشلة. يرجى المحاولة بعد 10 دقائق.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // On successful login, insert active session and auto-revoke expired ones
    if (success && user_id && tenant_id) {
      await supabase.from("active_sessions").insert({
        tenant_id,
        user_id,
        ip_address: ip_address || null,
        device_info: { user_agent: user_agent || null },
        last_activity_at: new Date().toISOString(),
      });

      // Fire-and-forget: revoke expired sessions based on enterprise policy
      await supabase.rpc("revoke_expired_sessions", { p_tenant_id: tenant_id }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ locked: false, recorded: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
