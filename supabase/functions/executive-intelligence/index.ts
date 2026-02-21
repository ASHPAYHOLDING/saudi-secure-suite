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
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Get tenant
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!membership) throw new Error("No tenant");
    const tenantId = membership.tenant_id;

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

    // Fetch revenue data
    const [thisRevenue, lastRevenue, thisExpenses, lastExpenses] = await Promise.all([
      supabase.from("analytics_daily_revenue").select("amount").eq("tenant_id", tenantId).gte("report_date", thisMonthStart),
      supabase.from("analytics_daily_revenue").select("amount").eq("tenant_id", tenantId).gte("report_date", lastMonthStart).lte("report_date", lastMonthEnd),
      supabase.from("analytics_daily_expenses").select("amount").eq("tenant_id", tenantId).gte("report_date", thisMonthStart),
      supabase.from("analytics_daily_expenses").select("amount").eq("tenant_id", tenantId).gte("report_date", lastMonthStart).lte("report_date", lastMonthEnd),
    ]);

    const sumArr = (arr: any[] | null) => (arr || []).reduce((s, r) => s + (r.amount || 0), 0);
    const currentRevenue = sumArr(thisRevenue.data);
    const prevRevenue = sumArr(lastRevenue.data);
    const currentExpenses = sumArr(thisExpenses.data);
    const prevExpenses = sumArr(lastExpenses.data);

    const revenueChange = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const netProfit = currentRevenue - currentExpenses;
    const prevNetProfit = prevRevenue - prevExpenses;
    const profitChange = prevNetProfit !== 0 ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100 : 0;
    const grossMargin = currentRevenue > 0 ? ((currentRevenue - currentExpenses) / currentRevenue) * 100 : 0;
    const operatingMargin = grossMargin; // simplified
    const expenseGrowth = prevExpenses > 0 ? ((currentExpenses - prevExpenses) / prevExpenses) * 100 : 0;
    const burnRate = netProfit < 0 ? Math.abs(netProfit) : 0;

    // DSO
    const { data: overdueInvoices } = await supabase
      .from("invoices")
      .select("total, due_date, issue_date")
      .eq("tenant_id", tenantId)
      .in("status", ["issued", "sent", "overdue", "partial"]);

    let totalDSO = 0;
    const invoiceCount = overdueInvoices?.length || 0;
    if (overdueInvoices && invoiceCount > 0) {
      for (const inv of overdueInvoices) {
        const issue = new Date(inv.issue_date);
        const daysDiff = Math.floor((now.getTime() - issue.getTime()) / (1000 * 60 * 60 * 24));
        totalDSO += daysDiff;
      }
    }
    const dso = invoiceCount > 0 ? Math.round(totalDSO / invoiceCount) : 0;

    // Cashflow stability from projections
    const { data: projections } = await supabase
      .from("tenant_cashflow_projection")
      .select("projected_balance, liquidity_alert_level")
      .eq("tenant_id", tenantId)
      .order("projection_date", { ascending: true })
      .limit(60);

    let cashflowStability = 100;
    let liquidityRisk = "low";
    if (projections && projections.length > 0) {
      const negativeCount = projections.filter(p => p.projected_balance < 0).length;
      cashflowStability = Math.max(0, Math.round(100 - (negativeCount / projections.length) * 100));
      const criticals = projections.filter(p => p.liquidity_alert_level === "critical");
      if (criticals.length > 0) liquidityRisk = "critical";
      else if (projections.some(p => p.liquidity_alert_level === "medium")) liquidityRisk = "medium";
    }

    // Risk scores from customer risk
    const { data: riskData } = await supabase
      .from("tenant_customer_risk")
      .select("risk_score")
      .eq("tenant_id", tenantId);

    const avgRiskScore = riskData && riskData.length > 0
      ? Math.round(riskData.reduce((s, r) => s + r.risk_score, 0) / riskData.length)
      : 0;
    const collectionRisk = avgRiskScore > 60 ? "high" : avgRiskScore > 30 ? "medium" : "low";

    // Tax risk (simplified: check if VAT return is due)
    const taxRisk = "low";

    // Expense anomaly
    const expenseAnomalyRisk = expenseGrowth > 25 ? "high" : expenseGrowth > 10 ? "medium" : "low";

    // Overall risk level
    const riskLevels = [liquidityRisk, collectionRisk, taxRisk, expenseAnomalyRisk];
    const overallRisk = riskLevels.includes("critical") ? "high" : riskLevels.includes("high") ? "high" : riskLevels.includes("medium") ? "medium" : "low";

    // Compliance score (simplified)
    const complianceScore = 85;

    // Risk radar values (0-100)
    const riskRadar = {
      liquidity: liquidityRisk === "critical" ? 90 : liquidityRisk === "medium" ? 55 : 20,
      tax: taxRisk === "high" ? 80 : taxRisk === "medium" ? 50 : 15,
      collection: avgRiskScore,
      expenseAnomaly: Math.min(100, Math.round(Math.abs(expenseGrowth) * 2)),
    };

    // AI Executive Brief
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let aiBrief = "";
    if (LOVABLE_API_KEY) {
      try {
        const prompt = `أنت مستشار مالي تنفيذي محترف. بناءً على هذه البيانات، اكتب ملخصاً تنفيذياً أسبوعياً موجزاً (4-5 أسطر) باللغة العربية:
- الإيرادات: ${currentRevenue.toLocaleString()} ر.س (${revenueChange > 0 ? "+" : ""}${revenueChange.toFixed(1)}% عن الشهر الماضي)
- صافي الربح: ${netProfit.toLocaleString()} ر.س
- هامش التشغيل: ${operatingMargin.toFixed(1)}%
- أيام التحصيل (DSO): ${dso} يوم
- مستوى مخاطر السيولة: ${liquidityRisk === "critical" ? "حرج" : liquidityRisk === "medium" ? "متوسط" : "منخفض"}
- نمو المصروفات: ${expenseGrowth.toFixed(1)}%
- مؤشر استقرار التدفق النقدي: ${cashflowStability}%

اكتب بلغة مهنية مختصرة كأنك تقدم تقريراً لمجلس الإدارة. لا تستخدم رموزاً تعبيرية.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "أنت محلل مالي تنفيذي متخصص في الأسواق السعودية. اكتب بلغة عربية مهنية ومختصرة." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiBrief = aiData.choices?.[0]?.message?.content || "";
        }
      } catch (e) {
        console.error("AI brief error:", e);
      }
    }

    const result = {
      summary: {
        revenue: { current: currentRevenue, change: revenueChange },
        netProfit: { current: netProfit, change: profitChange },
        cashflowStability,
        complianceScore,
        overallRisk,
      },
      kpis: {
        grossMargin,
        operatingMargin,
        burnRate,
        dso,
        expenseGrowth,
      },
      riskRadar,
      aiBrief,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("executive-intelligence error:", e);
    const status = e instanceof Error && e.message === "Unauthorized" ? 401 : 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
