import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { withRequestTimeout } from "../_shared/timeout-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UPGRADE_TIMEOUT_MS = 8000; // Financial ops get slightly more time

Deno.serve(withRequestTimeout(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const rlAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const blocked = await checkRateLimit(req, rlAdmin, "subscription_upgrade", corsHeaders);
    if (blocked) return blocked;
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

    const { plan_id, billing_cycle, discount_code, idempotency_key } = await req.json();

    if (!plan_id || !billing_cycle) {
      return new Response(JSON.stringify({ error: "بيانات ناقصة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── IDEMPOTENCY CHECK: Prevent double-charge ──
    if (idempotency_key) {
      const { data: existingLog } = await supabase
        .from("subscription_logs")
        .select("id")
        .eq("notes", `idempotency:${idempotency_key}`)
        .limit(1)
        .maybeSingle();

      if (existingLog) {
        return new Response(JSON.stringify({
          success: true,
          message: "تمت معالجة هذا الطلب مسبقاً",
          already_processed: true,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

    // Enterprise plan is now available for direct purchase like other plans

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

    // ── GUARD: Price must be positive ──
    if (price <= 0) {
      return new Response(JSON.stringify({ error: "سعر الباقة غير صالح" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Validate discount code (without consuming it)
    let finalPrice = price;
    let appliedDiscountId: string | null = null;
    let appliedDiscountCode: string | null = null;

    if (discount_code) {
      const { data: discountResult } = await supabase.rpc("validate_subscription_discount", {
        _code: discount_code,
        _tenant_id: tenantId,
        _plan_id: plan_id,
      });

      if (discountResult && discountResult.success) {
        finalPrice = discountResult.amount_after;
        appliedDiscountId = discountResult.discount_id;
        appliedDiscountCode = discountResult.code;
      } else {
        return new Response(JSON.stringify({ error: discountResult?.error || "كود الخصم غير صالح" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── GUARD: Final price must not be negative ──
    if (finalPrice < 0) {
      return new Response(JSON.stringify({ error: "السعر النهائي غير صالح بعد الخصم" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Wallet operations (skip if free via discount)
    let balanceBefore = 0;
    let balanceAfter = 0;
    let wallet: any = null;

    if (finalPrice > 0) {
      const { data: w } = await supabase
        .from("tenant_wallets")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      wallet = w;

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

      // 7. Deduct from wallet (atomic with optimistic lock)
      balanceBefore = wallet.balance_available;
      balanceAfter = balanceBefore - finalPrice;

      const { data: walletUpdateResult, error: walletUpdateErr } = await supabase
        .from("tenant_wallets")
        .update({
          balance_available: balanceAfter,
          updated_at: new Date().toISOString(),
        })
        .eq("id", wallet.id)
        .eq("balance_available", balanceBefore) // Optimistic lock
        .select("id")
        .maybeSingle();

      if (walletUpdateErr || !walletUpdateResult) {
        return new Response(JSON.stringify({ error: "فشل في خصم المبلغ - يرجى المحاولة مرة أخرى (قد يكون الرصيد تغير)" }), {
          status: 409,
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
        const { error: rollbackErr } = await supabase
          .from("tenant_wallets")
          .update({ balance_available: balanceBefore, updated_at: new Date().toISOString() })
          .eq("id", wallet.id)
          .eq("balance_available", balanceAfter);
        if (rollbackErr) {
          console.error("Rollback with optimistic lock failed, attempting forced rollback via RPC");
          await supabase.rpc("process_wallet_transaction", {
            p_wallet_id: wallet.id, p_type: "credit", p_amount: finalPrice,
            p_reason: "rollback", p_reference_type: "subscription_rollback",
            p_reference_id: currentSub.id, p_actor_id: user.id, p_source: "system",
          });
        }
        console.error("Wallet transaction insert error:", txnErr);
        return new Response(JSON.stringify({ error: "فشل تسجيل العملية المالية" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
        cancel_at_period_end: false,
      })
      .eq("id", currentSub.id);

    if (subUpdateErr) {
      console.error("Subscription update error:", JSON.stringify(subUpdateErr));
      // Rollback wallet with optimistic lock (only if we charged)
      if (finalPrice > 0 && wallet) {
        const { error: rollbackErr2 } = await supabase
          .from("tenant_wallets")
          .update({ balance_available: balanceBefore, updated_at: new Date().toISOString() })
          .eq("id", wallet.id)
          .eq("balance_available", balanceAfter);
        if (rollbackErr2) {
          console.error("Rollback with optimistic lock failed on sub update, using RPC");
          await supabase.rpc("process_wallet_transaction", {
            p_wallet_id: wallet.id, p_type: "credit", p_amount: finalPrice,
            p_reason: "rollback", p_reference_type: "subscription_rollback",
            p_reference_id: currentSub.id, p_actor_id: user.id, p_source: "system",
          });
        }
      }

      return new Response(JSON.stringify({ error: `فشل تحديث الاشتراك: ${subUpdateErr.message || subUpdateErr.code || 'خطأ غير معروف'}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 10. Record discount usage (only after successful payment + subscription update)
    if (appliedDiscountId) {
      await supabase.rpc("record_discount_usage", {
        _discount_id: appliedDiscountId,
        _tenant_id: tenantId,
        _subscription_id: currentSub.id,
        _amount_before: price,
        _amount_after: finalPrice,
      });
    }

    // 11. Log the change with idempotency marker
    const idempotencyNote = idempotency_key ? ` | idempotency:${idempotency_key}` : "";
    await supabase.from("subscription_logs").insert({
      subscription_id: currentSub.id,
      tenant_id: tenantId,
      action: isUpgrade ? "upgrade" : "downgrade",
      old_plan_id: currentSub.plan_id,
      new_plan_id: plan.id,
      old_status: currentSub.status,
      new_status: "active",
      performed_by: user.id,
      notes: `${isUpgrade ? "ترقية" : "تخفيض"} إلى ${plan.name_ar} - ${CYCLE_LABELS[billing_cycle]} - تم الدفع ${finalPrice} ر.س من المحفظة${appliedDiscountId ? " (مع خصم)" : ""}${idempotencyNote}`,
    });

    // 12. Audit log
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
        discount_id: appliedDiscountId,
        wallet_balance_before: balanceBefore,
        wallet_balance_after: balanceAfter,
        idempotency_key: idempotency_key || null,
      },
    });

    // 13. Rebuild entitlements cache immediately (fire-and-forget)
    supabase.rpc("rebuild_tenant_entitlements_cache", { p_tenant_id: tenantId })
      .then(({ error }) => {
        if (error) console.error("Entitlements cache rebuild failed:", error);
        else console.log("Entitlements cache rebuilt for tenant:", tenantId);
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
}, UPGRADE_TIMEOUT_MS, corsHeaders));

const CYCLE_LABELS: Record<string, string> = { monthly: "شهري", quarterly: "ربع سنوي", yearly: "سنوي" };
