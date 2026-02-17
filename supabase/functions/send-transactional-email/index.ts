import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Allowed Senders ───
const SENDERS: Record<string, string> = {
  "no-reply": "Numaxio <no-reply@numaxio.com>",
  billing: "Numaxio Billing <billing@numaxio.com>",
  security: "Numaxio Security <security@numaxio.com>",
};

// ─── Email Type → Sender Mapping ───
const TYPE_SENDER: Record<string, string> = {
  account_activation: "no-reply",
  security_alert: "security",
  invoice: "billing",
  payment_receipt: "billing",
  service_purchase: "billing",
  integration_activation: "no-reply",
  financial_notification: "billing",
  admin_alert: "no-reply",
};

// ─── Email Templates ───
function getEmailTemplate(
  emailType: string,
  data: Record<string, unknown>
): { subject: string; html: string } {
  const wrap = (title: string, body: string) => `
    <div dir="rtl" style="font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8fafc;">
      <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #1a1f36, #2d3561); color: #fff; padding: 28px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 700;">${title}</h1>
        </div>
        <div style="padding: 32px 28px;">${body}</div>
      </div>
      <p style="color: #a0aec0; font-size: 11px; text-align: center; margin-top: 20px;">
        © ${new Date().getFullYear()} Numaxio – نظام إدارة الأعمال
      </p>
    </div>`;

  switch (emailType) {
    case "account_activation":
      return {
        subject: "تفعيل حسابك – Numaxio",
        html: wrap(
          "تفعيل الحساب",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">مرحباً <strong>${data.user_name || ""}</strong>،</p>
           <p style="color:#4a5568;font-size:15px;line-height:1.9;">تم إنشاء حسابك بنجاح. يمكنك الآن تسجيل الدخول والبدء في استخدام المنصة.</p>`
        ),
      };

    case "security_alert":
      return {
        subject: "⚠️ تنبيه أمني – Numaxio",
        html: wrap(
          "تنبيه أمني",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">تم تسجيل دخول ${data.alert_type === "new_login" ? "جديد" : ""} إلى حسابك.</p>
           <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:16px 0;">
             <p style="margin:0;color:#92400e;font-size:14px;">📍 ${data.ip_address || "غير معروف"} • ${data.device || "غير معروف"}</p>
             <p style="margin:4px 0 0;color:#92400e;font-size:13px;">${data.timestamp || ""}</p>
           </div>
           <p style="color:#6b7280;font-size:14px;">إذا لم تكن أنت، قم بتغيير كلمة المرور فوراً.</p>`
        ),
      };

    case "invoice":
      return {
        subject: `فاتورة ضريبية ${data.invoice_number || ""} – Numaxio`,
        html: wrap(
          "فاتورة ضريبية",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">عزيزي العميل،</p>
           <p style="color:#4a5568;font-size:15px;line-height:1.9;">تم إصدار فاتورة ضريبية جديدة لحسابك.</p>
           <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
             <table style="width:100%;font-size:14px;color:#374151;">
               <tr><td style="padding:6px 0;color:#6b7280;">رقم الفاتورة:</td><td style="text-align:left;font-weight:600;">${data.invoice_number || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">المبلغ:</td><td style="text-align:left;font-weight:600;">${data.amount || 0} ${data.currency || "ر.س"}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">تاريخ الاستحقاق:</td><td style="text-align:left;font-weight:600;">${data.due_date || ""}</td></tr>
             </table>
           </div>`
        ),
      };

    case "payment_receipt":
      return {
        subject: `إيصال دفع – ${data.amount || ""} ${data.currency || "ر.س"}`,
        html: wrap(
          "إيصال دفع",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">تم استلام دفعتك بنجاح.</p>
           <div style="background:#ecfdf5;border:1px solid #10b981;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
             <p style="margin:0;font-size:28px;font-weight:700;color:#065f46;">${data.amount || 0} ${data.currency || "ر.س"}</p>
             <p style="margin:4px 0 0;color:#047857;font-size:13px;">✓ تمت بنجاح</p>
           </div>
           <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
             <table style="width:100%;font-size:14px;color:#374151;">
               <tr><td style="padding:6px 0;color:#6b7280;">المرجع:</td><td style="text-align:left;font-weight:600;">${data.reference || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">طريقة الدفع:</td><td style="text-align:left;font-weight:600;">${data.payment_method || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">التاريخ:</td><td style="text-align:left;font-weight:600;">${data.payment_date || ""}</td></tr>
             </table>
           </div>`
        ),
      };

    case "service_purchase":
      return {
        subject: `تأكيد شراء – ${data.service_name || ""} – Numaxio`,
        html: wrap(
          "تأكيد شراء خدمة",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">تمت عملية شراء الخدمة بنجاح.</p>
           <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
             <table style="width:100%;font-size:14px;color:#374151;">
               <tr><td style="padding:6px 0;color:#6b7280;">الخدمة:</td><td style="text-align:left;font-weight:600;">${data.service_name || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">المبلغ:</td><td style="text-align:left;font-weight:600;">${data.amount || 0} ${data.currency || "ر.س"}</td></tr>
             </table>
           </div>`
        ),
      };

    case "integration_activation":
      return {
        subject: `تفعيل تكامل – ${data.integration_name || ""} – Numaxio`,
        html: wrap(
          "تفعيل تكامل",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">تم تفعيل تكامل <strong>${data.integration_name || ""}</strong> بنجاح على حسابك.</p>
           <p style="color:#6b7280;font-size:14px;">يمكنك الآن استخدام جميع ميزات هذا التكامل من لوحة التحكم.</p>`
        ),
      };

    case "financial_notification":
      return {
        subject: `إشعار مالي – ${data.title || ""} – Numaxio`,
        html: wrap(
          data.title as string || "إشعار مالي",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">${data.message || ""}</p>
           ${data.details ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;color:#374151;">${data.details}</div>` : ""}`
        ),
      };

    case "admin_alert":
      return {
        subject: `تنبيه إداري – ${data.title || ""} – Numaxio`,
        html: wrap(
          data.title as string || "تنبيه إداري",
          `<div style="background:#fef2f2;border:1px solid #ef4444;border-radius:8px;padding:16px;margin:16px 0;">
             <p style="margin:0;color:#991b1b;font-size:15px;font-weight:600;">${data.title || ""}</p>
             <p style="margin:8px 0 0;color:#7f1d1d;font-size:14px;">${data.message || ""}</p>
           </div>`
        ),
      };

    default:
      return {
        subject: data.subject as string || "إشعار من Numaxio",
        html: wrap(
          "إشعار",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">${data.message || data.body || ""}</p>`
        ),
      };
  }
}

// ─── Send via Resend ───
async function sendViaResend(
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; providerId?: string; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: JSON.stringify(data) };
    }
    return { success: true, providerId: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── Main Handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const {
      action,
      email_type,
      recipient_email,
      tenant_id,
      user_id,
      entity_type,
      entity_id,
      data: templateData,
      log_id, // For retry
    } = await req.json();

    // ─── Retry Logic ───
    if (action === "retry") {
      if (!log_id) {
        return new Response(JSON.stringify({ error: "log_id required for retry" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: logEntry, error: logErr } = await serviceClient
        .from("email_logs")
        .select("*")
        .eq("id", log_id)
        .single();

      if (logErr || !logEntry) {
        return new Response(JSON.stringify({ error: "Log entry not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (logEntry.status === "sent") {
        return new Response(JSON.stringify({ error: "Already sent" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (logEntry.retry_count >= logEntry.max_retries) {
        return new Response(JSON.stringify({ error: "Max retries exceeded" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Re-generate template
      const meta = logEntry.metadata || {};
      const tpl = getEmailTemplate(logEntry.email_type, meta as Record<string, unknown>);
      const senderKey = TYPE_SENDER[logEntry.email_type] || "no-reply";
      const fromAddr = SENDERS[senderKey];

      const result = await sendViaResend(fromAddr, logEntry.recipient_email, tpl.subject, tpl.html);

      await serviceClient
        .from("email_logs")
        .update({
          status: result.success ? "sent" : "failed",
          provider_id: result.providerId || logEntry.provider_id,
          provider_response: result.success ? { id: result.providerId } : { error: result.error },
          retry_count: logEntry.retry_count + 1,
          last_retry_at: new Date().toISOString(),
          failure_reason: result.success ? null : result.error,
          sent_at: result.success ? new Date().toISOString() : null,
        })
        .eq("id", log_id);

      return new Response(
        JSON.stringify({ success: result.success, log_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── New Email Send ───
    if (!email_type || !recipient_email) {
      return new Response(JSON.stringify({ error: "email_type and recipient_email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const senderKey = TYPE_SENDER[email_type] || "no-reply";
    const fromAddress = SENDERS[senderKey];
    const senderEmail = fromAddress.match(/<(.+)>/)?.[1] || "no-reply@numaxio.com";

    const tpl = getEmailTemplate(email_type, templateData || {});

    // Insert log entry first (pending)
    const { data: logRow, error: insertErr } = await serviceClient
      .from("email_logs")
      .insert({
        tenant_id: tenant_id || null,
        user_id: user_id || null,
        email_type,
        sender_address: senderEmail,
        recipient_email,
        subject: tpl.subject,
        status: "pending",
        metadata: templateData || {},
        entity_type: entity_type || null,
        entity_id: entity_id || null,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Failed to create email log:", insertErr);
    }

    const result = await sendViaResend(fromAddress, recipient_email, tpl.subject, tpl.html);

    // Update log
    if (logRow) {
      await serviceClient
        .from("email_logs")
        .update({
          status: result.success ? "sent" : "failed",
          provider_id: result.providerId || null,
          provider_response: result.success ? { id: result.providerId } : { error: result.error },
          failure_reason: result.success ? null : result.error,
          sent_at: result.success ? new Date().toISOString() : null,
        })
        .eq("id", logRow.id);
    }

    // Auto-retry on failure
    if (!result.success && logRow) {
      await serviceClient
        .from("email_logs")
        .update({ status: "retrying", retry_count: 1, last_retry_at: new Date().toISOString() })
        .eq("id", logRow.id);

      // Attempt retry once immediately
      const retry = await sendViaResend(fromAddress, recipient_email, tpl.subject, tpl.html);
      await serviceClient
        .from("email_logs")
        .update({
          status: retry.success ? "sent" : "failed",
          provider_id: retry.providerId || null,
          provider_response: retry.success ? { id: retry.providerId } : { error: retry.error },
          failure_reason: retry.success ? null : retry.error,
          sent_at: retry.success ? new Date().toISOString() : null,
          retry_count: 1,
        })
        .eq("id", logRow.id);
    }

    return new Response(
      JSON.stringify({
        success: result.success,
        log_id: logRow?.id,
        provider_id: result.providerId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-transactional-email:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
