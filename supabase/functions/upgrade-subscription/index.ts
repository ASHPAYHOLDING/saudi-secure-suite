import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client for auth
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { plan_id, billing_cycle, discount_code } = await req.json();

    if (!plan_id || !billing_cycle) {
      return new Response(JSON.stringify({ error: "بيانات ناقصة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get user's tenant
    const { data: member } = await supabase
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();

    if (!member) {
      return new Response(JSON.stringify({ error: "غير مصرح - يجب أن تكون مالك أو مدير" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = member.tenant_id;

    // 2. Get target plan (server-side price)
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!plan) {
      return new Response(JSON.stringify({ error: "الخطة غير موجودة أو غير متاحة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get current subscription
    const { data: currentSub } = await supabase
      .from("subscriptions")
      .select("*, subscription_plans!inner(sort_order, slug)")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "trial", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!currentSub) {
      return new Response(JSON.stringify({ error: "لا يوجد اشتراك فعال" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent upgrading to same plan
    if (currentSub.plan_id === plan_id) {
      return new Response(JSON.stringify({ error: "أنت مشترك بالفعل في هذه الخطة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Calculate server-side price
    let price: number;
    if (billing_cycle === "yearly" && plan.price_yearly) {
      price = plan.price_yearly;
    } else if (billing_cycle === "quarterly" && plan.price_quarterly) {
      price = plan.price_quarterly;
    } else {
      price = plan.price_monthly;
    }

    // 5. Apply discount code if provided (server-side validation)
    let finalPrice = price;
    let discountId: string | null = null;

    if (discount_code) {
      const { data: discountResult } = await supabase.rpc("apply_subscription_discount", {
        _code: discount_code,
        _tenant_id: tenantId,
        _plan_id: plan_id,
      });

      if (discountResult && discountResult.success) {
        finalPrice = discountResult.amount_after;
        discountId = discountResult.discount_id;
      } else {
        return new Response(JSON.stringify({ error: discountResult?.error || "كود الخصم غير صالح" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 6. Check wallet balance
    const { data: wallet } = await supabase
      .from("tenant_wallets")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!wallet) {
      return new Response(JSON.stringify({ error: "لا توجد محفظة. يرجى إنشاء محفظة أولاً", needs_wallet: true }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (wallet.balance_available < finalPrice) {
      return new Response(JSON.stringify({
        error: `رصيد المحفظة غير كافي. المطلوب: ${finalPrice} ر.س، المتاح: ${wallet.balance_available} ر.س`,
        insufficient_balance: true,
        required: finalPrice,
        available: wallet.balance_available,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Deduct from wallet (atomic)
    const balanceBefore = wallet.balance_available;
    const balanceAfter = balanceBefore - finalPrice;

    const { error: walletUpdateErr } = await supabase
      .from("tenant_wallets")
      .update({
        balance_available: balanceAfter,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id)
      .eq("balance_available", balanceBefore); // Optimistic lock

    if (walletUpdateErr) {
      return new Response(JSON.stringify({ error: "فشل في خصم المبلغ. حاول مرة أخرى" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8. Record wallet transaction
    const { error: txnErr } = await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "debit",
      source: "system",
      reason: "subscription",
      amount: finalPrice,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_type: "subscription",
      reference_id: currentSub.id,
      created_by: user.id,
    });

    if (txnErr) {
      // Rollback wallet balance
      await supabase
        .from("tenant_wallets")
        .update({ balance_available: balanceBefore })
        .eq("id", wallet.id);

      console.error("Wallet transaction insert error:", txnErr);
      return new Response(JSON.stringify({ error: "فشل تسجيل العملية المالية" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. Update subscription
    const periodDays = billing_cycle === "yearly" ? 365 : billing_cycle === "quarterly" ? 90 : 30;
    const newEnd = new Date(Date.now() + periodDays * 86400000).toISOString();
    const isUpgrade = (currentSub.subscription_plans?.sort_order || 0) < plan.sort_order;

    const { error: subUpdateErr } = await supabase
      .from("subscriptions")
      .update({
        plan_id: plan.id,
        billing_cycle: billing_cycle,
        current_period_start: new Date().toISOString(),
        current_period_end: newEnd,
        status: "active",
        grace_ends_at: null,
      })
      .eq("id", currentSub.id);

    if (subUpdateErr) {
      // Rollback wallet
      await supabase
        .from("tenant_wallets")
        .update({ balance_available: balanceBefore })
        .eq("id", wallet.id);

      return new Response(JSON.stringify({ error: "فشل تحديث الاشتراك. تم استرداد المبلغ" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 10. Log the change
    await supabase.from("subscription_logs").insert({
      subscription_id: currentSub.id,
      tenant_id: tenantId,
      action: isUpgrade ? "upgrade" : "downgrade",
      old_plan_id: currentSub.plan_id,
      new_plan_id: plan.id,
      old_status: currentSub.status,
      new_status: "active",
      performed_by: user.id,
      notes: `${isUpgrade ? "ترقية" : "تخفيض"} إلى ${plan.name_ar} - تم الدفع ${finalPrice} ر.س من المحفظة${discountId ? " (مع خصم)" : ""}`,
    });

    // 11. Audit log
    await supabase.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: user.id,
      action: "subscription_payment",
      entity_type: "subscription",
      entity_id: currentSub.id,
      entity_label: plan.name_ar,
      changes: {
        plan_id: plan.id,
        amount_paid: finalPrice,
        original_price: price,
        billing_cycle,
        discount_code: discount_code || null,
        discount_id: discountId,
        wallet_balance_before: balanceBefore,
        wallet_balance_after: balanceAfter,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      message: `تم ${isUpgrade ? "الترقية" : "التخفيض"} بنجاح وخصم ${finalPrice} ر.س من المحفظة`,
      amount_paid: finalPrice,
      new_plan: plan.name_ar,
      new_balance: balanceAfter,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Subscription upgrade error:", err);
    return new Response(JSON.stringify({ error: "حدث خطأ غير متوقع" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
