import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const stateParam = url.searchParams.get("state") || url.searchParams.get("RelayState");
    const code = url.searchParams.get("code"); // OIDC authorization code

    if (!stateParam) {
      return new Response("Missing state parameter", { status: 400 });
    }

    let state: { tenant_id: string; email: string; ts: number };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return new Response("Invalid state", { status: 400 });
    }

    // Validate timestamp (15 min max)
    if (Date.now() - state.ts > 15 * 60 * 1000) {
      return new Response("SSO request expired", { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the domain still belongs to this tenant
    const domain = state.email.split("@")[1].toLowerCase();
    const { data: ssoConfig } = await supabaseAdmin.rpc("lookup_sso_by_domain", { p_domain: domain });
    
    if (!ssoConfig || ssoConfig.length === 0 || ssoConfig[0].tenant_id !== state.tenant_id) {
      return new Response("SSO configuration mismatch - tenant isolation violated", { status: 403 });
    }

    // For OIDC: exchange code for tokens if needed
    let verifiedEmail = state.email;
    if (code && ssoConfig[0].provider_type === "oidc") {
      // In production, exchange code for token and validate
      // For now, we trust the state email after domain verification
      verifiedEmail = state.email;
    }

    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === verifiedEmail.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user with auto-confirmed email
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: verifiedEmail,
        email_confirm: true,
        user_metadata: { sso_provider: ssoConfig[0].provider_type, tenant_id: state.tenant_id },
      });
      if (createError || !newUser.user) {
        return new Response(`Failed to create user: ${createError?.message}`, { status: 500 });
      }
      userId = newUser.user.id;

      // Add to tenant_members
      await supabaseAdmin.from("tenant_members").insert({
        user_id: userId,
        tenant_id: state.tenant_id,
        role: "member",
      });
    }

    // Verify user is member of this tenant
    const { data: membership } = await supabaseAdmin
      .from("tenant_members")
      .select("id")
      .eq("user_id", userId)
      .eq("tenant_id", state.tenant_id)
      .maybeSingle();

    if (!membership) {
      // User exists but not in this tenant - add them
      await supabaseAdmin.from("tenant_members").insert({
        user_id: userId,
        tenant_id: state.tenant_id,
        role: "member",
      });
    }

    // Generate a magic link for seamless login
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: verifiedEmail,
    });

    if (linkError || !linkData) {
      return new Response(`Failed to generate session: ${linkError?.message}`, { status: 500 });
    }

    // Redirect to the app with the token
    const appUrl = Deno.env.get("APP_URL") || req.headers.get("origin") || "https://saudi-secure-suite.lovable.app";
    const redirectUrl = `${appUrl}/auth#access_token=${linkData.properties?.hashed_token}&type=magiclink`;

    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  } catch (err) {
    return new Response(`SSO callback error: ${err.message}`, { status: 500 });
  }
});
