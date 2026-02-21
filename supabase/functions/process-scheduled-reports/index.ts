import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();

    // Fetch due scheduled reports
    const { data: dueReports, error } = await supabase
      .from("scheduled_reports")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", now)
      .order("next_run_at", { ascending: true })
      .limit(20);

    if (error) throw error;
    if (!dueReports || dueReports.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No due reports" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const report of dueReports) {
      try {
        // Get tenant info for email context
        const { data: tenant } = await supabase
          .from("tenants")
          .select("name")
          .eq("id", report.tenant_id)
          .single();

        // Generate report data based on type
        const reportData = await generateReportData(supabase, report);

        // Send to each recipient
        for (const recipient of report.recipients || []) {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              to: recipient,
              subject: `${report.report_name} — ${tenant?.name || "Numaxio"}`,
              html: buildReportEmailHtml(report, reportData, tenant?.name),
            },
          });
        }

        // Calculate next run
        const nextRun = calculateNextRun(report.frequency);

        await supabase
          .from("scheduled_reports")
          .update({
            last_run_at: now,
            next_run_at: nextRun.toISOString(),
          })
          .eq("id", report.id);

        results.push({ id: report.id, status: "sent" });
      } catch (err: any) {
        console.error(`Failed to process report ${report.id}:`, err);
        results.push({ id: report.id, status: "failed", error: err.message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Report data generation ──
async function generateReportData(
  supabase: ReturnType<typeof createClient>,
  report: any
): Promise<any> {
  const tenantId = report.tenant_id;
  const now = new Date();
  const dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const dateTo = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  switch (report.report_type) {
    case "profit_loss": {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("grand_total, vat_total, base_amount")
        .eq("tenant_id", tenantId)
        .gte("invoice_date", dateFrom)
        .lte("invoice_date", dateTo)
        .is("deleted_at", null);

      const { data: expenses } = await supabase
        .from("expenses")
        .select("total_amount, vat_amount")
        .eq("tenant_id", tenantId)
        .gte("expense_date", dateFrom)
        .lte("expense_date", dateTo)
        .is("deleted_at", null);

      const totalRevenue = (invoices || []).reduce((s: number, i: any) => s + (Number(i.grand_total) || 0), 0);
      const totalExpenses = (expenses || []).reduce((s: number, e: any) => s + (Number(e.total_amount) || 0), 0);

      return {
        period: `${dateFrom} → ${dateTo}`,
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: totalRevenue - totalExpenses,
        invoiceCount: invoices?.length || 0,
        expenseCount: expenses?.length || 0,
      };
    }

    case "sales_summary": {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("grand_total, status")
        .eq("tenant_id", tenantId)
        .gte("invoice_date", dateFrom)
        .lte("invoice_date", dateTo)
        .is("deleted_at", null);

      const total = (invoices || []).reduce((s: number, i: any) => s + (Number(i.grand_total) || 0), 0);
      const paid = (invoices || []).filter((i: any) => i.status === "paid");
      const paidTotal = paid.reduce((s: number, i: any) => s + (Number(i.grand_total) || 0), 0);

      return {
        period: `${dateFrom} → ${dateTo}`,
        totalSales: total,
        paidSales: paidTotal,
        unpaidSales: total - paidTotal,
        invoiceCount: invoices?.length || 0,
      };
    }

    default: {
      const { count } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("invoice_date", dateFrom)
        .lte("invoice_date", dateTo);

      return { period: `${dateFrom} → ${dateTo}`, records: count || 0 };
    }
  }
}

// ── Email HTML builder ──
function buildReportEmailHtml(report: any, data: any, tenantName?: string): string {
  const rows = Object.entries(data)
    .map(([key, val]) => {
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const value = typeof val === "number"
        ? Number(val).toLocaleString("ar-SA", { minimumFractionDigits: 2 })
        : String(val);
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#374151">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#111827" dir="ltr">${value}</td></tr>`;
    })
    .join("");

  return `
    <div dir="rtl" style="font-family:'IBM Plex Sans Arabic',Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1a1f36;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="margin:0;font-size:20px">${report.report_name}</h1>
        <p style="margin:8px 0 0;opacity:0.8;font-size:14px">${tenantName || "Numaxio"}</p>
      </div>
      <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${rows}
        </table>
        <p style="margin-top:20px;font-size:12px;color:#9ca3af;text-align:center">
          تم إنشاء هذا التقرير تلقائياً — التكرار: ${report.frequency === "daily" ? "يومي" : report.frequency === "weekly" ? "أسبوعي" : "شهري"}
        </p>
      </div>
    </div>
  `;
}

// ── Next run calculator ──
function calculateNextRun(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "monthly":
    default: {
      const next = new Date(now);
      next.setMonth(next.getMonth() + 1);
      return next;
    }
  }
}
