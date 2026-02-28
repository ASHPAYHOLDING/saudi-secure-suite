import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const { token } = await req.json();
    if (!token || typeof token !== "string" || token.length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service_role to bypass RLS for public access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch payment link - only expose non-sensitive fields
    const { data: link, error } = await supabase
      .from("payment_links")
      .select("amount, currency, description, status, expires_at, customer_name, tenant_id")
      .eq("public_token", token)
      .maybeSingle();

    if (error || !link) {
      return new Response(
        JSON.stringify({ success: false, error: "Payment link not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry and update status if needed
    if (link.status === "created" && link.expires_at && new Date(link.expires_at) < new Date()) {
      await supabase
        .from("payment_links")
        .update({ status: "expired" })
        .eq("public_token", token);
      link.status = "expired";
    }

    // Fetch tenant name (non-sensitive)
    let tenantName: string | null = null;
    if (link.tenant_id) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("company_name")
        .eq("id", link.tenant_id)
        .maybeSingle();
      tenantName = tenant?.company_name || null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment: {
          amount: link.amount,
          currency: link.currency,
          description: link.description,
          status: link.status,
          expires_at: link.expires_at,
          customer_name: link.customer_name,
          tenant_name: tenantName,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
