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
    // Rate limiting
    const rlAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const blocked = await checkRateLimit(req, rlAdmin, "general", corsHeaders);
    if (blocked) return blocked;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all active payout settings with scheduled payouts
    const { data: settingsList, error: settingsErr } = await supabase
      .from("paylink_payout_settings")
      .select("*")
      .eq("is_active", true)
      .neq("payout_schedule", "manual");

    if (settingsErr) throw settingsErr;

    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // 1=Mon...7=Sun → adjust: Sun=1..Sat=7 in our schema
    const dayOfMonth = now.getDate();
    const results: { tenant_id: string; status: string; amount?: number }[] = [];

    for (const settings of settingsList || []) {
      // Check if today matches the schedule
      let shouldPayout = false;
      if (settings.payout_schedule === "daily") {
        shouldPayout = true;
      } else if (settings.payout_schedule === "weekly" && settings.payout_day) {
        shouldPayout = dayOfWeek === settings.payout_day;
      } else if (settings.payout_schedule === "monthly" && settings.payout_day) {
        shouldPayout = dayOfMonth === settings.payout_day;
      }

      if (!shouldPayout) {
        results.push({ tenant_id: settings.tenant_id, status: "skipped_not_scheduled_today" });
        continue;
      }

      // Check if already processed today
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const { data: existingPayout } = await supabase
        .from("paylink_payouts")
        .select("id")
        .eq("tenant_id", settings.tenant_id)
        .gte("created_at", todayStart.toISOString())
        .limit(1);

      if (existingPayout && existingPayout.length > 0) {
        results.push({ tenant_id: settings.tenant_id, status: "skipped_already_processed" });
        continue;
      }

      // Calculate available balance
      const { data: deposits } = await supabase
        .from("paylink_transactions")
        .select("net_amount")
        .eq("tenant_id", settings.tenant_id)
        .eq("transaction_type", "deposit")
        .eq("status", "completed");

      const { data: withdrawals } = await supabase
        .from("paylink_transactions")
        .select("gross_amount")
        .eq("tenant_id", settings.tenant_id)
        .eq("transaction_type", "withdrawal")
        .eq("status", "completed");

      const { data: completedPayouts } = await supabase
        .from("paylink_payouts")
        .select("net_amount")
        .eq("tenant_id", settings.tenant_id)
        .eq("status", "completed");

      const totalNet = (deposits || []).reduce((s, t) => s + (t.net_amount || 0), 0);
      const totalWithdrawn = (withdrawals || []).reduce((s, t) => s + (t.gross_amount || 0), 0);
      const totalPaidOut = (completedPayouts || []).reduce((s, t) => s + (t.net_amount || 0), 0);
      const availableBalance = totalNet - totalWithdrawn - totalPaidOut;

      if (availableBalance < settings.min_payout_amount) {
        results.push({ tenant_id: settings.tenant_id, status: "skipped_below_minimum", amount: availableBalance });
        continue;
      }

      // Get fee config
      const { data: feeConfig } = await supabase
        .from("paylink_fee_configs")
        .select("*")
        .eq("tenant_id", settings.tenant_id)
        .eq("is_active", true)
        .maybeSingle();

      // Calculate payout fee (optional transfer fee)
      let fee = 0; // No payout fee by default
      const netAmount = availableBalance - fee;

      const payoutNumber = `PO-${Date.now().toString().slice(-8)}`;

      // Create payout record
      const { error: insertErr } = await supabase.from("paylink_payouts").insert({
        tenant_id: settings.tenant_id,
        payout_number: payoutNumber,
        gross_amount: availableBalance,
        fee_amount: fee,
        net_amount: netAmount,
        status: "completed", // In production, this would be "processing" until bank confirms
        bank_name: settings.bank_name,
        iban: settings.iban,
        account_holder_name: settings.account_holder_name,
        scheduled_at: now.toISOString(),
        processed_at: now.toISOString(),
      });

      if (insertErr) {
        results.push({ tenant_id: settings.tenant_id, status: "error: " + insertErr.message });
        continue;
      }

      // Also record as a withdrawal transaction for balance tracking
      await supabase.from("paylink_transactions").insert({
        tenant_id: settings.tenant_id,
        transaction_number: `TXN-AP-${Date.now().toString().slice(-6)}`,
        transaction_type: "withdrawal",
        description: `تحويل تلقائي ${settings.payout_schedule === "daily" ? "يومي" : settings.payout_schedule === "weekly" ? "أسبوعي" : "شهري"} إلى ${settings.bank_name}`,
        gross_amount: netAmount,
        fee_amount: 0,
        net_amount: netAmount,
        status: "completed",
        payment_method: "تحويل بنكي تلقائي",
      });

      // Create tenant notification
      await supabase.from("tenant_notifications").insert({
        tenant_id: settings.tenant_id,
        type: "payout_completed",
        title: "تحويل تلقائي مكتمل",
        message: `تم تحويل ${netAmount.toFixed(2)} ر.س إلى حسابك البنكي (${settings.bank_name} - ...${settings.iban.slice(-4)})`,
        severity: "info",
        entity_type: "payout",
      });

      results.push({ tenant_id: settings.tenant_id, status: "completed", amount: netAmount });
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
