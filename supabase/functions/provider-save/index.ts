import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptSecret } from "../_shared/aes-gcm.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const masterKey = Deno.env.get("INTEGRATION_SECRET_KEY") || "";

  const adminClient = createClient(supabaseUrl, serviceKey);

  // Rate limiting
  const blocked = await checkRateLimit(req, adminClient, "provider_save", corsHeaders);
  if (blocked) return blocked;

  // Auth
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, corsHeaders);

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
  if (authErr || !user) return json({ error: "Invalid token" }, 401, corsHeaders);

  // Get tenant
  const { data: member } = await adminClient
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!member) return json({ error: "No tenant found" }, 403, corsHeaders);
  const tenantId = member.tenant_id;

  // Parse body
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400, corsHeaders); }

  const { provider, credentials, webhookSecret } = body;

  // Validate provider
  if (!["tap", "moyasar", "hyperpay"].includes(provider)) {
    return json({ error: "Invalid provider. Must be tap, moyasar, or hyperpay" }, 400, corsHeaders);
  }

  if (!credentials || typeof credentials !== "object") {
    return json({ error: "credentials object is required" }, 400, corsHeaders);
  }

  // Validate required fields per provider
  const credStr = JSON.stringify(credentials);
  if (!credStr || credStr === "{}") {
    return json({ error: "credentials cannot be empty" }, 400, corsHeaders);
  }

  if (!masterKey) {
    return json({ error: "Platform encryption key not configured" }, 500, corsHeaders);
  }

  // Encrypt credentials
  let credentialsEncrypted: string;
  let webhookSecretEncrypted: string | null = null;

  try {
    credentialsEncrypted = await encryptSecret(JSON.stringify(credentials), masterKey);
    if (webhookSecret && typeof webhookSecret === "string" && webhookSecret.trim()) {
      webhookSecretEncrypted = await encryptSecret(webhookSecret.trim(), masterKey);
    }
  } catch (err: any) {
    console.error("Encryption error:", err);
    return json({ error: "Encryption failed: " + err.message }, 500, corsHeaders);
  }

  // Upsert provider record
  const { error: upsertErr } = await adminClient
    .from("tenant_payment_providers")
    .upsert({
      tenant_id: tenantId,
      provider,
      credentials_encrypted: credentialsEncrypted,
      webhook_secret_encrypted: webhookSecretEncrypted,
      status: "connected",
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,provider" });

  if (upsertErr) {
    console.error("Upsert error:", upsertErr);
    return json({ error: "Failed to save provider: " + upsertErr.message }, 500, corsHeaders);
  }

  // Audit log
  await adminClient.from("audit_logs").insert({
    tenant_id: tenantId,
    user_id: user.id,
    action: "provider_credentials_saved",
    entity_type: "payment_provider",
    entity_label: provider,
    changes: { provider, has_webhook_secret: !!webhookSecretEncrypted },
  });

  return json({ success: true, provider, status: "connected" }, 200, corsHeaders);
});

function json(data: any, status = 200, headers = corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
