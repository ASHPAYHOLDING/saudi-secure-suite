import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-correlation-id",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const rlAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const blocked = await checkRateLimit(req, rlAdmin, "invite", corsHeaders);
    if (blocked) return blocked;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the calling user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !callingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, full_name, role, tenant_id } = await req.json();

    if (!email || !tenant_id || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use admin client for privileged operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if calling user is admin of the tenant
    const { data: callerMembership } = await adminClient
      .from("tenant_members")
      .select("role")
      .eq("user_id", callingUser.id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!callerMembership || !["owner", "admin"].includes(callerMembership.role)) {
      return new Response(JSON.stringify({ error: "ليس لديك صلاحية لدعوة أعضاء" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent assigning owner role
    if (role === "owner") {
      return new Response(JSON.stringify({ error: "لا يمكن تعيين دور المالك" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already exists by looking up profiles by email
    const { data: profileMatch } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    const existingUser = profileMatch ? { id: profileMatch.id } : null;

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;

      // Check if already a member
      const { data: existingMember } = await adminClient
        .from("tenant_members")
        .select("id")
        .eq("user_id", userId)
        .eq("tenant_id", tenant_id)
        .single();

      if (existingMember) {
        return new Response(JSON.stringify({ error: "هذا المستخدم عضو بالفعل" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Create new user with a random password (they'll reset it)
      // email_confirm: true prevents Supabase from sending default confirmation email
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: full_name || email },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser.user.id;
      isNewUser = true;

      // Update profile with tenant_id
      await adminClient
        .from("profiles")
        .update({ tenant_id, full_name: full_name || email })
        .eq("id", userId);
    }

    // Add as tenant member
    const { error: memberError } = await adminClient.from("tenant_members").insert({
      tenant_id,
      user_id: userId,
      role,
      invited_by: callingUser.id,
    });

    if (memberError) {
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant name and inviter name for the email
    const { data: tenantData } = await adminClient
      .from("tenants")
      .select("name, name_en")
      .eq("id", tenant_id)
      .single();

    const { data: inviterProfile } = await adminClient
      .from("profiles")
      .select("full_name, full_name_en")
      .eq("id", callingUser.id)
      .single();

    // Role labels mapping
    const roleLabels: Record<string, string> = {
      admin: "مدير",
      editor: "محرر",
      member: "عضو",
      viewer: "مشاهد",
      accountant: "محاسب",
      hr_manager: "مدير موارد بشرية",
    };

    // Send invitation email (not activation email)
    try {
      const emailPayload = {
        email_type: "member_invitation",
        recipient_email: email,
        tenant_id,
        user_id: userId,
        entity_type: "member",
        entity_id: userId,
        data: {
          user_name: full_name || email,
          email,
          company_name: tenantData?.name || "",
          role,
          role_label: roleLabels[role] || role,
          invited_by: inviterProfile?.full_name || callingUser.email || "",
          is_new_user: isNewUser,
          login_url: `${Deno.env.get("SITE_URL") || supabaseUrl.replace('.supabase.co', '.lovable.app')}/auth`,
        },
      };

      await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify(emailPayload),
      });
    } catch (emailErr) {
      console.error("[invite-member] Failed to send invitation email:", emailErr);
      // Don't fail the invitation if email fails
    }

    // Log the action
    await adminClient.from("audit_logs").insert({
      tenant_id,
      user_id: callingUser.id,
      action: "invite",
      entity_type: "member",
      entity_id: userId,
      entity_label: email,
      changes: { role, full_name },
    });

    return new Response(
      JSON.stringify({ success: true, message: `تمت دعوة ${email} بنجاح` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
