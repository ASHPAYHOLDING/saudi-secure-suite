import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Allowed Senders (no personal emails) ───
const SENDERS: Record<string, string> = {
  "no-reply": "Numaxio <no-reply@numaxio.com>",
  billing: "Numaxio Billing <billing@numaxio.com>",
  security: "Numaxio Security <security@numaxio.com>",
};

// ─── Email Type → Sender Mapping ───
const TYPE_SENDER: Record<string, string> = {
  // General transactional
  account_activation: "no-reply",
  security_alert: "security",
  invoice: "billing",
  payment_receipt: "billing",
  service_purchase: "billing",
  integration_activation: "no-reply",
  financial_notification: "billing",
  admin_alert: "no-reply",
  // Affiliate
  affiliate_application_received: "no-reply",
  affiliate_application_approved: "no-reply",
  affiliate_application_rejected: "no-reply",
  // Financial (formal)
  financial_invoice: "billing",
  financial_payment_receipt: "billing",
  financial_payment_failed: "billing",
  financial_refund: "billing",
  financial_wallet_notification: "billing",
};

// ─── Formal Financial Email Wrapper (RTL, no marketing, no images) ───
function formalWrap(title: string, body: string, companyName?: string, vatNumber?: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; padding: 0; background: #f4f5f7; font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
  .container { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
  .card { background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
  .header { background: #0f172a; color: #ffffff; padding: 20px 24px; }
  .header h1 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
  .header .subtitle { margin: 4px 0 0; font-size: 12px; color: #94a3b8; font-weight: 400; }
  .body { padding: 24px; }
  .body p { margin: 0 0 12px; font-size: 14px; line-height: 1.8; color: #334155; }
  .data-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  .data-table td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
  .data-table td:first-child { color: #64748b; font-weight: 400; width: 40%; }
  .data-table td:last-child { color: #0f172a; font-weight: 600; text-align: left; }
  .amount-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0; }
  .amount-box .amount { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0; }
  .amount-box .label { font-size: 12px; color: #64748b; margin: 4px 0 0; }
  .success-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0; }
  .success-box .amount { font-size: 24px; font-weight: 700; color: #166534; margin: 0; }
  .success-box .label { font-size: 12px; color: #15803d; margin: 4px 0 0; }
  .warning-box { background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0; }
  .warning-box .amount { font-size: 20px; font-weight: 700; color: #92400e; margin: 0; }
  .warning-box .label { font-size: 12px; color: #a16207; margin: 4px 0 0; }
  .error-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0; }
  .error-box .amount { font-size: 18px; font-weight: 700; color: #991b1b; margin: 0; }
  .error-box .label { font-size: 12px; color: #b91c1c; margin: 4px 0 0; }
  .btn { display: inline-block; background: #0f172a; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600; margin: 8px 0; }
  .divider { border: none; border-top: 1px solid #f1f5f9; margin: 20px 0; }
  .legal { font-size: 11px; color: #94a3b8; line-height: 1.6; margin: 0; }
  .footer { padding: 16px 24px; text-align: center; }
  .footer p { margin: 0; font-size: 11px; color: #94a3b8; }
  .footer .company { font-weight: 600; color: #64748b; }
  .num { font-family: 'Inter', 'SF Mono', monospace; direction: ltr; unicode-bidi: embed; }
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <div class="header">
      <h1>${title}</h1>
      ${companyName ? `<p class="subtitle">${companyName}${vatNumber ? ` | الرقم الضريبي: <span class="num">${vatNumber}</span>` : ''}</p>` : ''}
    </div>
    <div class="body">${body}</div>
  </div>
  <div class="footer">
    <p>هذه رسالة تشغيلية آلية – لا تتطلب رداً</p>
    <p class="company">© ${new Date().getFullYear()} Numaxio – نظام إدارة الأعمال</p>
  </div>
</div>
</body>
</html>`;
}

// ─── General Template Wrapper (existing) ───
function generalWrap(title: string, body: string): string {
  return `<div dir="rtl" style="font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8fafc;">
    <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #1a1f36, #2d3561); color: #fff; padding: 28px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 700;">${title}</h1>
      </div>
      <div style="padding: 32px 28px;">${body}</div>
    </div>
    <p style="color: #a0aec0; font-size: 11px; text-align: center; margin-top: 20px;">© ${new Date().getFullYear()} Numaxio – نظام إدارة الأعمال</p>
  </div>`;
}

// ─── Email Templates ───
function getEmailTemplate(
  emailType: string,
  data: Record<string, unknown>
): { subject: string; html: string } {
  const d = data;

  switch (emailType) {
    // ═══════════════════════════════════════
    // FORMAL FINANCIAL EMAILS
    // ═══════════════════════════════════════

    case "financial_invoice":
      return {
        subject: `فاتورة ضريبية رقم ${d.invoice_number || ""} – ${d.company_name || ""}`,
        html: formalWrap(
          "فاتورة ضريبية",
          `<p>السيد/ة <strong>${d.customer_name || "العميل"}</strong> المحترم/ة،</p>
          <p>نفيدكم بأنه تم إصدار فاتورة ضريبية على حسابكم وفقاً للبيانات التالية:</p>
          <table class="data-table">
            <tr><td>رقم الفاتورة</td><td class="num">${d.invoice_number || ""}</td></tr>
            <tr><td>تاريخ الإصدار</td><td class="num">${d.invoice_date || ""}</td></tr>
            <tr><td>تاريخ الاستحقاق</td><td class="num">${d.due_date || ""}</td></tr>
            <tr><td>المبلغ قبل الضريبة</td><td class="num">${d.subtotal || 0} ${d.currency || "ر.س"}</td></tr>
            <tr><td>ضريبة القيمة المضافة</td><td class="num">${d.vat_total || 0} ${d.currency || "ر.س"}</td></tr>
          </table>
          <div class="amount-box">
            <p class="amount num">${d.grand_total || 0} ${d.currency || "ر.س"}</p>
            <p class="label">إجمالي المبلغ المستحق</p>
          </div>
          ${d.access_token ? `<p style="text-align:center;"><a class="btn" href="${SUPABASE_URL}/functions/v1/document-viewer?token=${d.access_token}">عرض الفاتورة (PDF)</a></p>
          <p class="legal">الرابط صالح لمدة 48 ساعة ولعدد محدود من الزيارات</p>` : ''}
          <hr class="divider">
          <p class="legal">هذه الفاتورة صادرة وفقاً لنظام ضريبة القيمة المضافة في المملكة العربية السعودية. ${d.cr_number ? `سجل تجاري: <span class="num">${d.cr_number}</span>` : ''}</p>`,
          d.company_name as string,
          d.vat_number as string
        ),
      };

    case "financial_payment_receipt":
      return {
        subject: `إيصال دفع – ${d.amount || ""} ${d.currency || "ر.س"} – ${d.company_name || ""}`,
        html: formalWrap(
          "إيصال استلام دفعة",
          `<p>السيد/ة <strong>${d.customer_name || "العميل"}</strong> المحترم/ة،</p>
          <p>نؤكد لكم استلام الدفعة المالية التالية بنجاح:</p>
          <div class="success-box">
            <p class="amount num">${d.amount || 0} ${d.currency || "ر.س"}</p>
            <p class="label">✓ تم الاستلام بنجاح</p>
          </div>
          <table class="data-table">
            <tr><td>رقم الفاتورة المرتبطة</td><td class="num">${d.invoice_number || ""}</td></tr>
            <tr><td>تاريخ الدفع</td><td class="num">${d.payment_date || ""}</td></tr>
            <tr><td>طريقة الدفع</td><td>${d.payment_method || ""}</td></tr>
            ${d.reference_number ? `<tr><td>رقم المرجع</td><td class="num">${d.reference_number}</td></tr>` : ''}
            <tr><td>الرصيد المتبقي</td><td class="num">${d.remaining_balance ?? 0} ${d.currency || "ر.س"}</td></tr>
          </table>
          <hr class="divider">
          <p class="legal">هذا الإيصال صادر آلياً ولا يتطلب توقيعاً. يُرجى الاحتفاظ به كمرجع.</p>`,
          d.company_name as string,
          d.vat_number as string
        ),
      };

    case "financial_payment_failed":
      return {
        subject: `⚠ فشل عملية دفع – ${d.company_name || ""}`,
        html: formalWrap(
          "إشعار فشل عملية دفع",
          `<p>السيد/ة <strong>${d.customer_name || "العميل"}</strong> المحترم/ة،</p>
          <p>نأسف لإبلاغكم بفشل عملية الدفع التالية:</p>
          <div class="error-box">
            <p class="amount num">${d.amount || 0} ${d.currency || "ر.س"}</p>
            <p class="label">✗ فشلت العملية</p>
          </div>
          <table class="data-table">
            <tr><td>رقم الفاتورة</td><td class="num">${d.invoice_number || ""}</td></tr>
            <tr><td>تاريخ المحاولة</td><td class="num">${d.attempt_date || ""}</td></tr>
            <tr><td>سبب الفشل</td><td>${d.failure_reason || "خطأ في معالجة الدفع"}</td></tr>
          </table>
          <p>يُرجى التحقق من بيانات الدفع والمحاولة مرة أخرى، أو التواصل مع البنك.</p>
          <hr class="divider">
          <p class="legal">في حال استمرار المشكلة، يُرجى التواصل مع فريق الدعم الفني.</p>`,
          d.company_name as string,
          d.vat_number as string
        ),
      };

    case "financial_refund":
      return {
        subject: `إشعار استرداد رقم ${d.credit_note_number || ""} – ${d.company_name || ""}`,
        html: formalWrap(
          "إشعار دائن / استرداد",
          `<p>السيد/ة <strong>${d.customer_name || "العميل"}</strong> المحترم/ة،</p>
          <p>نفيدكم بصدور إشعار دائن (استرداد) على حسابكم:</p>
          <table class="data-table">
            <tr><td>رقم الإشعار الدائن</td><td class="num">${d.credit_note_number || ""}</td></tr>
            <tr><td>تاريخ الإصدار</td><td class="num">${d.credit_date || ""}</td></tr>
            <tr><td>سبب الاسترداد</td><td>${d.reason || ""}</td></tr>
            <tr><td>المبلغ قبل الضريبة</td><td class="num">${d.subtotal || 0} ${d.currency || "ر.س"}</td></tr>
            <tr><td>ضريبة القيمة المضافة</td><td class="num">${d.vat_total || 0} ${d.currency || "ر.س"}</td></tr>
          </table>
          <div class="success-box">
            <p class="amount num">${d.grand_total || 0} ${d.currency || "ر.س"}</p>
            <p class="label">إجمالي مبلغ الاسترداد</p>
          </div>
          ${d.access_token ? `<p style="text-align:center;"><a class="btn" href="${SUPABASE_URL}/functions/v1/document-viewer?token=${d.access_token}">عرض الإشعار (PDF)</a></p>
          <p class="legal">الرابط صالح لمدة 48 ساعة ولعدد محدود من الزيارات</p>` : ''}
          <hr class="divider">
          <p class="legal">هذا الإشعار صادر وفقاً لنظام ضريبة القيمة المضافة في المملكة العربية السعودية.</p>`,
          d.company_name as string,
          d.vat_number as string
        ),
      };

    case "financial_wallet_notification": {
      const isDeposit = d.transaction_type === 'deposit';
      const typeLabel = isDeposit ? 'إيداع' : d.transaction_type === 'withdrawal' ? 'سحب' : 'عملية';
      const reasonMap: Record<string, string> = {
        subscription: 'اشتراك', integration: 'تكامل', refund: 'استرداد',
        manual: 'يدوي', topup: 'شحن رصيد', payout: 'تحويل',
      };
      return {
        subject: `إشعار ${typeLabel} في المحفظة – ${d.company_name || ""}`,
        html: formalWrap(
          `إشعار ${typeLabel} في المحفظة`,
          `<p>تم تنفيذ عملية ${typeLabel} في محفظة المنشأة:</p>
          <div class="${isDeposit ? 'success-box' : 'warning-box'}">
            <p class="amount num">${isDeposit ? '+' : '-'}${d.amount || 0} ر.س</p>
            <p class="label">${typeLabel} ${isDeposit ? 'ناجح' : 'تم'}</p>
          </div>
          <table class="data-table">
            <tr><td>نوع العملية</td><td>${typeLabel}</td></tr>
            <tr><td>السبب</td><td>${reasonMap[d.reason as string] || d.reason || '—'}</td></tr>
            <tr><td>الرصيد السابق</td><td class="num">${d.balance_before ?? 0} ر.س</td></tr>
            <tr><td>الرصيد الحالي</td><td class="num">${d.balance_after ?? 0} ر.س</td></tr>
          </table>
          <hr class="divider">
          <p class="legal">هذا الإشعار صادر آلياً عند كل عملية مالية على المحفظة لأغراض الشفافية والمراجعة.</p>`,
          d.company_name as string
        ),
      };
    }

    // ═══════════════════════════════════════
    // GENERAL TRANSACTIONAL EMAILS (existing)
    // ═══════════════════════════════════════

    case "account_activation":
      return {
        subject: "تفعيل حسابك – Numaxio",
        html: generalWrap(
          "تفعيل الحساب",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">مرحباً <strong>${d.user_name || ""}</strong>،</p>
           <p style="color:#4a5568;font-size:15px;line-height:1.9;">تم إنشاء حسابك بنجاح. يمكنك الآن تسجيل الدخول والبدء في استخدام المنصة.</p>`
        ),
      };

    case "security_alert":
      return {
        subject: "⚠️ تنبيه أمني – Numaxio",
        html: generalWrap(
          "تنبيه أمني",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">تم تسجيل دخول ${d.alert_type === "new_login" ? "جديد" : ""} إلى حسابك.</p>
           <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:16px 0;">
             <p style="margin:0;color:#92400e;font-size:14px;">📍 ${d.ip_address || "غير معروف"} • ${d.device || "غير معروف"}</p>
             <p style="margin:4px 0 0;color:#92400e;font-size:13px;">${d.timestamp || ""}</p>
           </div>
           <p style="color:#6b7280;font-size:14px;">إذا لم تكن أنت، قم بتغيير كلمة المرور فوراً.</p>`
        ),
      };

    case "invoice":
      return {
        subject: `فاتورة ضريبية ${d.invoice_number || ""} – Numaxio`,
        html: generalWrap(
          "فاتورة ضريبية",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">عزيزي العميل،</p>
           <p style="color:#4a5568;font-size:15px;line-height:1.9;">تم إصدار فاتورة ضريبية جديدة لحسابك.</p>
           <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
             <table style="width:100%;font-size:14px;color:#374151;">
               <tr><td style="padding:6px 0;color:#6b7280;">رقم الفاتورة:</td><td style="text-align:left;font-weight:600;">${d.invoice_number || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">المبلغ:</td><td style="text-align:left;font-weight:600;">${d.amount || 0} ${d.currency || "ر.س"}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">تاريخ الاستحقاق:</td><td style="text-align:left;font-weight:600;">${d.due_date || ""}</td></tr>
             </table>
           </div>`
        ),
      };

    case "payment_receipt":
      return {
        subject: `إيصال دفع – ${d.amount || ""} ${d.currency || "ر.س"}`,
        html: generalWrap(
          "إيصال دفع",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">تم استلام دفعتك بنجاح.</p>
           <div style="background:#ecfdf5;border:1px solid #10b981;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
             <p style="margin:0;font-size:28px;font-weight:700;color:#065f46;">${d.amount || 0} ${d.currency || "ر.س"}</p>
             <p style="margin:4px 0 0;color:#047857;font-size:13px;">✓ تمت بنجاح</p>
           </div>`
        ),
      };

    case "service_purchase":
      return {
        subject: `تأكيد شراء – ${d.service_name || ""} – Numaxio`,
        html: generalWrap(
          "تأكيد شراء خدمة",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">تمت عملية شراء الخدمة بنجاح.</p>
           <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
             <table style="width:100%;font-size:14px;color:#374151;">
               <tr><td style="padding:6px 0;color:#6b7280;">الخدمة:</td><td style="text-align:left;font-weight:600;">${d.service_name || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">المبلغ:</td><td style="text-align:left;font-weight:600;">${d.amount || 0} ${d.currency || "ر.س"}</td></tr>
             </table>
           </div>`
        ),
      };

    case "integration_activation":
      return {
        subject: `تفعيل تكامل – ${d.integration_name || ""} – Numaxio`,
        html: generalWrap(
          "تفعيل تكامل",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">تم تفعيل تكامل <strong>${d.integration_name || ""}</strong> بنجاح على حسابك.</p>
           <p style="color:#6b7280;font-size:14px;">يمكنك الآن استخدام جميع ميزات هذا التكامل من لوحة التحكم.</p>`
        ),
      };

    case "financial_notification":
      return {
        subject: `إشعار مالي – ${d.title || ""} – Numaxio`,
        html: generalWrap(
          (d.title as string) || "إشعار مالي",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">${d.message || ""}</p>
           ${d.details ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;color:#374151;">${d.details}</div>` : ""}`
        ),
      };

    case "admin_alert":
      return {
        subject: `تنبيه إداري – ${d.title || ""} – Numaxio`,
        html: generalWrap(
          (d.title as string) || "تنبيه إداري",
          `<div style="background:#fef2f2;border:1px solid #ef4444;border-radius:8px;padding:16px;margin:16px 0;">
             <p style="margin:0;color:#991b1b;font-size:15px;font-weight:600;">${d.title || ""}</p>
             <p style="margin:8px 0 0;color:#7f1d1d;font-size:14px;">${d.message || ""}</p>
           </div>`
        ),
      };

    // ═══════════════════════════════════════
    // AFFILIATE EMAILS
    // ═══════════════════════════════════════

    case "affiliate_application_received":
      return {
        subject: "تم استلام طلب الانضمام لبرنامج الشركاء – Numaxio",
        html: generalWrap(
          "تم استلام طلبك بنجاح",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">مرحباً <strong>${d.full_name || ""}</strong>،</p>
           <p style="color:#4a5568;font-size:15px;line-height:1.9;">شكراً لاهتمامك ببرنامج شركاء نيوماكسيو! تم استلام طلبك بنجاح وهو الآن قيد المراجعة.</p>
           <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
             <p style="margin:0;font-size:18px;font-weight:700;color:#166534;">✓ تم الاستلام</p>
             <p style="margin:4px 0 0;color:#15803d;font-size:13px;">كود الشريك: <strong>${d.code || ""}</strong></p>
           </div>
           <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
             <table style="width:100%;font-size:14px;color:#374151;">
               <tr><td style="padding:6px 0;color:#6b7280;">الاسم:</td><td style="text-align:left;font-weight:600;">${d.full_name || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">البريد:</td><td style="text-align:left;font-weight:600;">${d.email || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">المستوى:</td><td style="text-align:left;font-weight:600;">${d.tier || "فضي"}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">نسبة العمولة:</td><td style="text-align:left;font-weight:600;">${d.commission_rate || 10}%</td></tr>
             </table>
           </div>
           <p style="color:#6b7280;font-size:14px;">سيتم مراجعة طلبك خلال 24-48 ساعة عمل وستصلك رسالة بالنتيجة.</p>`
        ),
      };

    case "affiliate_application_approved":
      return {
        subject: "🎉 تمت الموافقة على طلبك – برنامج شركاء Numaxio",
        html: generalWrap(
          "تهانينا! تمت الموافقة على طلبك",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">مرحباً <strong>${d.full_name || ""}</strong>،</p>
           <p style="color:#4a5568;font-size:15px;line-height:1.9;">يسعدنا إبلاغك بأنه تمت الموافقة على انضمامك لبرنامج شركاء نيوماكسيو! 🎉</p>
           <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:16px 0;text-align:center;">
             <p style="margin:0;font-size:24px;font-weight:700;color:#166534;">✓ تمت الموافقة</p>
             <p style="margin:8px 0 0;color:#15803d;font-size:14px;">حسابك نشط الآن ويمكنك البدء بالإحالة</p>
           </div>
           <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
             <table style="width:100%;font-size:14px;color:#374151;">
               <tr><td style="padding:6px 0;color:#6b7280;">كود الإحالة:</td><td style="text-align:left;font-weight:600;">${d.code || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">نسبة العمولة:</td><td style="text-align:left;font-weight:600;">${d.commission_rate || 10}%</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">المستوى:</td><td style="text-align:left;font-weight:600;">${d.tier || "فضي"}</td></tr>
             </table>
           </div>
           <p style="color:#4a5568;font-size:14px;line-height:1.8;">ابدأ الآن بمشاركة رابط الإحالة الخاص بك واكسب عمولة على كل اشتراك ناجح!</p>`
        ),
      };

    case "affiliate_application_rejected":
      return {
        subject: "تحديث حالة طلبك – برنامج شركاء Numaxio",
        html: generalWrap(
          "تحديث حالة طلبك",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">مرحباً <strong>${d.full_name || ""}</strong>،</p>
           <p style="color:#4a5568;font-size:15px;line-height:1.9;">نأسف لإبلاغك بأنه لم تتم الموافقة على طلبك للانضمام لبرنامج الشركاء في الوقت الحالي.</p>
           <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
             <p style="margin:0;font-size:16px;font-weight:600;color:#991b1b;">لم تتم الموافقة</p>
           </div>
           ${d.rejection_reason ? `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0;">
             <p style="margin:0;color:#92400e;font-size:14px;font-weight:600;">السبب:</p>
             <p style="margin:4px 0 0;color:#a16207;font-size:14px;">${d.rejection_reason}</p>
           </div>` : ''}
           <p style="color:#6b7280;font-size:14px;">يمكنك إعادة تقديم طلبك بعد استكمال المتطلبات أو التواصل مع فريق الدعم للمساعدة.</p>`
        ),
      };

    default:
      return {
        subject: (d.subject as string) || "إشعار من Numaxio",
        html: generalWrap(
          "إشعار",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">${d.message || d.body || ""}</p>`
        ),
      };
  }
}

// ─── Replace {{variables}} in template ───
function replaceVars(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    return val !== undefined && val !== null ? String(val) : `{{${key}}}`;
  });
}

// ─── Resolve template from DB (with tenant override) or fall back to hardcoded ───
async function resolveTemplate(
  serviceClient: ReturnType<typeof createClient>,
  emailType: string,
  tenantId: string | null,
  data: Record<string, unknown>
): Promise<{ subject: string; html: string; senderKey: string }> {
  try {
    const { data: rows } = await serviceClient.rpc("resolve_email_template", {
      _email_type: emailType,
      _tenant_id: tenantId,
    });

    if (rows && rows.length > 0) {
      const row = rows[0];
      const subject = replaceVars(row.subject_template, data);
      const bodyHtml = replaceVars(row.body_html, data);
      
      // Wrap in formal layout
      const companyName = data.company_name as string || "";
      const vatNumber = data.vat_number as string || "";
      const html = formalWrap(subject, bodyHtml, companyName, vatNumber);
      
      return { subject, html, senderKey: row.sender_key || "no-reply" };
    }
  } catch (err) {
    console.error("DB template resolution failed, using hardcoded:", err);
  }

  // Fallback to hardcoded templates
  const tpl = getEmailTemplate(emailType, data);
  const senderKey = TYPE_SENDER[emailType] || "no-reply";
  return { subject: tpl.subject, html: tpl.html, senderKey };
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

// ─── Process Queued Emails ───
async function processQueuedEmails(serviceClient: ReturnType<typeof createClient>) {
  const { data: queued, error } = await serviceClient
    .from("email_logs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(20);

  if (error || !queued?.length) return { processed: 0 };

  let processed = 0;
  for (const log of queued) {
    const meta = (log.metadata || {}) as Record<string, unknown>;
    const resolved = await resolveTemplate(serviceClient, log.email_type, log.tenant_id, meta);
    const fromAddress = SENDERS[resolved.senderKey] || SENDERS["no-reply"];

    const result = await sendViaResend(fromAddress, log.recipient_email, resolved.subject, resolved.html);

    await serviceClient
      .from("email_logs")
      .update({
        status: result.success ? "sent" : "failed",
        provider_id: result.providerId || null,
        provider_response: result.success ? { id: result.providerId } : { error: result.error },
        failure_reason: result.success ? null : result.error,
        sent_at: result.success ? new Date().toISOString() : null,
      })
      .eq("id", log.id);

    // Auto-retry once on failure
    if (!result.success) {
      await serviceClient
        .from("email_logs")
        .update({ status: "retrying", retry_count: 1, last_retry_at: new Date().toISOString() })
        .eq("id", log.id);

      const retry = await sendViaResend(fromAddress, log.recipient_email, resolved.subject, resolved.html);
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
        .eq("id", log.id);
    }

    processed++;
  }

  return { processed };
}

// ─── Main Handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const rlAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const blocked = await checkRateLimit(req, rlAdmin, "email", corsHeaders);
  if (blocked) return blocked;

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json();
    const { action } = body;

    // ─── Process Queue (for cron/scheduled calls) ───
    if (action === "process_queue") {
      const result = await processQueuedEmails(serviceClient);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Retry Logic ───
    if (action === "retry") {
      const { log_id } = body;
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

      const meta = logEntry.metadata || {};
      const resolved = await resolveTemplate(serviceClient, logEntry.email_type, logEntry.tenant_id, meta as Record<string, unknown>);
      const fromAddr = SENDERS[resolved.senderKey] || SENDERS["no-reply"];

      const result = await sendViaResend(fromAddr, logEntry.recipient_email, resolved.subject, resolved.html);

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

    // ─── Direct Send (for non-trigger use) ───
    const {
      email_type,
      recipient_email,
      tenant_id,
      user_id,
      entity_type,
      entity_id,
      data: templateData,
    } = body;

    if (!email_type || !recipient_email) {
      return new Response(JSON.stringify({ error: "email_type and recipient_email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolved = await resolveTemplate(serviceClient, email_type, tenant_id, templateData || {});
    const fromAddress = SENDERS[resolved.senderKey] || SENDERS["no-reply"];
    const senderEmail = fromAddress.match(/<(.+)>/)?.[1] || "no-reply@numaxio.com";

    // Insert log entry (pending)
    const { data: logRow, error: insertErr } = await serviceClient
      .from("email_logs")
      .insert({
        tenant_id: tenant_id || null,
        user_id: user_id || null,
        email_type,
        sender_address: senderEmail,
        recipient_email,
        subject: resolved.subject,
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

    const result = await sendViaResend(fromAddress, recipient_email, resolved.subject, resolved.html);

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

      const retry = await sendViaResend(fromAddress, recipient_email, resolved.subject, resolved.html);
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
