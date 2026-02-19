import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rlAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const blocked = await checkRateLimit(req, rlAdmin, "general", corsHeaders);
    if (blocked) return blocked;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: { step: string; result: unknown }[] = [];

    // Step 1: Generate recurring commissions for active subscriptions
    const { data: recurringResult, error: recurringErr } = await supabase.rpc(
      "generate_recurring_commissions"
    );
    if (recurringErr) {
      results.push({ step: "recurring_commissions", result: { error: recurringErr.message } });
    } else {
      results.push({ step: "recurring_commissions", result: recurringResult });
    }

    // Step 2: Auto-approve commissions past cooling period (7 days)
    const { data: approvedRows, error: approveErr } = await supabase
      .from("affiliate_commissions")
      .update({ status: "approved" })
      .eq("status", "locked")
      .lt("locked_until", new Date().toISOString())
      .select("id");

    results.push({
      step: "auto_approve_locked",
      result: approveErr
        ? { error: approveErr.message }
        : { approved: approvedRows?.length || 0 },
    });

    // Step 3: Process scheduled payouts
    const { data: payoutResult, error: payoutErr } = await supabase.rpc(
      "process_scheduled_affiliate_payouts"
    );
    if (payoutErr) {
      results.push({ step: "scheduled_payouts", result: { error: payoutErr.message } });
    } else {
      results.push({ step: "scheduled_payouts", result: payoutResult });
    }

    // Step 4: Auto-tier progression
    const { data: affiliates } = await supabase
      .from("affiliates")
      .select("id, tier, total_earnings")
      .eq("status", "active");

    let tierUpgrades = 0;
    for (const aff of affiliates || []) {
      let newTier = aff.tier;
      if (aff.total_earnings >= 50000) newTier = "platinum";
      else if (aff.total_earnings >= 20000) newTier = "gold";
      else if (aff.total_earnings >= 5000) newTier = "silver";
      else newTier = "bronze";

      if (newTier !== aff.tier) {
        // Update tier and commission rate
        const rateMap: Record<string, number> = { bronze: 10, silver: 15, gold: 20, platinum: 25 };
        await supabase
          .from("affiliates")
          .update({
            tier: newTier,
            commission_rate: rateMap[newTier] || 10,
            updated_at: new Date().toISOString(),
          })
          .eq("id", aff.id);
        tierUpgrades++;
      }
    }
    results.push({ step: "tier_progression", result: { upgrades: tierUpgrades } });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
