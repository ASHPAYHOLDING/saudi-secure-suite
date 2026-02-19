import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

    // ── Collect Edge Function metrics ──
    const { data: edgeLogs } = await supabaseAdmin
      .from("edge_request_logs")
      .select("duration_ms, status_code, function_name")
      .gte("created_at", fiveMinAgo);

    const logs = edgeLogs || [];
    const durations = logs.filter((l: any) => l.duration_ms != null).map((l: any) => l.duration_ms);
    durations.sort((a: number, b: number) => a - b);

    const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;
    const errorCount = logs.filter((l: any) => l.status_code >= 400).length;
    const errorRate = logs.length > 0 ? (errorCount / logs.length) * 100 : 0;

    // ── Collect Email metrics ──
    const { data: emailLogs } = await supabaseAdmin
      .from("email_logs")
      .select("status")
      .gte("created_at", tenMinAgo);

    const emails = emailLogs || [];
    const emailFailed = emails.filter((e: any) => e.status === "failed").length;
    const emailErrorRate = emails.length > 0 ? (emailFailed / emails.length) * 100 : 0;

    // ── Collect Wallet metrics ──
    const { data: walletLogs } = await supabaseAdmin
      .from("wallet_transactions")
      .select("status")
      .gte("created_at", fiveMinAgo);

    const wallets = walletLogs || [];
    const walletFailed = wallets.filter((w: any) => w.status === "failed").length;
    const walletErrorRate = wallets.length > 0 ? (walletFailed / wallets.length) * 100 : 0;

    // ── Store metrics ──
    const metrics = [
      { metric_source: "edge_function", metric_name: "latency_p50", metric_value: p50 },
      { metric_source: "edge_function", metric_name: "latency_p95", metric_value: p95 },
      { metric_source: "edge_function", metric_name: "error_count", metric_value: errorCount },
      { metric_source: "edge_function", metric_name: "error_rate", metric_value: Math.round(errorRate * 100) / 100 },
      { metric_source: "edge_function", metric_name: "request_count", metric_value: logs.length },
      { metric_source: "email", metric_name: "error_rate", metric_value: Math.round(emailErrorRate * 100) / 100 },
      { metric_source: "email", metric_name: "error_count", metric_value: emailFailed },
      { metric_source: "wallet", metric_name: "error_rate", metric_value: Math.round(walletErrorRate * 100) / 100 },
      { metric_source: "wallet", metric_name: "error_count", metric_value: walletFailed },
    ].map((m) => ({ ...m, recorded_at: now.toISOString() }));

    await supabaseAdmin.from("production_metrics").insert(metrics);

    // ── Evaluate Alert Rules ──
    const { data: rules } = await supabaseAdmin
      .from("monitoring_alert_rules")
      .select("*")
      .eq("is_active", true);

    const activeRules = rules || [];
    const firedAlerts: any[] = [];

    const metricLookup: Record<string, Record<string, number>> = {
      edge_function: { latency_p50: p50, latency_p95: p95, error_rate: errorRate, error_count: errorCount },
      email: { error_rate: emailErrorRate, error_count: emailFailed },
      wallet: { error_rate: walletErrorRate, error_count: walletFailed },
    };

    for (const rule of activeRules as any[]) {
      const sourceMetrics = metricLookup[rule.metric_source];
      if (!sourceMetrics) continue;
      const currentValue = sourceMetrics[rule.metric_name];
      if (currentValue === undefined) continue;

      let breached = false;
      if (rule.condition === "gt" && currentValue > rule.threshold) breached = true;
      if (rule.condition === "gte" && currentValue >= rule.threshold) breached = true;
      if (rule.condition === "lt" && currentValue < rule.threshold) breached = true;
      if (rule.condition === "lte" && currentValue <= rule.threshold) breached = true;

      if (breached) {
        // Check for recent duplicate (don't fire same alert within window)
        const windowAgo = new Date(now.getTime() - rule.window_minutes * 60 * 1000).toISOString();
        const { count } = await supabaseAdmin
          .from("monitoring_alerts")
          .select("id", { count: "exact", head: true })
          .eq("rule_id", rule.id)
          .eq("is_resolved", false)
          .gte("fired_at", windowAgo);

        if ((count || 0) === 0) {
          const sourceLabels: Record<string, string> = {
            edge_function: "الدوال البرمجية",
            email: "البريد",
            wallet: "المحفظة",
            db: "قاعدة البيانات",
            zatca: "زاتكا",
          };
          const message = `⚠️ ${rule.name}: القيمة الحالية ${currentValue.toFixed(1)} تجاوزت الحد ${rule.threshold} (${sourceLabels[rule.metric_source] || rule.metric_source})`;

          firedAlerts.push({
            rule_id: rule.id,
            metric_source: rule.metric_source,
            metric_name: rule.metric_name,
            current_value: currentValue,
            threshold: rule.threshold,
            severity: rule.severity,
            message,
          });
        }
      }
    }

    if (firedAlerts.length > 0) {
      await supabaseAdmin.from("monitoring_alerts").insert(firedAlerts);

      // Notify platform admins
      const { data: admins } = await supabaseAdmin.from("platform_admins").select("user_id");
      if (admins && admins.length > 0) {
        const notifications = firedAlerts.flatMap((alert: any) =>
          admins.map((admin: any) => ({
            tenant_id: "00000000-0000-0000-0000-000000000000",
            user_id: admin.user_id,
            actor_id: admin.user_id,
            type: "monitoring_alert",
            message: alert.message,
            entity_type: "monitoring",
            entity_id: alert.rule_id,
          }))
        );
        // Best-effort notification insert
        await supabaseAdmin.from("collaboration_notifications").insert(notifications).throwOnError().catch(() => {});
      }
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        metrics_recorded: metrics.length,
        alerts_fired: firedAlerts.length,
        edge_p50: p50,
        edge_p95: p95,
        edge_error_rate: errorRate,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("collect-metrics error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
