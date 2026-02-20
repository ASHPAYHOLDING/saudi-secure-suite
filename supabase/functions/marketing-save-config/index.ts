/**
 * marketing-save-config — حفظ إعدادات أي تكامل تسويقي بشكل مشفّر
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function aesGcmEncrypt(plaintext: string, keyHex: string): Promise<string> {
  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(12 + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), 12);
  return btoa(String.fromCharCode(...Array.from(combined)));
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

    const body = await req.json() as {
      provider: string;
      config: Record<string, unknown>;
      secrets?: Record<string, string>;
      status?: string;
      environment?: string;
    };
    const { provider, config, secrets, status = "active", environment = "live" } = body;

    if (!provider) return new Response(JSON.stringify({ error: "provider required" }), { status: 400, headers: corsHeaders });

    let secrets_encrypted: string | undefined;
    if (secrets && Object.keys(secrets).length > 0) {
      const encKey = Deno.env.get("INTEGRATION_SECRET_KEY") ?? "0".repeat(64);
      secrets_encrypted = await aesGcmEncrypt(JSON.stringify(secrets), encKey);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const upsertData: Record<string, unknown> = {
      tenant_id: tenantId,
      provider,
      config,
      status,
      environment,
      updated_at: new Date().toISOString(),
    };
    if (secrets_encrypted) upsertData.secrets_encrypted = secrets_encrypted;

    const { error } = await supabaseAdmin
      .from("marketing_integrations")
      .upsert(upsertData, { onConflict: "tenant_id,provider" });

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

    return new Response(JSON.stringify({ success: true, message: "تم حفظ الإعدادات بنجاح وتشفير الأسرار" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
