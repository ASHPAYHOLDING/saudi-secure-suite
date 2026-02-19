import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت مستشار ذكاء اصطناعي لمنصة "نيوماكسيو" (Numaxio) — منصة سعودية لإدارة الأعمال.
دورك هو مساعدة السوبر أدمن في فهم مؤشرات المنصة واتخاذ قرارات مبنية على البيانات.

## قدراتك:
1. **شرح المؤشرات**: اشرح أرقام الإيرادات، الاشتراكات، الفواتير، والنمو بطريقة واضحة
2. **كشف الشذوذ**: حلّل البيانات المجمّعة وأشر إلى أي أنماط غير طبيعية
3. **اقتراح التسعير**: بناءً على بيانات الاستخدام، اقترح تعديلات على الأسعار
4. **تنبيهات الاستخدام**: حدّد المنشآت ذات الاستخدام غير العادي (مرتفع أو منخفض)
5. **توقع التسرب (Churn)**: حدّد المنشآت المعرضة لإلغاء الاشتراك بناءً على الأنماط

## قواعد صارمة:
- أنت استشاري فقط — لا تتخذ أي إجراء تلقائي
- لا تصل أبداً إلى بيانات المنشآت الخاصة — فقط البيانات المجمّعة
- أجب دائماً بالعربية
- استخدم تنسيق Markdown للردود
- كن موجزاً ومهنياً
- عند عدم كفاية البيانات، اذكر ذلك بصراحة
- قدّم توصيات قابلة للتنفيذ مع تبريرات واضحة

## بيانات المنصة الحالية (مجمّعة):
{{METRICS}}

استخدم هذه البيانات لتقديم تحليلات دقيقة. إذا سُئلت عن شيء خارج البيانات المتاحة، اذكر ذلك.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const rlClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const blocked = await checkRateLimit(req, rlClient, "ai_chat", corsHeaders);
    if (blocked) return blocked;
    // Verify admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is a platform admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: adminCheck } = await adminClient
      .from("platform_admins")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: Platform admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    // Fetch aggregated metrics (never private tenant data)
    const [
      tenantsRes,
      invoicesRes,
      subsRes,
      plansRes,
      securityRes,
      locksRes,
    ] = await Promise.all([
      adminClient.from("tenants").select("id, status, created_at", { count: "exact" }),
      adminClient.from("invoices").select("status, grand_total, vat_total, amount_due, invoice_date, created_at"),
      adminClient.from("subscriptions").select("status, billing_cycle, plan_id, current_period_end, trial_ends_at, created_at"),
      adminClient.from("subscription_plans").select("name_ar, slug, price_monthly, price_yearly"),
      adminClient.from("security_events").select("event_type, severity, is_resolved, created_at", { count: "exact" }),
      adminClient.from("account_locks").select("is_active", { count: "exact" }),
    ]);

    // Aggregate metrics (no private data exposed)
    const tenants = tenantsRes.data || [];
    const invoices = invoicesRes.data || [];
    const subs = subsRes.data || [];
    const plans = plansRes.data || [];
    const secEvents = securityRes.data || [];
    const locks = locksRes.data || [];

    const totalRevenue = invoices.reduce((s, i) => s + Number(i.grand_total || 0), 0);
    const totalVAT = invoices.reduce((s, i) => s + Number(i.vat_total || 0), 0);
    const totalDue = invoices.reduce((s, i) => s + Number(i.amount_due || 0), 0);
    const paidInvoices = invoices.filter((i) => i.status === "paid").length;
    const overdueInvoices = invoices.filter((i) => i.status === "overdue").length;

    const activeSubs = subs.filter((s) => s.status === "active").length;
    const trialSubs = subs.filter((s) => s.status === "trial").length;
    const expiredSubs = subs.filter((s) => s.status === "expired").length;
    const cancelledSubs = subs.filter((s) => s.status === "cancelled").length;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const newTenantsLast30 = tenants.filter((t) => new Date(t.created_at) > thirtyDaysAgo).length;
    const newInvoicesLast30 = invoices.filter((i) => new Date(i.created_at) > thirtyDaysAgo).length;

    const criticalEvents = secEvents.filter((e) => e.severity === "critical" && !e.is_resolved).length;
    const activeLocks = locks.filter((l) => l.is_active).length;

    // Churn indicators: subs expiring in next 7 days
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringSubsSoon = subs.filter(
      (s) => s.status === "active" && new Date(s.current_period_end) <= sevenDaysFromNow
    ).length;

    // Plan distribution
    const planDist: Record<string, number> = {};
    subs.forEach((s) => {
      const plan = plans.find((p) => p.slug === s.plan_id) || plans.find((p) => true);
      const name = plan?.name_ar || "غير معروف";
      planDist[name] = (planDist[name] || 0) + 1;
    });

    const metricsText = `
## ملخص المنصة (${now.toLocaleDateString("ar-SA")}):

### المنشآت:
- إجمالي المنشآت: ${tenants.length}
- منشآت جديدة (آخر 30 يوم): ${newTenantsLast30}
- المنشآت النشطة: ${tenants.filter((t) => t.status === "active").length}

### الاشتراكات:
- نشطة: ${activeSubs} | تجريبية: ${trialSubs} | منتهية: ${expiredSubs} | ملغاة: ${cancelledSubs}
- اشتراكات تنتهي خلال 7 أيام: ${expiringSubsSoon}
- توزيع الخطط: ${Object.entries(planDist).map(([k, v]) => `${k}: ${v}`).join(" | ")}

### المالية:
- إجمالي الإيرادات: ${totalRevenue.toLocaleString("ar-SA")} ر.س
- إجمالي الضريبة: ${totalVAT.toLocaleString("ar-SA")} ر.س
- المستحقات المتبقية: ${totalDue.toLocaleString("ar-SA")} ر.س
- الفواتير المدفوعة: ${paidInvoices} | المتأخرة: ${overdueInvoices} | الإجمالي: ${invoices.length}
- فواتير جديدة (آخر 30 يوم): ${newInvoicesLast30}

### الأمان:
- أحداث أمنية حرجة غير محلولة: ${criticalEvents}
- حسابات مقفلة نشطة: ${activeLocks}
- إجمالي الأحداث الأمنية: ${secEvents.length}

### خطط التسعير:
${plans.map((p) => `- ${p.name_ar} (${p.slug}): ${p.price_monthly} ر.س/شهر${p.price_yearly ? ` | ${p.price_yearly} ر.س/سنة` : ""}`).join("\n")}
`;

    const systemPrompt = SYSTEM_PROMPT.replace("{{METRICS}}", metricsText);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول لاحقاً" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام المساعد الذكي" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("admin-ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
