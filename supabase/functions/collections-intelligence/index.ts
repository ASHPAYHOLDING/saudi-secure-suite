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

    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    // ── Fetch invoice data for risk scoring ──
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();

    const [invoicesRes, paymentsRes, customersRes] = await Promise.all([
      supabase.from("invoices")
        .select("id, customer_id, total, status, due_date, created_at, paid_at")
        .eq("tenant_id", tenant_id)
        .gte("created_at", sixMonthsAgo),
      supabase.from("payments")
        .select("id, invoice_id, amount, payment_date")
        .eq("tenant_id", tenant_id)
        .gte("payment_date", sixMonthsAgo),
      supabase.from("customers")
        .select("id, name")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true),
    ]);

    const invoices = invoicesRes.data || [];
    const payments = paymentsRes.data || [];
    const customers = customersRes.data || [];

    // Group invoices by customer
    const customerInvoices: Record<string, any[]> = {};
    for (const inv of invoices) {
      if (!inv.customer_id) continue;
      if (!customerInvoices[inv.customer_id]) customerInvoices[inv.customer_id] = [];
      customerInvoices[inv.customer_id].push(inv);
    }

    // ── Calculate risk scores per customer ──
    const riskResults: any[] = [];
    const totalOverdueAmount = invoices
      .filter(i => i.status === "overdue")
      .reduce((s, i) => s + (i.total || 0), 0);

    // DSO calculation
    const paidInvoices = invoices.filter(i => i.paid_at && i.created_at);
    const totalDSO = paidInvoices.length > 0
      ? paidInvoices.reduce((s, i) => {
          const days = (new Date(i.paid_at).getTime() - new Date(i.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return s + Math.max(0, days);
        }, 0) / paidInvoices.length
      : 0;

    // Expected collections next 30 days
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expectedCollections = invoices
      .filter(i => i.status !== "paid" && i.status !== "cancelled" && i.due_date && new Date(i.due_date) <= thirtyDaysFromNow)
      .reduce((s, i) => s + (i.total || 0), 0);

    for (const [customerId, custInvoices] of Object.entries(customerInvoices)) {
      const customer = customers.find(c => c.id === customerId);
      if (!customer) continue;

      // 1. Avg payment delay
      const paidOnes = custInvoices.filter(i => i.paid_at && i.due_date);
      const avgDelay = paidOnes.length > 0
        ? paidOnes.reduce((s, i) => {
            const delay = (new Date(i.paid_at).getTime() - new Date(i.due_date).getTime()) / (1000 * 60 * 60 * 24);
            return s + Math.max(0, delay);
          }, 0) / paidOnes.length
        : 0;

      // 2. Overdue ratio
      const overdueCount = custInvoices.filter(i => i.status === "overdue").length;
      const overdueRatio = custInvoices.length > 0 ? overdueCount / custInvoices.length : 0;

      // 3. Dispute frequency (approximated by cancelled/credit invoices)
      const disputeCount = custInvoices.filter(i => i.status === "cancelled").length;

      // 4. Invoice size volatility
      const amounts = custInvoices.map(i => i.total || 0);
      const avgAmount = amounts.reduce((s, a) => s + a, 0) / (amounts.length || 1);
      const variance = amounts.reduce((s, a) => s + Math.pow(a - avgAmount, 2), 0) / (amounts.length || 1);
      const stdDev = Math.sqrt(variance);
      const volatility = avgAmount > 0 ? stdDev / avgAmount : 0; // CV

      // Weighted risk score (0-100, higher = riskier)
      const delayScore = Math.min(avgDelay / 60, 1) * 35; // 60+ days = max
      const overdueScoreVal = overdueRatio * 30;
      const disputeScore = Math.min(disputeCount / 3, 1) * 20;
      const volatilityScore = Math.min(volatility / 2, 1) * 15;

      const riskScore = Math.round(delayScore + overdueScoreVal + disputeScore + volatilityScore);
      const riskLevel = riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low";

      riskResults.push({
        tenant_id,
        customer_id: customerId,
        customer_name: customer.name,
        risk_score: Math.min(riskScore, 100),
        risk_level: riskLevel,
        avg_payment_delay_days: Math.round(avgDelay),
        overdue_ratio: Math.round(overdueRatio * 100) / 100,
        dispute_frequency: disputeCount,
        invoice_size_volatility: Math.round(volatility * 100) / 100,
        breakdown_json: {
          delay_score: Math.round(delayScore),
          overdue_score: Math.round(overdueScoreVal),
          dispute_score: Math.round(disputeScore),
          volatility_score: Math.round(volatilityScore),
        },
        last_calculated_at: now.toISOString(),
      });
    }

    // ── AI Recommended Actions ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const highRiskCustomers = riskResults.filter(r => r.risk_level === "high" || r.risk_level === "medium");

    if (LOVABLE_API_KEY && highRiskCustomers.length > 0) {
      try {
        const customerSummaries = highRiskCustomers.slice(0, 10).map(r =>
          `- ${r.customer_name}: درجة المخاطر ${r.risk_score}/100، تأخير ${r.avg_payment_delay_days} يوم، نسبة التأخر ${Math.round(r.overdue_ratio * 100)}%`
        ).join("\n");

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "أنت خبير تحصيل ديون في شركة سعودية. اكتب توصيات مختصرة وعملية بالعربية الفصحى." },
              {
                role: "user",
                content: `بناءً على بيانات العملاء التالية، اكتب توصية عملية واحدة مختصرة (جملة واحدة) لكل عميل. ركز على الإجراء المطلوب بأسلوب مهني:\n\n${customerSummaries}\n\nأعد النتائج بصيغة JSON: [{"customer_name": "...", "action": "..."}]`
              },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          try {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const actions = JSON.parse(jsonMatch[0]);
              for (const action of actions) {
                const customer = highRiskCustomers.find(r => r.customer_name === action.customer_name);
                if (customer) customer.recommended_action = action.action;
              }
            }
          } catch { /* ignore parse errors */ }
        }
      } catch (e) {
        console.error("AI actions error:", e);
      }
    }

    // ── Persist risk scores ──
    for (const result of riskResults) {
      const { customer_name, ...upsertData } = result;
      await supabase.from("tenant_customer_risk").upsert(upsertData, {
        onConflict: "tenant_id,customer_id",
      });
    }

    // ── Risk heatmap data ──
    const heatmap = {
      high: riskResults.filter(r => r.risk_level === "high").length,
      medium: riskResults.filter(r => r.risk_level === "medium").length,
      low: riskResults.filter(r => r.risk_level === "low").length,
    };

    return new Response(JSON.stringify({
      customers: riskResults,
      summary: {
        total_overdue: totalOverdueAmount,
        dso: Math.round(totalDSO),
        expected_collections_30d: expectedCollections,
        heatmap,
        total_customers: riskResults.length,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("collections-intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
