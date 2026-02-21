import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Auth client (user context)
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Service role client for data access
    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get user's tenant
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = profile.tenant_id;

    // Check AI quota
    const { data: quota } = await supabaseAdmin.rpc("check_ai_quota", { p_tenant_id: tenantId });
    if (!quota?.allowed) {
      return new Response(JSON.stringify({
        error: "ai_quota_exceeded",
        message: "لقد تجاوزت الحد الشهري للمساعد الذكي. يرجى ترقية باقتك.",
        quota,
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, conversationHistory = [] } = await req.json();

    // Fetch financial context for the tenant
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];

    const [revenueRes, expenseRes, cashflowRes, tenantRes] = await Promise.all([
      supabaseAdmin
        .from("analytics_daily_revenue")
        .select("report_date, amount, invoice_count")
        .eq("tenant_id", tenantId)
        .gte("report_date", monthStart)
        .lte("report_date", today)
        .order("report_date", { ascending: true }),
      supabaseAdmin
        .from("analytics_daily_expenses")
        .select("report_date, amount, expense_count")
        .eq("tenant_id", tenantId)
        .gte("report_date", monthStart)
        .lte("report_date", today)
        .order("report_date", { ascending: true }),
      supabaseAdmin
        .from("analytics_daily_cashflow")
        .select("report_date, inflow, outflow, net_flow")
        .eq("tenant_id", tenantId)
        .gte("report_date", monthStart)
        .lte("report_date", today)
        .order("report_date", { ascending: true }),
      supabaseAdmin
        .from("tenants")
        .select("name, vat_number, cr_number")
        .eq("id", tenantId)
        .single(),
    ]);

    const totalRevenue = (revenueRes.data || []).reduce((s, r) => s + (r.amount || 0), 0);
    const totalExpenses = (expenseRes.data || []).reduce((s, r) => s + (r.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const totalInflow = (cashflowRes.data || []).reduce((s, r) => s + (r.inflow || 0), 0);
    const totalOutflow = (cashflowRes.data || []).reduce((s, r) => s + (r.outflow || 0), 0);

    const financialContext = `
## البيانات المالية للمنشأة: ${tenantRes.data?.name || "غير محدد"}
- الفترة: من ${monthStart} إلى ${today}
- إجمالي الإيرادات: ${totalRevenue.toLocaleString("ar-SA")} ر.س
- إجمالي المصروفات: ${totalExpenses.toLocaleString("ar-SA")} ر.س
- صافي الربح: ${netProfit.toLocaleString("ar-SA")} ر.س
- هامش الربح: ${totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0}%
- التدفق النقدي الداخل: ${totalInflow.toLocaleString("ar-SA")} ر.س
- التدفق النقدي الخارج: ${totalOutflow.toLocaleString("ar-SA")} ر.س
- صافي التدفق: ${(totalInflow - totalOutflow).toLocaleString("ar-SA")} ر.س
- الرقم الضريبي: ${tenantRes.data?.vat_number || "غير مسجّل"}
- السجل التجاري: ${tenantRes.data?.cr_number || "غير مسجّل"}
`;

    const systemPrompt = `أنت "نيوماكسيو AI" — مساعد محاسبي ذكي متخصص في المحاسبة السعودية.

## قواعدك:
- تتحدث بالعربية الفصحى المبسّطة بمصطلحات محاسبية سعودية
- تستخدم مصطلحات مثل: "قيد يومي"، "ميزان المراجعة"، "ضريبة القيمة المضافة"، "هيئة الزكاة والضريبة والجمارك"
- تحلل البيانات المالية الحقيقية المقدمة لك
- تنبّه عن مخاطر ضريبية (مواعيد تقديم الإقرار، نسب خاطئة، إلخ)
- تقترح تحسينات للتدفق النقدي بناءً على الأرقام الفعلية
- تقترح قيوداً يومية عند الطلب بصيغة: مدين/دائن مع أرقام الحسابات
- لا تخترع أرقاماً — استخدم فقط البيانات المتاحة
- إذا لم تتوفر بيانات كافية، أخبر المستخدم بذلك بوضوح
- اجعل ردودك مختصرة وعملية

${financialContext}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: "user", content: message },
    ];

    // Call Lovable AI with streaming
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "المساعد مشغول حالياً، يرجى المحاولة بعد قليل." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "خدمة الذكاء الاصطناعي غير متاحة حالياً." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    // Log usage
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    await supabaseAdmin.from("ai_usage_tracking").insert({
      tenant_id: tenantId,
      user_id: userId,
      query_type: "general",
      query_text: message?.substring(0, 500),
      period_month: currentMonth,
      period_year: currentYear,
    });

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("ai-accountant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير متوقع" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
