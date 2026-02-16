import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
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

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === email);

    let userId: string;

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
