import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Determine date range — default: yesterday (nightly run)
    let targetDate: string;
    try {
      const body = await req.json();
      targetDate = body.date || yesterday();
    } catch {
      targetDate = yesterday();
    }

    console.log(`[analytics-etl] Running for date: ${targetDate}`);

    // Get all active tenants
    const { data: tenants } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("is_active", true);

    if (!tenants || tenants.length === 0) {
      return json({ ok: true, message: "No active tenants" });
    }

    let processed = 0;

    for (const tenant of tenants) {
      const tid = tenant.id;

      // ── 1) Revenue: sum of posted invoices for the day ──
      const { data: revenueData } = await supabaseAdmin
        .from("invoices")
        .select("grand_total, branch_id")
        .eq("tenant_id", tid)
        .eq("status", "approved")
        .gte("invoice_date", targetDate)
        .lt("invoice_date", nextDay(targetDate));

      const revByBranch = groupBy(revenueData || [], "branch_id");
      for (const [branchId, items] of Object.entries(revByBranch)) {
        const amount = items.reduce((s: number, i: any) => s + Number(i.grand_total || 0), 0);
        await upsertRevenue(supabaseAdmin, tid, targetDate, branchId === "null" ? null : branchId, amount, items.length);
      }

      // ── 2) Expenses: sum of approved expenses for the day ──
      const { data: expenseData } = await supabaseAdmin
        .from("expenses")
        .select("total_amount, branch_id")
        .eq("tenant_id", tid)
        .eq("status", "approved")
        .gte("expense_date", targetDate)
        .lt("expense_date", nextDay(targetDate));

      const expByBranch = groupBy(expenseData || [], "branch_id");
      for (const [branchId, items] of Object.entries(expByBranch)) {
        const amount = items.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
        await upsertExpenses(supabaseAdmin, tid, targetDate, branchId === "null" ? null : branchId, amount, items.length);
      }

      // ── 3) Cashflow: invoice payments (inflow) ──
      const { data: payments } = await supabaseAdmin
        .from("invoice_payments")
        .select("amount, invoice_id")
        .eq("tenant_id", tid)
        .eq("is_reversed", false)
        .gte("payment_date", targetDate)
        .lt("payment_date", nextDay(targetDate));

      const totalInflow = (payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      // Outflow = expenses amount
      const totalOutflow = (expenseData || []).reduce((s: number, e: any) => s + Number(e.total_amount || 0), 0);

      await upsertCashflow(supabaseAdmin, tid, targetDate, null, totalInflow, totalOutflow, (payments || []).length);

      processed++;
    }

    console.log(`[analytics-etl] Processed ${processed} tenants for ${targetDate}`);

    return json({ ok: true, processed, date: targetDate });
  } catch (err: any) {
    console.error("[analytics-etl] Error:", err.message);
    return json({ error: err.message }, 500);
  }
});

/* ── Helpers ── */

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function nextDay(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function groupBy(arr: any[], key: string): Record<string, any[]> {
  const m: Record<string, any[]> = {};
  for (const item of arr) {
    const k = String(item[key] ?? "null");
    (m[k] = m[k] || []).push(item);
  }
  return m;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function upsertRevenue(sb: any, tenantId: string, date: string, branchId: string | null, amount: number, count: number) {
  // Try update first, then insert (idempotent)
  const filter = sb
    .from("analytics_daily_revenue")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("report_date", date);

  if (branchId) filter.eq("branch_id", branchId);
  else filter.is("branch_id", null);

  filter.is("legal_entity_id", null);

  const { data: existing } = await filter.maybeSingle();

  if (existing) {
    await sb.from("analytics_daily_revenue").update({ amount, invoice_count: count }).eq("id", existing.id);
  } else {
    await sb.from("analytics_daily_revenue").insert({
      tenant_id: tenantId,
      report_date: date,
      branch_id: branchId,
      legal_entity_id: null,
      amount,
      invoice_count: count,
    });
  }
}

async function upsertExpenses(sb: any, tenantId: string, date: string, branchId: string | null, amount: number, count: number) {
  const filter = sb
    .from("analytics_daily_expenses")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("report_date", date);

  if (branchId) filter.eq("branch_id", branchId);
  else filter.is("branch_id", null);

  filter.is("legal_entity_id", null);

  const { data: existing } = await filter.maybeSingle();

  if (existing) {
    await sb.from("analytics_daily_expenses").update({ amount, expense_count: count }).eq("id", existing.id);
  } else {
    await sb.from("analytics_daily_expenses").insert({
      tenant_id: tenantId,
      report_date: date,
      branch_id: branchId,
      legal_entity_id: null,
      amount,
      expense_count: count,
    });
  }
}

async function upsertCashflow(sb: any, tenantId: string, date: string, branchId: string | null, inflow: number, outflow: number, count: number) {
  const filter = sb
    .from("analytics_daily_cashflow")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("report_date", date);

  if (branchId) filter.eq("branch_id", branchId);
  else filter.is("branch_id", null);

  filter.is("legal_entity_id", null);

  const { data: existing } = await filter.maybeSingle();

  if (existing) {
    await sb.from("analytics_daily_cashflow").update({ inflow, outflow, net_flow: inflow - outflow, payment_count: count }).eq("id", existing.id);
  } else {
    await sb.from("analytics_daily_cashflow").insert({
      tenant_id: tenantId,
      report_date: date,
      branch_id: branchId,
      legal_entity_id: null,
      inflow,
      outflow,
      net_flow: inflow - outflow,
      payment_count: count,
    });
  }
}
