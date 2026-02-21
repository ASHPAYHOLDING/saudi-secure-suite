/**
 * secrets-vault — Enterprise Secrets Vault edge function
 * Actions: set, rotate, list
 * All writes go through service_role; AES-GCM encryption via shared helper.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { encryptSecret } from "../_shared/aes-gcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const masterKey = Deno.env.get("INTEGRATION_SECRET_KEY");
    if (!masterKey) return json({ error: "INTEGRATION_SECRET_KEY not configured" }, 500);

    // Verify caller auth
    const authHeader = req.headers.get("authorization") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // Get tenant membership + role
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: member } = await adminClient
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!member) return json({ error: "No tenant membership" }, 403);

    // Permission check: owner or finance_admin only
    const allowedRoles = ["owner", "admin", "finance_admin"];
    if (!allowedRoles.includes(member.role)) {
      return json({ error: "Insufficient permissions — owner/admin/finance_admin required" }, 403);
    }

    const body = await req.json();
    const { action, provider_key, secret_name, secret_value } = body;

    if (!action) return json({ error: "Missing action" }, 400);
    if (!provider_key) return json({ error: "Missing provider_key" }, 400);

    const tenantId = member.tenant_id;

    // ── LIST ──
    if (action === "list") {
      const { data, error } = await adminClient
        .from("tenant_integration_secrets")
        .select("id, provider_key, secret_name, created_at, rotated_at")
        .eq("tenant_id", tenantId)
        .eq("provider_key", provider_key)
        .order("secret_name");

      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    // ── SET ──
    if (action === "set") {
      if (!secret_name || !secret_value) return json({ error: "Missing secret_name or secret_value" }, 400);

      const encrypted = await encryptSecret(secret_value, masterKey);

      const { error: upsertErr } = await adminClient
        .from("tenant_integration_secrets")
        .upsert(
          {
            tenant_id: tenantId,
            provider_key,
            secret_name,
            secret_encrypted: encrypted,
            rotated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,provider_key,secret_name" }
        );

      if (upsertErr) return json({ error: upsertErr.message }, 500);

      // Audit log
      await adminClient.from("audit_logs").insert({
        tenant_id: tenantId,
        user_id: user.id,
        action: "set_secret",
        entity_type: "integration_secret",
        entity_id: provider_key,
        entity_label: `${provider_key}/${secret_name}`,
        after_value: { provider_key, secret_name, action: "set" },
      });

      return json({ success: true });
    }

    // ── ROTATE ──
    if (action === "rotate") {
      if (!secret_name || !secret_value) return json({ error: "Missing secret_name or secret_value for rotation" }, 400);

      // Verify existing secret exists
      const { data: existing } = await adminClient
        .from("tenant_integration_secrets")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("provider_key", provider_key)
        .eq("secret_name", secret_name)
        .maybeSingle();

      if (!existing) return json({ error: "Secret not found — set it first" }, 404);

      const encrypted = await encryptSecret(secret_value, masterKey);

      const { error: updateErr } = await adminClient
        .from("tenant_integration_secrets")
        .update({
          secret_encrypted: encrypted,
          rotated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateErr) return json({ error: updateErr.message }, 500);

      // Audit log
      await adminClient.from("audit_logs").insert({
        tenant_id: tenantId,
        user_id: user.id,
        action: "rotate_secret",
        entity_type: "integration_secret",
        entity_id: provider_key,
        entity_label: `${provider_key}/${secret_name}`,
        after_value: { provider_key, secret_name, action: "rotate" },
      });

      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error("secrets-vault error:", err);
    return json({ error: err.message }, 500);
  }
});
