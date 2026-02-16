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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active reminder schedules across all tenants
    const { data: schedules, error: schedErr } = await supabase
      .from("payment_reminder_schedules")
      .select("*")
      .eq("is_active", true);

    if (schedErr) throw schedErr;
    if (!schedules?.length) {
      return new Response(JSON.stringify({ message: "No active schedules", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    let totalFailed = 0;

    for (const schedule of schedules) {
      // Calculate target date: today + days_offset from due_date perspective
      // If days_offset = -3, we want invoices due in 3 days (due_date = today + 3)
      // If days_offset = 7, we want invoices that were due 7 days ago (due_date = today - 7)
      const today = new Date();
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - schedule.days_offset);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      // Find invoices matching this schedule's criteria
      const { data: invoices, error: invErr } = await supabase
        .from("invoices")
        .select(`
          id, invoice_number, grand_total, amount_due, due_date, currency,
          customer_id, tenant_id,
          customers!inner(name, email)
        `)
        .eq("tenant_id", schedule.tenant_id)
        .eq("due_date", targetDateStr)
        .in("status", ["issued", "sent", "partial", "overdue"])
        .gt("amount_due", 0);

      if (invErr || !invoices?.length) continue;

      for (const invoice of invoices) {
        const customer = invoice.customers as any;
        if (!customer?.email) continue;

        // Check if we already sent this reminder for this invoice+schedule combo
        const { data: existing } = await supabase
          .from("payment_reminder_logs")
          .select("id")
          .eq("invoice_id", invoice.id)
          .eq("schedule_id", schedule.id)
          .limit(1);

        if (existing?.length) continue;

        // Render template
        const subject = renderTemplate(schedule.subject_template, invoice, customer);
        const body = renderTemplate(schedule.body_template, invoice, customer);

        // Send email via Resend
        let status = "sent";
        let errorMessage: string | null = null;

        try {
          const isOverdue = schedule.days_offset > 0;
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Numaxio <onboarding@resend.dev>",
              to: [customer.email],
              subject,
              html: buildEmailHtml(body, invoice, customer, isOverdue),
            }),
          });

          if (!res.ok) {
            const errData = await res.json();
            status = "failed";
            errorMessage = JSON.stringify(errData);
          }
        } catch (e) {
          status = "failed";
          errorMessage = e instanceof Error ? e.message : "Send failed";
        }

        // Log the reminder
        await supabase.from("payment_reminder_logs").insert({
          tenant_id: schedule.tenant_id,
          invoice_id: invoice.id,
          schedule_id: schedule.id,
          customer_id: invoice.customer_id,
          channel: schedule.channel,
          recipient: customer.email,
          subject,
          body,
          status,
          error_message: errorMessage,
        });

        if (status === "sent") totalSent++;
        else totalFailed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, failed: totalFailed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Payment reminder error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function renderTemplate(template: string, invoice: any, customer: any): string {
  return template
    .replace(/\{\{customer_name\}\}/g, customer.name || "")
    .replace(/\{\{invoice_number\}\}/g, invoice.invoice_number || "")
    .replace(/\{\{amount_due\}\}/g, String(invoice.amount_due || invoice.grand_total || 0))
    .replace(/\{\{grand_total\}\}/g, String(invoice.grand_total || 0))
    .replace(/\{\{currency\}\}/g, invoice.currency || "SAR")
    .replace(/\{\{due_date\}\}/g, invoice.due_date || "");
}

function buildEmailHtml(body: string, invoice: any, customer: any, isOverdue: boolean): string {
  const accentColor = isOverdue ? "#dc2626" : "#1a9b8a";
  const headerText = isOverdue ? "تذكير بالسداد المتأخر" : "تذكير بموعد السداد";
  const headerTextEn = isOverdue ? "Overdue Payment Reminder" : "Payment Reminder";

  return `
    <div dir="rtl" style="font-family: 'IBM Plex Sans Arabic', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: ${accentColor}; color: #fff; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">${headerText}</h1>
        <p style="margin: 8px 0 0; opacity: 0.7; font-size: 14px;">${headerTextEn}</p>
      </div>
      <div style="background: #f8f9fa; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 15px; line-height: 1.8; color: #1a1a2e;">${body}</p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 16px;">
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 6px 0; color: #6b7280;">رقم الفاتورة:</td><td style="text-align: left; font-weight: 600;">${invoice.invoice_number}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">المبلغ المستحق:</td><td style="text-align: left; font-weight: 600; color: ${accentColor};">${invoice.amount_due || invoice.grand_total} ${invoice.currency || "SAR"}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">تاريخ الاستحقاق:</td><td style="text-align: left; font-weight: 600;">${invoice.due_date}</td></tr>
          </table>
        </div>
      </div>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 0 0 12px 12px; text-align: center; font-size: 11px; color: #9ca3af; border: 1px solid #e5e7eb; border-top: none;">
        Powered by Numaxio
      </div>
    </div>
  `;
}
