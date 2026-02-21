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
    const code = url.searchParams.get("code");

    if (!stateParam) {
      return new Response("Missing state parameter", { status: 400 });
    }

    let state: { tenant_id: string; email: string; ts: number };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return new Response("Invalid state", { status: 400 });
    }

    if (Date.now() - state.ts > 15 * 60 * 1000) {
      return new Response("SSO request expired", { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify domain belongs to this tenant
    const domain = state.email.split("@")[1].toLowerCase();
    const { data: ssoConfig } = await supabaseAdmin.rpc("lookup_sso_by_domain", { p_domain: domain });

    if (!ssoConfig || ssoConfig.length === 0 || ssoConfig[0].tenant_id !== state.tenant_id) {
      return new Response("SSO configuration mismatch - tenant isolation violated", { status: 403 });
    }

    let verifiedEmail = state.email;
    if (code && ssoConfig[0].provider_type === "oidc") {
      verifiedEmail = state.email;
    }

    // Fetch full SSO settings (including provisioning config)
    const { data: ssoSettings } = await supabaseAdmin
      .from("tenant_sso_settings")
      .select("default_role_id, auto_provisioning_enabled")
      .eq("tenant_id", state.tenant_id)
      .single();

    const autoProvision = ssoSettings?.auto_provisioning_enabled !== false;
    const defaultRoleId = ssoSettings?.default_role_id || null;

    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === verifiedEmail.toLowerCase()
    );

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      if (!autoProvision) {
        return new Response("Auto-provisioning is disabled. Contact your admin.", { status: 403 });
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: verifiedEmail,
        email_confirm: true,
        user_metadata: { sso_provider: ssoConfig[0].provider_type, tenant_id: state.tenant_id },
      });
      if (createError || !newUser.user) {
        return new Response(`Failed to create user: ${createError?.message}`, { status: 500 });
      }
      userId = newUser.user.id;
      isNewUser = true;
    }

    // Check tenant membership
    const { data: membership } = await supabaseAdmin
      .from("tenant_members")
      .select("id")
      .eq("user_id", userId)
      .eq("tenant_id", state.tenant_id)
      .maybeSingle();

    if (!membership) {
      if (!autoProvision && !isNewUser) {
        return new Response("User not a member of this tenant. Auto-provisioning disabled.", { status: 403 });
      }

      // Add to tenant_members
      await supabaseAdmin.from("tenant_members").insert({
        user_id: userId,
        tenant_id: state.tenant_id,
        role: "member",
      });

      // Assign default role if configured
      if (defaultRoleId) {
        await supabaseAdmin.from("user_custom_roles").insert({
          user_id: userId,
          custom_role_id: defaultRoleId,
          tenant_id: state.tenant_id,
        });
      }

      // Assign default branch
      const { data: defaultBranch } = await supabaseAdmin
        .from("branches")
        .select("id")
        .eq("tenant_id", state.tenant_id)
        .eq("is_main", true)
        .maybeSingle();

      if (defaultBranch) {
        await supabaseAdmin.from("branch_members").insert({
          user_id: userId,
          branch_id: defaultBranch.id,
          tenant_id: state.tenant_id,
        });
      }

      // Audit log: user provisioned
      await supabaseAdmin.from("audit_logs").insert({
        tenant_id: state.tenant_id,
        user_id: userId,
        action: "sso_user_provisioned",
        entity_type: "tenant_member",
        entity_id: userId,
        entity_label: verifiedEmail,
        after_value: {
          email: verifiedEmail,
          default_role_id: defaultRoleId,
          branch_id: defaultBranch?.id || null,
          provider_type: ssoConfig[0].provider_type,
        },
      });
    }

    // Audit log: SSO login success
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: state.tenant_id,
      user_id: userId,
      action: "sso_login_success",
      entity_type: "auth",
      entity_id: userId,
      entity_label: verifiedEmail,
      after_value: {
        provider_type: ssoConfig[0].provider_type,
        domain,
        is_new_user: isNewUser,
      },
    });

    // Generate magic link for seamless login
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: verifiedEmail,
    });

    if (linkError || !linkData) {
      return new Response(`Failed to generate session: ${linkError?.message}`, { status: 500 });
    }

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
