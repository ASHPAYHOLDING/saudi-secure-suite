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

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    // ── Fetch financial data ──
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();

    const [
      revenueRes,
      expenseRes,
      overdueRes,
      totalInvoicesRes,
      cashflowRes,
      topCustomersRes,
    ] = await Promise.all([
      supabase.from("analytics_daily_revenue").select("amount, report_date").eq("tenant_id", tenant_id).gte("report_date", threeMonthsAgo).order("report_date"),
      supabase.from("analytics_daily_expenses").select("amount, report_date").eq("tenant_id", tenant_id).gte("report_date", threeMonthsAgo).order("report_date"),
      supabase.from("invoices").select("total", { count: "exact", head: false }).eq("tenant_id", tenant_id).eq("status", "overdue"),
      supabase.from("invoices").select("total", { count: "exact", head: false }).eq("tenant_id", tenant_id).gte("created_at", sixMonthsAgo),
      supabase.from("analytics_daily_cashflow").select("net_flow, report_date").eq("tenant_id", tenant_id).gte("report_date", threeMonthsAgo).order("report_date"),
      supabase.from("invoices").select("customer_id, total").eq("tenant_id", tenant_id).gte("created_at", sixMonthsAgo).eq("status", "paid"),
    ]);

    // ── Calculate metrics ──
    const revenues = revenueRes.data || [];
    const expenses = expenseRes.data || [];
    const overdueInvoices = overdueRes.data || [];
    const allInvoices = totalInvoicesRes.data || [];
    const cashflows = cashflowRes.data || [];
    const paidInvoices = topCustomersRes.data || [];

    const totalRevenue = revenues.reduce((s, r) => s + (r.amount || 0), 0);
    const totalExpense = expenses.reduce((s, r) => s + (r.amount || 0), 0);
    const totalOverdue = overdueInvoices.reduce((s, r) => s + (r.total || 0), 0);
    const totalInvoiced = allInvoices.reduce((s, r) => s + (r.total || 0), 0);
    const netCashflow = cashflows.reduce((s, r) => s + (r.net_flow || 0), 0);
    const avgMonthlyExpense = totalExpense / 3 || 1;

    // 1. Cash runway (months)
    const cashRunway = Math.min(netCashflow > 0 ? netCashflow / avgMonthlyExpense : 0, 12);
    const cashRunwayScore = Math.min(cashRunway / 6, 1); // 6+ months = 100%

    // 2. Gross margin stability
    const grossMargin = totalRevenue > 0 ? (totalRevenue - totalExpense) / totalRevenue : 0;
    const grossMarginScore = Math.max(0, Math.min(grossMargin, 1));

    // 3. Revenue growth (simplified: compare first vs second half)
    const midpoint = Math.floor(revenues.length / 2);
    const firstHalf = revenues.slice(0, midpoint).reduce((s, r) => s + (r.amount || 0), 0);
    const secondHalf = revenues.slice(midpoint).reduce((s, r) => s + (r.amount || 0), 0);
    const revenueGrowth = firstHalf > 0 ? (secondHalf - firstHalf) / firstHalf : 0;
    const revenueGrowthScore = Math.max(0, Math.min((revenueGrowth + 0.1) / 0.3, 1));

    // 4. Expense growth vs revenue
    const expenseRatio = totalRevenue > 0 ? totalExpense / totalRevenue : 1;
    const expenseControlScore = Math.max(0, 1 - expenseRatio);

    // 5. Overdue invoice ratio
    const overdueRatio = totalInvoiced > 0 ? totalOverdue / totalInvoiced : 0;
    const overdueScore = Math.max(0, 1 - overdueRatio * 3);

    // 6. Customer concentration
    const customerTotals: Record<string, number> = {};
    for (const inv of paidInvoices) {
      if (inv.customer_id) customerTotals[inv.customer_id] = (customerTotals[inv.customer_id] || 0) + (inv.total || 0);
    }
    const totalPaid = Object.values(customerTotals).reduce((s, v) => s + v, 0);
    const maxCustomer = Math.max(...Object.values(customerTotals), 0);
    const concentrationRatio = totalPaid > 0 ? maxCustomer / totalPaid : 1;
    const concentrationScore = Math.max(0, 1 - concentrationRatio);

    // 7. Liquidity ratio (simplified: net cashflow / monthly expense)
    const liquidityRatio = avgMonthlyExpense > 0 ? netCashflow / avgMonthlyExpense : 0;
    const liquidityScore = Math.max(0, Math.min(liquidityRatio / 3, 1));

    // ── Weighted total ──
    const score = Math.round(
      cashRunwayScore * 20 +
      grossMarginScore * 15 +
      revenueGrowthScore * 15 +
      expenseControlScore * 15 +
      overdueScore * 15 +
      concentrationScore * 10 +
      liquidityScore * 10
    );

    const breakdown = {
      cash_runway: { score: Math.round(cashRunwayScore * 100), weight: 20, value: `${cashRunway.toFixed(1)} شهر` },
      gross_margin: { score: Math.round(grossMarginScore * 100), weight: 15, value: `${(grossMargin * 100).toFixed(1)}%` },
      revenue_growth: { score: Math.round(revenueGrowthScore * 100), weight: 15, value: `${(revenueGrowth * 100).toFixed(1)}%` },
      expense_control: { score: Math.round(expenseControlScore * 100), weight: 15, value: `${(expenseRatio * 100).toFixed(1)}%` },
      overdue_ratio: { score: Math.round(overdueScore * 100), weight: 15, value: `${(overdueRatio * 100).toFixed(1)}%` },
      customer_concentration: { score: Math.round(concentrationScore * 100), weight: 10, value: `${(concentrationRatio * 100).toFixed(1)}%` },
      liquidity: { score: Math.round(liquidityScore * 100), weight: 10, value: `${liquidityRatio.toFixed(2)}` },
    };

    // ── AI CFO Summary ──
    let executiveSummary = "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const prompt = `أنت مدير مالي تنفيذي (CFO) في شركة سعودية. اكتب ملخصاً تنفيذياً مختصراً (3-5 جمل) بالعربية الفصحى الرسمية بناءً على المؤشرات التالية:
- نقاط الصحة المالية: ${score}/100
- احتياطي السيولة: ${cashRunway.toFixed(1)} شهر
- هامش الربح الإجمالي: ${(grossMargin * 100).toFixed(1)}%
- نمو الإيرادات: ${(revenueGrowth * 100).toFixed(1)}%
- نسبة المصروفات للإيرادات: ${(expenseRatio * 100).toFixed(1)}%
- نسبة الفواتير المتأخرة: ${(overdueRatio * 100).toFixed(1)}%
- تركّز العملاء (أكبر عميل): ${(concentrationRatio * 100).toFixed(1)}%

يجب أن يتضمن الملخص:
1. تنبيهات المخاطر إن وُجدت
2. نقاط القوة
3. ثلاث توصيات عملية قابلة للتنفيذ

اكتب بأسلوب تنفيذي مباشر بدون مقدمات أو عبارات تزيينية.`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "أنت مدير مالي تنفيذي (CFO) خبير في السوق السعودي. ردودك مختصرة ومهنية بالعربية الفصحى." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          executiveSummary = aiData.choices?.[0]?.message?.content || "";
        } else {
          console.error("AI gateway error:", aiResp.status);
          executiveSummary = `نقاط الصحة المالية: ${score}/100. احتياطي السيولة ${cashRunway.toFixed(1)} شهر. هامش الربح ${(grossMargin * 100).toFixed(1)}%.`;
        }
      } catch (e) {
        console.error("AI error:", e);
        executiveSummary = `نقاط الصحة المالية: ${score}/100. يرجى مراجعة تفاصيل المؤشرات.`;
      }
    } else {
      executiveSummary = `نقاط الصحة المالية: ${score}/100. احتياطي السيولة ${cashRunway.toFixed(1)} شهر. هامش الربح الإجمالي ${(grossMargin * 100).toFixed(1)}%.`;
    }

    // ── Persist ──
    await supabase.from("tenant_financial_health").upsert(
      {
        tenant_id,
        score,
        breakdown_json: breakdown,
        executive_summary: executiveSummary,
        last_calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );

    return new Response(JSON.stringify({ score, breakdown, executive_summary: executiveSummary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("financial-health error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
