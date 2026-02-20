/**
 * set-integration-secrets — Edge Function
 *
 * Receives the API secret (plaintext) from the authenticated client,
 * validates ownership, and stores it encrypted via the DB RPC.
 * The client NEVER writes secrets directly to DB tables.
 *
 * Actions:
 *   POST ?action=set-paid-integration  — stores secret for tenant_paid_integrations
 *   POST ?action=test-and-set          — tests connection first, then stores on success
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl     = Deno.env.get("SUPABASE_URL")!;
    const serviceKey      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const masterKey       = Deno.env.get("INTEGRATION_SECRET_KEY");

    if (!masterKey) return json({ error: "Encryption key not configured" }, 500);

    // Service-role client for privileged operations
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify caller identity via their JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) return json({ error: "Invalid token" }, 401);

    // Get caller's tenant
    const { data: member } = await adminClient
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!member) return json({ error: "No tenant found" }, 403);
    const tenantId = member.tenant_id;

    const url    = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── Action: set-paid-integration ──────────────────────────
    if (action === "set-paid-integration" && req.method === "POST") {
      const body = await req.json();
      const { integrationId, gatewayKey, apiSecret } = body;

      if (!integrationId || !apiSecret) {
        return json({ error: "integrationId and apiSecret are required" }, 400);
      }

      // Verify the tenant actually has this integration record
      const { data: record } = await adminClient
        .from("tenant_paid_integrations")
        .select("id, integration_id")
        .eq("tenant_id", tenantId)
        .eq("integration_id", integrationId)
        .maybeSingle();

      if (!record) return json({ error: "Integration not found for this tenant" }, 403);

      // Build secrets JSON (extensible for multi-key integrations)
      const secretsJson = JSON.stringify({ api_key: apiSecret });

      // Call service-role–only RPC; pass master key so it can encrypt
      const { error: rpcErr } = await adminClient.rpc("set_integration_secrets", {
        p_tenant_id:      tenantId,
        p_integration_id: integrationId,
        p_secrets_json:   secretsJson,
        p_actor_id:       user.id,
        p_master_key:     masterKey,
      } as any);

      if (rpcErr) {
        console.error("set_integration_secrets error:", rpcErr);
        return json({ error: rpcErr.message }, 500);
      }

      return json({ success: true });
    }

    // ── Action: test-and-set ───────────────────────────────────
    if (action === "test-and-set" && req.method === "POST") {
      const body = await req.json();
      const { integrationId, gatewayKey, apiSecret } = body;

      if (!integrationId || !gatewayKey || !apiSecret) {
        return json({ error: "integrationId, gatewayKey, and apiSecret are required" }, 400);
      }

      // Verify ownership
      const { data: record } = await adminClient
        .from("tenant_paid_integrations")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("integration_id", integrationId)
        .maybeSingle();
      if (!record) return json({ error: "Integration not found for this tenant" }, 403);

      // Test connection first (plaintext secret used only in-memory here)
      const testResult = await testGatewayConnection(gatewayKey, apiSecret);

      if (!testResult.success) {
        return json({ success: false, message: testResult.message });
      }

      // Encrypt & store only after successful test
      const secretsJson = JSON.stringify({ api_key: apiSecret });
      const { error: rpcErr } = await adminClient.rpc("set_integration_secrets", {
        p_tenant_id:      tenantId,
        p_integration_id: integrationId,
        p_secrets_json:   secretsJson,
        p_actor_id:       user.id,
        p_master_key:     masterKey,
      } as any);

      if (rpcErr) {
        console.error("set_integration_secrets error:", rpcErr);
        return json({ error: rpcErr.message }, 500);
      }

      // Activate the integration
      await adminClient
        .from("tenant_paid_integrations")
        .update({ status: "active", activated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("integration_id", integrationId);

      return json({ success: true, message: testResult.message });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err: any) {
    console.error("set-integration-secrets error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});

// ── Gateway test helpers ─────────────────────────────────────────────────────
async function testGatewayConnection(
  gatewayKey: string,
  apiKey: string
): Promise<{ success: boolean; message: string }> {
  switch (gatewayKey) {
    case "pay_moyasar":
      return testMoyasar(apiKey);
    case "pay_hyperpay":
      return testHyperPay(apiKey);
    case "pay_tap":
      return testTap(apiKey);
    default:
      // Unknown gateway — store without testing
      return { success: true, message: "تم حفظ المفتاح (بدون اختبار اتصال)" };
  }
}

async function testMoyasar(apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch("https://api.moyasar.com/v1/payments?page=1&per=1", {
      headers: { Authorization: `Basic ${btoa(apiKey + ":")}` },
    });
    if (res.status === 401) return { success: false, message: "مفتاح API غير صالح" };
    if (!res.ok) {
      await res.text();
      return { success: false, message: `خطأ من Moyasar: ${res.status}` };
    }
    await res.text();
    return { success: true, message: "تم الاتصال بنجاح مع Moyasar ✅" };
  } catch (err: any) {
    return { success: false, message: `فشل الاتصال: ${err.message}` };
  }
}

async function testHyperPay(accessToken: string): Promise<{ success: boolean; message: string }> {
  try {
    const [entityId, token] = accessToken.includes(":") ? accessToken.split(":") : ["", accessToken];
    const testUrl = `https://eu-test.oppwa.com/v1/checkouts/test123/payment?entityId=${entityId || "test"}`;
    const res = await fetch(testUrl, {
      headers: { Authorization: `Bearer ${token || accessToken}` },
    });
    await res.text();
    if (res.status === 401 || res.status === 403) {
      return { success: false, message: "Access Token غير صالح" };
    }
    return { success: true, message: "تم الاتصال بنجاح مع HyperPay ✅" };
  } catch (err: any) {
    return { success: false, message: `فشل الاتصال: ${err.message}` };
  }
}

async function testTap(secretKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch("https://api.tap.company/v2/charges/list", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ period: { date: { from: Date.now(), to: Date.now() } }, limit: 1 }),
    });
    await res.text();
    if (res.status === 401) return { success: false, message: "مفتاح API غير صالح" };
    return { success: true, message: "تم الاتصال بنجاح مع Tap ✅" };
  } catch (err: any) {
    return { success: false, message: `فشل الاتصال: ${err.message}` };
  }
}
