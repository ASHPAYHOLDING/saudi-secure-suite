/**
 * marketing-test-connection — اختبار اتصال أي مزود تسويق
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function aesGcmDecrypt(encryptedB64: string, keyHex: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !authData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: members } = await supabase.from("tenant_members").select("tenant_id").limit(1);
    const tenantId = members?.[0]?.tenant_id;
    if (!tenantId) return new Response(JSON.stringify({ error: "No tenant" }), { status: 400, headers: corsHeaders });

    const { provider } = await req.json() as { provider: string };
    if (!provider) return new Response(JSON.stringify({ error: "provider required" }), { status: 400, headers: corsHeaders });

    const { data: integration } = await supabase
      .from("marketing_integrations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("provider", provider)
      .single();

    if (!integration) {
      return new Response(JSON.stringify({ success: false, message: "التكامل غير مُعدّ بعد. أضف Pixel ID والمفتاح أولاً." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let secrets: Record<string, string> = {};
    if (integration.secrets_encrypted) {
      const encKey = Deno.env.get("INTEGRATION_SECRET_KEY") ?? "0".repeat(64);
      try {
        const decrypted = await aesGcmDecrypt(integration.secrets_encrypted, encKey);
        secrets = JSON.parse(decrypted);
      } catch {
        return new Response(JSON.stringify({ success: false, message: "فشل فك تشفير الأسرار. أعد الإعداد." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const config = integration.config as Record<string, unknown>;
    let testResult = { success: false, message: "مزود غير مدعوم", status_code: 0 };

    if (provider === "meta_pixel_capi" || provider === "meta" || provider === "facebook_capi") {
      const pixel_id = config.pixel_id as string;
      const access_token = secrets.access_token;
      if (!pixel_id || !access_token) {
        testResult = { success: false, message: "Pixel ID أو Access Token مفقود", status_code: 400 };
      } else {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${pixel_id}?fields=id,name&access_token=${access_token}`
        );
        const data = await res.json() as { id?: string; name?: string; error?: { message: string } };
        testResult = res.ok
          ? { success: true, message: `✅ اتصال ناجح — Pixel: ${data.name ?? pixel_id}`, status_code: 200 }
          : { success: false, message: `❌ ${data.error?.message ?? "خطأ في الاتصال"}`, status_code: res.status };
      }
    } else if (provider === "tiktok_capi" || provider === "tiktok") {
      const pixel_id = config.pixel_id as string;
      const access_token = secrets.access_token;
      if (!pixel_id || !access_token) {
        testResult = { success: false, message: "Pixel ID أو Access Token مفقود", status_code: 400 };
      } else {
        const res = await fetch(
          `https://business-api.tiktok.com/open_api/v1.3/pixel/list/?advertiser_id=${pixel_id}`,
          { headers: { "Access-Token": access_token } }
        );
        testResult = {
          success: res.ok || res.status === 200,
          message: res.ok ? "✅ Access Token صالح" : `❌ HTTP ${res.status} — تحقق من Access Token`,
          status_code: res.status,
        };
      }
    } else if (provider === "gtm") {
      const container_id = config.container_id as string;
      testResult = container_id
        ? { success: true, message: `✅ Container ID: ${container_id} مُدخل بنجاح`, status_code: 200 }
        : { success: false, message: "Container ID مطلوب", status_code: 400 };
    } else {
      testResult = { success: true, message: "✅ الإعدادات محفوظة — الاختبار الكامل يتطلب إرسال حدث", status_code: 200 };
    }

    // Log test
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabaseAdmin.from("marketing_events_logs").insert({
      tenant_id: tenantId,
      provider,
      action: "test_connection",
      event_name: "connection_test",
      status_code: testResult.status_code,
      response_body: testResult.message.slice(0, 500),
      duration_ms: 0,
    });

    return new Response(JSON.stringify(testResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
