import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { tenant_id, scenario } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();

    // ── Fetch data ──
    const [
      openInvoicesRes,
      recentRevenueRes,
      recentExpenseRes,
      cashflowRes,
      customerRiskRes,
      recurringExpRes,
    ] = await Promise.all([
      supabase.from("invoices")
        .select("id, customer_id, total, due_date, status")
        .eq("tenant_id", tenant_id)
        .in("status", ["sent", "overdue", "partially_paid"]),
      supabase.from("analytics_daily_revenue")
        .select("amount, report_date")
        .eq("tenant_id", tenant_id)
        .gte("report_date", threeMonthsAgo)
        .order("report_date"),
      supabase.from("analytics_daily_expenses")
        .select("amount, report_date")
        .eq("tenant_id", tenant_id)
        .gte("report_date", threeMonthsAgo)
        .order("report_date"),
      supabase.from("analytics_daily_cashflow")
        .select("inflow, outflow, net_flow, report_date")
        .eq("tenant_id", tenant_id)
        .gte("report_date", threeMonthsAgo)
        .order("report_date"),
      supabase.from("tenant_customer_risk")
        .select("customer_id, risk_score")
        .eq("tenant_id", tenant_id),
      supabase.from("expenses")
        .select("amount, is_recurring, category")
        .eq("tenant_id", tenant_id)
        .eq("is_recurring", true),
    ]);

    const openInvoices = openInvoicesRes.data || [];
    const revenues = recentRevenueRes.data || [];
    const expenses = recentExpenseRes.data || [];
    const cashflows = cashflowRes.data || [];
    const customerRisks = customerRiskRes.data || [];
    const recurringExpenses = recurringExpRes.data || [];

    // Build risk lookup
    const riskMap: Record<string, number> = {};
    for (const cr of customerRisks) {
      riskMap[cr.customer_id] = cr.risk_score;
    }

    // ── Current balance estimate ──
    const totalNetCashflow = cashflows.reduce((s, r) => s + (r.net_flow || 0), 0);
    const avgDailyRevenue = revenues.length > 0
      ? revenues.reduce((s, r) => s + (r.amount || 0), 0) / 90
      : 0;
    const avgDailyExpense = expenses.length > 0
      ? expenses.reduce((s, r) => s + (r.amount || 0), 0) / 90
      : 0;
    const monthlyRecurring = recurringExpenses.reduce((s, e) => s + (e.amount || 0), 0);

    // ── Build 90-day projection ──
    const projections: any[] = [];
    let runningBalance = totalNetCashflow;

    // Scenario adjustments
    const scenarioDelayDays = scenario?.delay_invoice_days || 0;
    const scenarioExpensePct = scenario?.expense_increase_pct || 0;
    const scenarioAdvancePayment = scenario?.advance_payment || 0;

    if (scenarioAdvancePayment > 0) {
      runningBalance += scenarioAdvancePayment;
    }

    let liquidityAlerts: any[] = [];

    for (let day = 1; day <= 90; day++) {
      const projDate = new Date(now);
      projDate.setDate(projDate.getDate() + day);
      const dateStr = projDate.toISOString().split("T")[0];

      // Expected inflows: invoices due on/before this day, weighted by risk
      const dueInvoices = openInvoices.filter(inv => {
        if (!inv.due_date) return false;
        const dueDate = new Date(inv.due_date);
        if (scenarioDelayDays > 0) dueDate.setDate(dueDate.getDate() + scenarioDelayDays);
        const daysDiff = Math.floor((dueDate.getTime() - projDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff >= -1 && daysDiff <= 0;
      });

      let dayInflow = 0;
      let riskWeightedInflow = 0;
      for (const inv of dueInvoices) {
        const riskScore = riskMap[inv.customer_id] || 0;
        const collectProbability = Math.max(0.2, 1 - (riskScore / 100));
        dayInflow += inv.total || 0;
        riskWeightedInflow += (inv.total || 0) * collectProbability;
      }

      // Add baseline daily revenue estimate for days without specific invoices
      if (dayInflow === 0) {
        riskWeightedInflow = avgDailyRevenue * 0.7;
        dayInflow = avgDailyRevenue;
      }

      // Expected outflows
      let dayOutflow = avgDailyExpense * (1 + scenarioExpensePct / 100);
      // Add monthly recurring on day 1 of each month
      if (projDate.getDate() === 1) {
        dayOutflow += monthlyRecurring;
      }

      runningBalance += riskWeightedInflow - dayOutflow;

      // Liquidity alert check
      let alertLevel: string | null = null;
      if (runningBalance < 0) {
        alertLevel = "critical";
      } else if (runningBalance < avgDailyExpense * 15) {
        alertLevel = "medium";
      } else if (runningBalance < avgDailyExpense * 30) {
        alertLevel = "low";
      }

      if (alertLevel && day <= 45) {
        liquidityAlerts.push({
          day,
          date: dateStr,
          level: alertLevel,
          projected_balance: Math.round(runningBalance),
        });
      }

      projections.push({
        date: dateStr,
        day,
        projected_inflow: Math.round(dayInflow),
        risk_weighted_inflow: Math.round(riskWeightedInflow),
        projected_outflow: Math.round(dayOutflow),
        projected_balance: Math.round(runningBalance),
        liquidity_alert_level: alertLevel,
      });
    }

    // ── Historical actuals (last 30 days) ──
    const actuals = cashflows.slice(-30).map(cf => ({
      date: cf.report_date,
      actual_inflow: Math.round(cf.inflow || 0),
      actual_outflow: Math.round(cf.outflow || 0),
      actual_balance: Math.round(cf.net_flow || 0),
    }));

    // ── Summary metrics ──
    const summary = {
      current_balance: Math.round(totalNetCashflow),
      projected_30d: projections[29]?.projected_balance || 0,
      projected_60d: projections[59]?.projected_balance || 0,
      projected_90d: projections[89]?.projected_balance || 0,
      avg_daily_inflow: Math.round(avgDailyRevenue),
      avg_daily_outflow: Math.round(avgDailyExpense),
      monthly_recurring: Math.round(monthlyRecurring),
      open_invoices_total: openInvoices.reduce((s, i) => s + (i.total || 0), 0),
      risk_weighted_total: Math.round(openInvoices.reduce((s, i) => {
        const risk = riskMap[i.customer_id] || 0;
        return s + (i.total || 0) * Math.max(0.2, 1 - risk / 100);
      }, 0)),
      highest_alert: liquidityAlerts.length > 0
        ? liquidityAlerts.reduce((worst, a) =>
            a.level === "critical" ? a : (a.level === "medium" && worst.level !== "critical") ? a : worst
          )
        : null,
      total_alerts: liquidityAlerts.length,
    };

    // ── AI Recommendations ──
    let recommendations = "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const prompt = `أنت مدير مالي تنفيذي (CFO) في شركة سعودية. بناءً على توقعات التدفق النقدي التالية، اكتب ملخصاً تنفيذياً مختصراً (3-5 جمل) وتوصيات عملية:

- الرصيد الحالي: ${summary.current_balance.toLocaleString()} ر.س
- التوقع بعد 30 يوم: ${summary.projected_30d.toLocaleString()} ر.س
- التوقع بعد 60 يوم: ${summary.projected_60d.toLocaleString()} ر.س
- التوقع بعد 90 يوم: ${summary.projected_90d.toLocaleString()} ر.س
- متوسط التدفق اليومي: ${summary.avg_daily_inflow.toLocaleString()} ر.س وارد / ${summary.avg_daily_outflow.toLocaleString()} ر.س صادر
- فواتير مفتوحة: ${summary.open_invoices_total.toLocaleString()} ر.س (مرجّح بالمخاطر: ${summary.risk_weighted_total.toLocaleString()} ر.س)
- تنبيهات السيولة: ${summary.total_alerts} تنبيه${summary.highest_alert ? ` (أعلى مستوى: ${summary.highest_alert.level})` : ""}

يجب أن يتضمن الملخص:
1. تقييم وضع السيولة
2. تنبيهات مخاطر إن وُجدت
3. ثلاث توصيات عملية قابلة للتنفيذ

اكتب بأسلوب تنفيذي مباشر بدون مقدمات.`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "أنت مدير مالي تنفيذي خبير في السوق السعودي. ردودك مختصرة ومهنية بالعربية الفصحى." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          recommendations = aiData.choices?.[0]?.message?.content || "";
        } else if (aiResp.status === 429) {
          recommendations = "تم تجاوز حد الطلبات. يرجى المحاولة لاحقاً.";
        } else if (aiResp.status === 402) {
          recommendations = "يرجى شحن الرصيد للحصول على التوصيات الذكية.";
        }
      } catch (e) {
        console.error("AI error:", e);
        recommendations = `الرصيد الحالي ${summary.current_balance.toLocaleString()} ر.س. التوقع بعد 90 يوم: ${summary.projected_90d.toLocaleString()} ر.س.`;
      }
    }

    // ── Persist projections ──
    const upsertData = projections.filter((_, i) => i % 7 === 0 || i === 29 || i === 59 || i === 89).map(p => ({
      tenant_id,
      projection_date: p.date,
      projected_inflow: p.projected_inflow,
      projected_outflow: p.projected_outflow,
      projected_balance: p.projected_balance,
      risk_weighted_inflow: p.risk_weighted_inflow,
      liquidity_alert_level: p.liquidity_alert_level,
      breakdown_json: { day: p.day },
      last_calculated_at: now.toISOString(),
      updated_at: now.toISOString(),
    }));

    if (!scenario) {
      for (const row of upsertData) {
        await supabase.from("tenant_cashflow_projection").upsert(row, { onConflict: "tenant_id,projection_date" });
      }
    }

    return new Response(JSON.stringify({
      projections,
      actuals,
      summary,
      liquidity_alerts: liquidityAlerts,
      recommendations,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cashflow-radar error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
