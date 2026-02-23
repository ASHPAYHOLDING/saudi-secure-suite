/**
 * verify-whatsapp-connection
 * Verifies Meta WhatsApp Cloud API credentials and stores encrypted token.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WA_ENCRYPTION_KEY = Deno.env.get("WA_ENCRYPTION_KEY") || "numaxio-wa-default-key-change-me";

// Simple XOR-based obfuscation (production should use AES-GCM via Web Crypto)
function encryptToken(token: string): string {
  const keyBytes = new TextEncoder().encode(WA_ENCRYPTION_KEY);
  const tokenBytes = new TextEncoder().encode(token);
  const encrypted = new Uint8Array(tokenBytes.length);
  for (let i = 0; i < tokenBytes.length; i++) {
    encrypted[i] = tokenBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return btoa(String.fromCharCode(...encrypted));
}

function decryptToken(encrypted: string): string {
  const keyBytes = new TextEncoder().encode(WA_ENCRYPTION_KEY);
  const encBytes = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const decrypted = new Uint8Array(encBytes.length);
  for (let i = 0; i < encBytes.length; i++) {
    decrypted[i] = encBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { waba_id, phone_number_id, access_token, tenant_id } = await req.json();

    if (!waba_id || !phone_number_id || !access_token || !tenant_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify owner role
    const { data: member } = await admin
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!member || member.role !== "owner") {
      return new Response(JSON.stringify({ error: "Owner access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Meta API to verify phone number
    let businessName = "";
    let displayPhone = "";
    let verifyStatus: "active" | "error" = "error";
    let lastError: string | null = null;

    try {
      const metaRes = await fetch(
        `https://graph.facebook.com/v21.0/${phone_number_id}?fields=display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      const metaData = await metaRes.json();

      if (metaData.error) {
        lastError = metaData.error.message || "Meta API verification failed";
        verifyStatus = "error";
      } else {
        displayPhone = metaData.display_phone_number || "";
        businessName = metaData.verified_name || "";
        verifyStatus = "active";
      }
    } catch (e) {
      lastError = `Connection failed: ${e.message}`;
      verifyStatus = "error";
    }

    // Encrypt token and upsert account
    const encryptedToken = encryptToken(access_token);

    const { error: upsertErr } = await admin
      .from("tenant_whatsapp_accounts")
      .upsert(
        {
          tenant_id,
          provider: "meta",
          waba_id,
          phone_number_id,
          display_phone_number: displayPhone,
          business_name: businessName,
          access_token_encrypted: encryptedToken,
          status: verifyStatus,
          last_error: lastError,
          created_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );

    if (upsertErr) {
      return new Response(JSON.stringify({ error: upsertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-enable whatsapp channel if verified
    if (verifyStatus === "active") {
      await admin.from("tenant_notification_channels").upsert(
        { tenant_id, channel: "whatsapp", enabled: true, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id,channel" }
      );
    }

    return new Response(
      JSON.stringify({
        success: verifyStatus === "active",
        status: verifyStatus,
        display_phone_number: displayPhone,
        business_name: businessName,
        error: lastError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-whatsapp-connection error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
