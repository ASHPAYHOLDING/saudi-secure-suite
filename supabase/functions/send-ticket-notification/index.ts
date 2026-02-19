import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_SUPPORT_EMAIL") || "support@numaxio.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const rlAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const blocked = await checkRateLimit(req, rlAdmin, "email", corsHeaders);
    if (blocked) return blocked;
    const body = await req.json();
    const { type, ticketNumber, subject, content, senderName, senderEmail, recipientEmail, recipientName, newStatus } = body;

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured, skipping email");
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailTo = "";
    let emailSubject = "";
    let emailHtml = "";

    const statusLabels: Record<string, string> = {
      open: "مفتوحة",
      in_progress: "قيد المعالجة",
      waiting_customer: "بانتظار ردك",
      resolved: "تم الحل",
      closed: "مغلقة",
    };

    if (type === "new_ticket") {
      // Notify admin about new ticket
      emailTo = ADMIN_EMAIL;
      emailSubject = `🎫 تذكرة دعم جديدة: ${ticketNumber} - ${subject}`;
      emailHtml = `
        <div dir="rtl" style="font-family: 'IBM Plex Sans Arabic', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; padding: 24px; color: white; margin-bottom: 20px;">
            <h2 style="margin: 0 0 8px;">🎫 تذكرة دعم جديدة</h2>
            <p style="margin: 0; opacity: 0.8; font-size: 14px;">رقم التذكرة: ${ticketNumber}</p>
          </div>
          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; font-weight: bold; color: #475569;">الموضوع:</td><td style="padding: 8px 0;">${subject}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold; color: #475569;">المرسل:</td><td style="padding: 8px 0;">${senderName} (${senderEmail})</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold; color: #475569;">التصنيف:</td><td style="padding: 8px 0;">${body.category || "—"}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold; color: #475569;">الأولوية:</td><td style="padding: 8px 0;">${body.priority || "متوسطة"}</td></tr>
            </table>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
            <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.7; color: #334155;">${content}</div>
          </div>
          <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">نيوماكسيو — نظام الدعم الفني</p>
        </div>
      `;
    } else if (type === "admin_reply") {
      // Notify customer about admin reply
      emailTo = recipientEmail || "";
      emailSubject = `💬 رد على تذكرتك ${ticketNumber}: ${subject}`;
      emailHtml = `
        <div dir="rtl" style="font-family: 'IBM Plex Sans Arabic', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 12px; padding: 24px; color: white; margin-bottom: 20px;">
            <h2 style="margin: 0 0 8px;">💬 رد جديد على تذكرتك</h2>
            <p style="margin: 0; opacity: 0.8; font-size: 14px;">${ticketNumber} — ${subject}</p>
          </div>
          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
            <p style="font-size: 13px; color: #64748b; margin: 0 0 8px;">من: فريق الدعم الفني</p>
            <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.7; color: #334155;">${content}</div>
            ${newStatus ? `<div style="margin-top: 16px; padding: 12px; background: #ecfdf5; border-radius: 8px; font-size: 13px; color: #065f46;">📌 حالة التذكرة: <strong>${statusLabels[newStatus] || newStatus}</strong></div>` : ""}
          </div>
          <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">يمكنك الرد من خلال لوحة التحكم — نيوماكسيو</p>
        </div>
      `;
    } else if (type === "reply") {
      // Notify admin about customer reply
      emailTo = ADMIN_EMAIL;
      emailSubject = `↩️ رد من عميل على التذكرة ${ticketNumber}`;
      emailHtml = `
        <div dir="rtl" style="font-family: 'IBM Plex Sans Arabic', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); border-radius: 12px; padding: 24px; color: white; margin-bottom: 20px;">
            <h2 style="margin: 0 0 8px;">↩️ رد جديد من العميل</h2>
            <p style="margin: 0; opacity: 0.8; font-size: 14px;">${ticketNumber} — ${subject}</p>
          </div>
          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
            <p style="font-size: 13px; color: #64748b; margin: 0 0 8px;">من: ${senderName} (${senderEmail})</p>
            <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.7; color: #334155;">${content}</div>
          </div>
          <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">نيوماكسيو — نظام الدعم الفني</p>
        </div>
      `;
    }

    if (!emailTo) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_recipient" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "نيوماكسيو - الدعم الفني <support@numaxio.com>",
        to: [emailTo],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    const result = await res.json();
    console.log("Email sent:", result);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
