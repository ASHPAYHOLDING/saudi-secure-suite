import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "بريد إلكتروني غير صالح" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const domain = email.split("@")[1].toLowerCase();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Lookup SSO config for this domain via service_role
    const { data, error } = await supabaseAdmin.rpc("lookup_sso_by_domain", { p_domain: domain });
    if (error || !data || data.length === 0) {
      return new Response(JSON.stringify({ sso_available: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sso = data[0];

    // Build redirect URL based on provider type
    let redirectUrl = "";
    const state = btoa(JSON.stringify({
      tenant_id: sso.tenant_id,
      email,
      ts: Date.now(),
    }));

    if (sso.provider_type === "saml") {
      // SAML SSO redirect
      const params = new URLSearchParams({
        SAMLRequest: btoa(`<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_${crypto.randomUUID()}" Version="2.0" IssueInstant="${new Date().toISOString()}" AssertionConsumerServiceURL="${Deno.env.get("SUPABASE_URL")}/functions/v1/sso-callback"><saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${sso.issuer}</saml:Issuer></samlp:AuthnRequest>`),
        RelayState: state,
      });
      redirectUrl = `${sso.entry_point}?${params.toString()}`;
    } else if (sso.provider_type === "oidc") {
      // OIDC redirect
      const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sso-callback`;
      const params = new URLSearchParams({
        client_id: sso.client_id || "",
        redirect_uri: callbackUrl,
        response_type: "code",
        scope: "openid email profile",
        state,
      });
      redirectUrl = `${sso.entry_point}?${params.toString()}`;
    }

    return new Response(JSON.stringify({
      sso_available: true,
      provider_type: sso.provider_type,
      redirect_url: redirectUrl,
      tenant_id: sso.tenant_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
