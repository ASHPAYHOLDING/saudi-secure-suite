import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

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
    // Rate limiting
    const rlAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const blocked = await checkRateLimit(req, rlAdmin, "invoice_send", corsHeaders);
    if (blocked) return blocked;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { invoiceId, channel, recipient, subject, body, tenantId } = await req.json();

    if (!invoiceId || !channel || !recipient || !tenantId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let status = "sent";
    let metadata: Record<string, unknown> = {};

    if (channel === "email") {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) {
        return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get invoice details for the email
      const { data: invoice } = await supabase
        .from("invoices")
        .select("invoice_number, grand_total, due_date, currency")
        .eq("id", invoiceId)
        .single();

      const emailBody = body || `فاتورة رقم ${invoice?.invoice_number} بمبلغ ${invoice?.grand_total} ${invoice?.currency || "ر.س"}`;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Numaxio <noreply@numaxio.com>",
          to: [recipient],
          subject: subject || `فاتورة ضريبية - ${invoice?.invoice_number || ""}`,
          html: `
            <div dir="rtl" style="font-family: 'IBM Plex Sans Arabic', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="background: #1a1f36; color: #fff; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 20px;">فاتورة ضريبية</h1>
                <p style="margin: 8px 0 0; opacity: 0.7; font-size: 14px;">Tax Invoice</p>
              </div>
              <div style="background: #f8f9fa; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
                <p style="font-size: 15px; line-height: 1.8; color: #1a1a2e;">${emailBody}</p>
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 16px;">
                  <table style="width: 100%; font-size: 14px; color: #374151;">
                    <tr><td style="padding: 6px 0; color: #6b7280;">رقم الفاتورة:</td><td style="text-align: left; font-weight: 600;">${invoice?.invoice_number || ""}</td></tr>
                    <tr><td style="padding: 6px 0; color: #6b7280;">المبلغ الإجمالي:</td><td style="text-align: left; font-weight: 600;">${invoice?.grand_total || 0} ${invoice?.currency || "ر.س"}</td></tr>
                    <tr><td style="padding: 6px 0; color: #6b7280;">تاريخ الاستحقاق:</td><td style="text-align: left; font-weight: 600;">${invoice?.due_date || ""}</td></tr>
                  </table>
                </div>
              </div>
              <div style="background: #f3f4f6; padding: 16px; border-radius: 0 0 12px 12px; text-align: center; font-size: 11px; color: #9ca3af; border: 1px solid #e5e7eb; border-top: none;">
                Powered by Numaxio
              </div>
            </div>
          `,
        }),
      });

      const resendData = await resendRes.json();
      if (!resendRes.ok) {
        status = "failed";
        metadata = { error: resendData };
      } else {
        metadata = { resend_id: resendData.id };
      }
    }

    // Log the delivery
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await serviceClient.from("invoice_delivery_log").insert({
      tenant_id: tenantId,
      invoice_id: invoiceId,
      channel,
      recipient,
      status,
      message_body: body || "",
      sent_by: userId,
      metadata,
    });

    return new Response(
      JSON.stringify({ success: status === "sent", status, metadata }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error sending invoice:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
