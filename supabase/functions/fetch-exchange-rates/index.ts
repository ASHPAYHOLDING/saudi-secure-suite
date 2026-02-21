import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mock exchange rates (SAR-based) — replace with real API later
const MOCK_RATES: Record<string, number> = {
  USD: 0.2667, // 1 SAR = 0.2667 USD
  EUR: 0.2450,
  GBP: 0.2100,
  AED: 0.9793,
  KWD: 0.0819,
  BHD: 0.1004,
  QAR: 0.9710,
  OMR: 0.1027,
  EGP: 13.28,
  JOD: 0.1889,
  TRY: 9.60,
  INR: 22.44,
  CNY: 1.934,
  JPY: 41.34,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().split("T")[0];

    // Get all active tenants
    const { data: tenants, error: tErr } = await supabase
      .from("tenants")
      .select("id")
      .limit(500);

    if (tErr) throw tErr;

    let inserted = 0;

    for (const tenant of tenants || []) {
      // Add slight randomness to mock rates (±0.5%) to simulate market movement
      const rows = Object.entries(MOCK_RATES).map(([currency, baseRate]) => {
        const jitter = 1 + (Math.random() - 0.5) * 0.01; // ±0.5%
        return {
          tenant_id: tenant.id,
          from_currency: "SAR",
          to_currency: currency,
          rate: Math.round(baseRate * jitter * 10000) / 10000,
          effective_date: today,
        };
      });

      const { error } = await supabase
        .from("currency_rates")
        .upsert(rows, {
          onConflict: "tenant_id,from_currency,to_currency,effective_date",
          ignoreDuplicates: true,
        });

      if (!error) inserted += rows.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        tenants: tenants?.length || 0,
        rates_inserted: inserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
