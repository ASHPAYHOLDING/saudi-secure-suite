import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Trial Nudge Scheduler
 * Called by cron daily. Checks active trials and sends nudge notifications
 * at day 7, day 12, and day 14 (last day).
 * Also expires stale trials.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Expire stale trials
    const { data: expireResult } = await supabase.rpc("expire_stale_trials");
    const expiredCount = expireResult ?? 0;

    // 2. Find active trials needing nudges
    const now = new Date();
    const { data: activeTrials, error } = await supabase
      .from("tenants")
      .select("id, name, trial_ends_at, created_by")
      .eq("trial_status", "active")
      .not("trial_ends_at", "is", null);

    if (error) throw error;

    let nudgesSent = 0;

    for (const tenant of activeTrials || []) {
      const endsAt = new Date(tenant.trial_ends_at);
      const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / 86400000);

      // Nudge at day 7 (7 days left), day 12 (2 days left), day 14 (0 days left)
      const shouldNudge = daysLeft === 7 || daysLeft === 2 || daysLeft === 0;
      if (!shouldNudge) continue;

      // Determine nudge type and message
      let title: string;
      let message: string;
      let severity: string;

      if (daysLeft === 7) {
        title = "نصف فترة التجربة انقضت ⏳";
        message = `متبقي 7 أيام في فترة التجربة المجانية. اشترك الآن لضمان استمرار الوصول لجميع بياناتك.`;
        severity = "info";
      } else if (daysLeft === 2) {
        title = "يومان فقط على انتهاء التجربة ⚠️";
        message = `تبقى يومان فقط في فترة التجربة. اشترك الآن لتفادي فقدان الوصول.`;
        severity = "warning";
      } else {
        title = "اليوم آخر يوم في التجربة المجانية 🔔";
        message = `تنتهي فترة التجربة اليوم. اشترك الآن للاستمرار في استخدام نيوماكسيو بجميع مميزاته.`;
        severity = "critical";
      }

      // Get owner user_id for in-app notification
      const { data: owner } = await supabase
        .from("tenant_members")
        .select("user_id")
        .eq("tenant_id", tenant.id)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle();

      if (!owner) continue;

      // Check idempotency - don't send same nudge twice
      const idempotencyKey = `trial_nudge_${tenant.id}_day${daysLeft}`;
      const { data: existing } = await supabase
        .from("notification_outbox")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .eq("tenant_id", tenant.id)
        .maybeSingle();

      if (existing) continue; // Already sent

      // Insert in-app notification
      await supabase.from("notifications").insert({
        user_id: owner.user_id,
        tenant_id: tenant.id,
        title,
        message,
        type: "subscription",
        severity,
        action_url: "/dashboard/subscription",
        metadata: { nudge_type: "trial", days_left: daysLeft },
      });

      // Queue to notification outbox for email delivery
      await supabase.from("notification_outbox").insert({
        tenant_id: tenant.id,
        idempotency_key: idempotencyKey,
        channel: "email",
        recipient_user_id: owner.user_id,
        subject: title,
        body_text: message,
        status: "pending",
        metadata: { nudge_type: "trial", days_left: daysLeft },
      });

      nudgesSent++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired_count: expiredCount,
        nudges_sent: nudgesSent,
        trials_checked: activeTrials?.length ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Trial nudge error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
