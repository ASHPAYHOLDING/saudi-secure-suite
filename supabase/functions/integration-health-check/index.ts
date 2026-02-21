import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Provider ping endpoints (lightweight health checks)
const PROVIDER_PING: Record<string, { url: string; method: string }> = {
  paytabs:    { url: "https://secure.paytabs.sa/payment/version", method: "GET" },
  myfatoorah: { url: "https://apitest.myfatoorah.com/v2/", method: "GET" },
  telr:       { url: "https://secure.telr.com/gateway/order.json", method: "GET" },
  paypal:     { url: "https://api-m.paypal.com/v1/oauth2/token", method: "GET" },
  tabby:      { url: "https://api.tabby.ai/api/v1/", method: "GET" },
  tamara:     { url: "https://api.tamara.co/", method: "GET" },
  tap:        { url: "https://api.tap.company/v2/", method: "GET" },
  moyasar:    { url: "https://api.moyasar.com/v1/", method: "GET" },
  stripe:     { url: "https://api.stripe.com/v1/", method: "GET" },
  geidea:     { url: "https://api.merchant.geidea.net/", method: "GET" },
  hyperpay:   { url: "https://eu-prod.oppwa.com/v1/", method: "GET" },
  madfu:      { url: "https://api.madfu.com.sa/", method: "GET" },
  emkan:      { url: "https://merchants.emkanfinance.com.sa/", method: "GET" },
  mispay:     { url: "https://api.mispay.co/", method: "GET" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all connected providers across all tenants
    const { data: connectedProviders, error: fetchErr } = await supabase
      .from("tenant_payment_providers")
      .select("tenant_id, provider, status")
      .in("status", ["connected", "tested", "active"]);

    if (fetchErr) throw fetchErr;
    if (!connectedProviders || connectedProviders.length === 0) {
      return new Response(JSON.stringify({ checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let checked = 0;
    let alertsCreated = 0;

    for (const prov of connectedProviders) {
      const providerKey = prov.provider;
      const tenantId = prov.tenant_id;
      const pingConfig = PROVIDER_PING[providerKey];

      let status: "healthy" | "degraded" | "down" = "healthy";
      let latencyMs: number | null = null;
      let errorCode: string | null = null;
      let errorMessage: string | null = null;

      if (pingConfig) {
        const start = Date.now();
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(pingConfig.url, {
            method: pingConfig.method,
            signal: controller.signal,
          });
          clearTimeout(timeout);
          latencyMs = Date.now() - start;

          // Any response (even 401/403) means the provider is reachable
          if (res.status >= 500) {
            status = "down";
            errorCode = `HTTP_${res.status}`;
            errorMessage = `Server error ${res.status}`;
          } else if (latencyMs > 5000) {
            status = "degraded";
            errorMessage = `High latency: ${latencyMs}ms`;
          }
          // Consume body to prevent leaks
          await res.text();
        } catch (err: any) {
          latencyMs = Date.now() - start;
          if (err.name === "AbortError") {
            status = "down";
            errorCode = "TIMEOUT";
            errorMessage = "Connection timed out (8s)";
          } else {
            status = "down";
            errorCode = "NETWORK_ERROR";
            errorMessage = err.message?.substring(0, 200) || "Unknown error";
          }
        }
      }
      // If no ping endpoint, mock as healthy
      // (provider doesn't have a public status endpoint)

      // Get previous status
      const { data: existing } = await supabase
        .from("integration_health_checks")
        .select("id, status, consecutive_failures")
        .eq("tenant_id", tenantId)
        .eq("provider_key", providerKey)
        .maybeSingle();

      const prevStatus = existing?.status || "healthy";
      const prevFailures = existing?.consecutive_failures || 0;
      const newFailures = status === "healthy" ? 0 : prevFailures + 1;

      // Upsert health check
      const { error: upsertErr } = await supabase
        .from("integration_health_checks")
        .upsert(
          {
            tenant_id: tenantId,
            provider_key: providerKey,
            status,
            last_checked_at: new Date().toISOString(),
            latency_ms: latencyMs,
            error_code: errorCode,
            error_message: errorMessage,
            consecutive_failures: newFailures,
          },
          { onConflict: "tenant_id,provider_key" }
        );

      if (upsertErr) {
        console.error(`Upsert failed for ${providerKey}@${tenantId}:`, upsertErr);
        continue;
      }

      // Create alert if status changed to down
      if (status === "down" && prevStatus !== "down") {
        const { error: alertErr } = await supabase
          .from("integration_alerts")
          .insert({
            tenant_id: tenantId,
            provider_key: providerKey,
            severity: "critical",
            title: `بوابة ${providerKey} غير متاحة`,
            body: errorMessage || `فشل الاتصال بـ ${providerKey}. الرجاء التحقق من إعدادات البوابة.`,
          });
        if (!alertErr) alertsCreated++;

        // Also push to notification center
        const { data: members } = await supabase
          .from("tenant_members")
          .select("user_id")
          .eq("tenant_id", tenantId)
          .in("role", ["owner", "admin"]);

        if (members && members.length > 0) {
          const notifications = members.map((m: any) => ({
            tenant_id: tenantId,
            user_id: m.user_id,
            actor_id: m.user_id,
            type: "integration_alert",
            message: `⚠️ بوابة ${providerKey} غير متاحة — يرجى التحقق`,
            entity_type: "integration",
            entity_id: providerKey,
          }));
          await supabase.from("collaboration_notifications").insert(notifications);
        }
      }

      // Auto-resolve alert if recovered
      if (status === "healthy" && prevStatus === "down") {
        await supabase
          .from("integration_alerts")
          .update({ resolved_at: new Date().toISOString() })
          .eq("tenant_id", tenantId)
          .eq("provider_key", providerKey)
          .is("resolved_at", null);
      }

      checked++;
    }

    return new Response(
      JSON.stringify({ checked, alertsCreated, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Health check error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
