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
  // HR
  member_invitation: "no-reply",
  hr_document_expiring: "no-reply",
  hr_contract_expiring: "no-reply",
  hr_payroll_ready: "no-reply",
  hr_leave_request: "no-reply",
  hr_employee_onboarding: "no-reply",
  // Approvals
  approval_requested: "no-reply",
  approval_approved: "no-reply",
  approval_rejected: "no-reply",
  // Budget
  budget_alert: "billing",
  budget_exceeded: "billing",
  // Contracts
  contract_expiring: "no-reply",
  contract_renewed: "no-reply",
  // Inventory
  inventory_low_stock: "no-reply",
  inventory_reorder: "no-reply",
  // Quotations
  quotation_created: "billing",
  quotation_accepted: "billing",
  quotation_expired: "billing",
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

    // ═══════════════════════════════════════
    // MEMBER INVITATION
    // ═══════════════════════════════════════
    case "member_invitation":
      return {
        subject: `دعوة للانضمام إلى ${d.company_name || "المنشأة"} – Numaxio`,
        html: generalWrap(
          "دعوة للانضمام إلى فريق العمل",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">مرحباً <strong>${d.user_name || d.email || ""}</strong>،</p>
           <p style="color:#4a5568;font-size:15px;line-height:1.9;">تمت دعوتك للانضمام إلى <strong>${d.company_name || "المنشأة"}</strong> بصفتك <strong>${d.role_label || d.role || "عضو"}</strong>.</p>
           <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
             <p style="margin:0;font-size:18px;font-weight:700;color:#166534;">🎉 تمت الدعوة بنجاح</p>
             <p style="margin:4px 0 0;color:#15803d;font-size:13px;">تم تفعيل حسابك تلقائياً</p>
           </div>
           <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
             <table style="width:100%;font-size:14px;color:#374151;">
               <tr><td style="padding:6px 0;color:#6b7280;">المنشأة:</td><td style="text-align:left;font-weight:600;">${d.company_name || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">الدور:</td><td style="text-align:left;font-weight:600;">${d.role_label || d.role || "عضو"}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">تمت الدعوة بواسطة:</td><td style="text-align:left;font-weight:600;">${d.invited_by || ""}</td></tr>
             </table>
           </div>
           ${d.is_new_user ? `<p style="color:#4a5568;font-size:14px;line-height:1.8;">تم إنشاء حساب جديد لك. يرجى تسجيل الدخول وتعيين كلمة مرور جديدة عبر خيار "نسيت كلمة المرور".</p>` : ''}
           <p style="text-align:center;"><a href="${d.login_url || '#'}" style="display:inline-block;background:#10B981;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">تسجيل الدخول الآن</a></p>`
        ),
      };

    // ═══════════════════════════════════════
    // HR EMAILS
    // ═══════════════════════════════════════
    case "hr_document_expiring":
      return {
        subject: `📋 وثائق قاربت على الانتهاء – ${d.company_name || ""}`,
        html: formalWrap(
          "تنبيه: وثائق قاربت على الانتهاء",
          `<p>يوجد وثائق تحتاج إلى تجديد قريباً:</p>
          <table class="data-table">
            <tr><td>اسم الموظف</td><td>${d.employee_name || ""}</td></tr>
            <tr><td>نوع الوثيقة</td><td>${d.document_type || ""}</td></tr>
            <tr><td>تاريخ الانتهاء</td><td class="num">${d.expiry_date || ""}</td></tr>
            <tr><td>الأيام المتبقية</td><td class="num">${d.days_remaining || ""} يوم</td></tr>
          </table>
          <div class="warning-box">
            <p class="amount">${d.days_remaining || ""} يوم</p>
            <p class="label">متبقي على الانتهاء</p>
          </div>
          <p>يرجى اتخاذ الإجراء اللازم لتجديد الوثيقة قبل انتهائها.</p>`,
          d.company_name as string
        ),
      };

    case "hr_contract_expiring":
      return {
        subject: `📄 عقد عمل قارب على الانتهاء – ${d.company_name || ""}`,
        html: formalWrap(
          "تنبيه: عقد عمل قارب على الانتهاء",
          `<p>عقد عمل يحتاج إلى مراجعة وتجديد:</p>
          <table class="data-table">
            <tr><td>اسم الموظف</td><td>${d.employee_name || ""}</td></tr>
            <tr><td>نوع العقد</td><td>${d.contract_type || ""}</td></tr>
            <tr><td>تاريخ الانتهاء</td><td class="num">${d.expiry_date || ""}</td></tr>
          </table>
          <div class="warning-box">
            <p class="amount">${d.days_remaining || ""} يوم</p>
            <p class="label">متبقي على انتهاء العقد</p>
          </div>`,
          d.company_name as string
        ),
      };

    case "hr_payroll_ready":
      return {
        subject: `💰 كشف الرواتب جاهز – ${d.company_name || ""}`,
        html: formalWrap(
          "كشف الرواتب جاهز للمراجعة",
          `<p>تم إعداد كشف الرواتب للفترة التالية:</p>
          <table class="data-table">
            <tr><td>الشهر</td><td>${d.period || ""}</td></tr>
            <tr><td>عدد الموظفين</td><td class="num">${d.employee_count || 0}</td></tr>
            <tr><td>إجمالي الرواتب</td><td class="num">${d.total_amount || 0} ${d.currency || "ر.س"}</td></tr>
          </table>
          <div class="amount-box">
            <p class="amount num">${d.total_amount || 0} ${d.currency || "ر.س"}</p>
            <p class="label">إجمالي المبلغ المطلوب</p>
          </div>
          <p>يرجى المراجعة والاعتماد.</p>`,
          d.company_name as string
        ),
      };

    case "hr_leave_request":
      return {
        subject: `🗓️ طلب إجازة جديد – ${d.company_name || ""}`,
        html: generalWrap(
          "طلب إجازة جديد",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">تم تقديم طلب إجازة جديد:</p>
           <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
             <table style="width:100%;font-size:14px;color:#374151;">
               <tr><td style="padding:6px 0;color:#6b7280;">الموظف:</td><td style="text-align:left;font-weight:600;">${d.employee_name || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">نوع الإجازة:</td><td style="text-align:left;font-weight:600;">${d.leave_type || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">من:</td><td style="text-align:left;font-weight:600;">${d.start_date || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">إلى:</td><td style="text-align:left;font-weight:600;">${d.end_date || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">عدد الأيام:</td><td style="text-align:left;font-weight:600;">${d.days_count || ""}</td></tr>
             </table>
           </div>`
        ),
      };

    case "hr_employee_onboarding":
      return {
        subject: `👋 مرحباً بك في ${d.company_name || "الفريق"} – Numaxio`,
        html: generalWrap(
          "مرحباً بك في الفريق!",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">مرحباً <strong>${d.employee_name || ""}</strong>،</p>
           <p style="color:#4a5568;font-size:15px;line-height:1.9;">يسعدنا انضمامك إلى <strong>${d.company_name || ""}</strong>! تم إعداد حسابك بنجاح.</p>
           <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
             <p style="margin:0;font-size:18px;font-weight:700;color:#166534;">🎉 أهلاً وسهلاً</p>
           </div>
           <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
             <table style="width:100%;font-size:14px;color:#374151;">
               <tr><td style="padding:6px 0;color:#6b7280;">القسم:</td><td style="text-align:left;font-weight:600;">${d.department || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">المسمى الوظيفي:</td><td style="text-align:left;font-weight:600;">${d.job_title || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">تاريخ الالتحاق:</td><td style="text-align:left;font-weight:600;">${d.start_date || ""}</td></tr>
             </table>
           </div>`
        ),
      };

    // ═══════════════════════════════════════
    // APPROVAL EMAILS
    // ═══════════════════════════════════════
    case "approval_requested":
      return {
        subject: `✅ طلب موافقة جديد – ${d.company_name || ""}`,
        html: generalWrap(
          "طلب موافقة جديد",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">مرحباً <strong>${d.user_name || ""}</strong>،</p>
           <p style="color:#4a5568;font-size:15px;line-height:1.9;">تم تقديم طلب موافقة جديد يحتاج مراجعتك:</p>
           <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
             <table style="width:100%;font-size:14px;color:#374151;">
               <tr><td style="padding:6px 0;color:#6b7280;">نوع المستند:</td><td style="text-align:left;font-weight:600;">${d.document_type || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">رقم المستند:</td><td style="text-align:left;font-weight:600;">${d.document_number || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">المبلغ:</td><td style="text-align:left;font-weight:600;">${d.amount || ""} ${d.currency || "ر.س"}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">مقدم الطلب:</td><td style="text-align:left;font-weight:600;">${d.requester_name || ""}</td></tr>
             </table>
           </div>`
        ),
      };

    case "approval_approved":
      return {
        subject: `✅ تمت الموافقة – ${d.document_number || ""} – ${d.company_name || ""}`,
        html: generalWrap(
          "تمت الموافقة على طلبك",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">مرحباً <strong>${d.user_name || ""}</strong>،</p>
           <p style="color:#4a5568;font-size:15px;line-height:1.9;">تمت الموافقة على طلبك بنجاح.</p>
           <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
             <p style="margin:0;font-size:18px;font-weight:700;color:#166534;">✓ تمت الموافقة</p>
           </div>
           <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
             <table style="width:100%;font-size:14px;color:#374151;">
               <tr><td style="padding:6px 0;color:#6b7280;">نوع المستند:</td><td style="text-align:left;font-weight:600;">${d.document_type || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">رقم المستند:</td><td style="text-align:left;font-weight:600;">${d.document_number || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">تمت الموافقة بواسطة:</td><td style="text-align:left;font-weight:600;">${d.approver_name || ""}</td></tr>
             </table>
           </div>`
        ),
      };

    case "approval_rejected":
      return {
        subject: `❌ تم رفض الطلب – ${d.document_number || ""} – ${d.company_name || ""}`,
        html: generalWrap(
          "تم رفض طلبك",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">مرحباً <strong>${d.user_name || ""}</strong>،</p>
           <p style="color:#4a5568;font-size:15px;line-height:1.9;">للأسف تم رفض طلبك.</p>
           <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
             <p style="margin:0;font-size:18px;font-weight:700;color:#991b1b;">✗ تم الرفض</p>
           </div>
           <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
             <table style="width:100%;font-size:14px;color:#374151;">
               <tr><td style="padding:6px 0;color:#6b7280;">نوع المستند:</td><td style="text-align:left;font-weight:600;">${d.document_type || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">رقم المستند:</td><td style="text-align:left;font-weight:600;">${d.document_number || ""}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">سبب الرفض:</td><td style="text-align:left;font-weight:600;">${d.rejection_reason || "—"}</td></tr>
             </table>
           </div>`
        ),
      };

    // ═══════════════════════════════════════
    // BUDGET EMAILS
    // ═══════════════════════════════════════
    case "budget_alert":
      return {
        subject: `⚠️ تنبيه ميزانية – ${d.budget_name || ""} – ${d.company_name || ""}`,
        html: formalWrap(
          "تنبيه: اقتراب من حد الميزانية",
          `<p>تم تجاوز نسبة الإنفاق المحددة للميزانية:</p>
          <div class="warning-box">
            <p class="amount">${d.percent_used || 0}%</p>
            <p class="label">نسبة الاستهلاك</p>
          </div>
          <table class="data-table">
            <tr><td>اسم الميزانية</td><td>${d.budget_name || ""}</td></tr>
            <tr><td>البند</td><td>${d.line_description || "—"}</td></tr>
            <tr><td>المبلغ المخطط</td><td class="num">${d.planned_amount || 0} ${d.currency || "ر.س"}</td></tr>
            <tr><td>المبلغ الفعلي</td><td class="num">${d.actual_amount || 0} ${d.currency || "ر.س"}</td></tr>
          </table>
          <p>يرجى مراجعة الإنفاق واتخاذ الإجراءات المناسبة.</p>`,
          d.company_name as string
        ),
      };

    case "budget_exceeded":
      return {
        subject: `🚨 تجاوز الميزانية – ${d.budget_name || ""} – ${d.company_name || ""}`,
        html: formalWrap(
          "تحذير: تجاوز حد الميزانية",
          `<p>تم تجاوز الميزانية المحددة:</p>
          <div class="error-box">
            <p class="amount">${d.percent_used || 0}%</p>
            <p class="label">تم التجاوز!</p>
          </div>
          <table class="data-table">
            <tr><td>اسم الميزانية</td><td>${d.budget_name || ""}</td></tr>
            <tr><td>المبلغ المخطط</td><td class="num">${d.planned_amount || 0} ${d.currency || "ر.س"}</td></tr>
            <tr><td>المبلغ الفعلي</td><td class="num">${d.actual_amount || 0} ${d.currency || "ر.س"}</td></tr>
            <tr><td>مبلغ التجاوز</td><td class="num">${d.exceeded_amount || 0} ${d.currency || "ر.س"}</td></tr>
          </table>`,
          d.company_name as string
        ),
      };

    // ═══════════════════════════════════════
    // CONTRACT EMAILS
    // ═══════════════════════════════════════
    case "contract_expiring":
      return {
        subject: `📄 عقد قارب على الانتهاء – ${d.company_name || ""}`,
        html: formalWrap(
          "تنبيه: عقد قارب على الانتهاء",
          `<p>عقد يحتاج إلى مراجعة وتجديد:</p>
          <table class="data-table">
            <tr><td>العميل</td><td>${d.customer_name || ""}</td></tr>
            <tr><td>نوع العقد</td><td>${d.contract_type || ""}</td></tr>
            <tr><td>تاريخ الانتهاء</td><td class="num">${d.expiry_date || ""}</td></tr>
            <tr><td>الأيام المتبقية</td><td class="num">${d.days_remaining || ""} يوم</td></tr>
          </table>
          <div class="warning-box">
            <p class="amount">${d.days_remaining || ""} يوم</p>
            <p class="label">متبقي على الانتهاء</p>
          </div>`,
          d.company_name as string
        ),
      };

    case "contract_renewed":
      return {
        subject: `✅ تم تجديد العقد – ${d.company_name || ""}`,
        html: formalWrap(
          "تم تجديد العقد بنجاح",
          `<p>تم تجديد العقد التالي:</p>
          <div class="success-box">
            <p class="amount">✓ تم التجديد</p>
            <p class="label">العقد نشط الآن</p>
          </div>
          <table class="data-table">
            <tr><td>العميل</td><td>${d.customer_name || ""}</td></tr>
            <tr><td>تاريخ التجديد</td><td class="num">${d.renewal_date || ""}</td></tr>
            <tr><td>تاريخ الانتهاء الجديد</td><td class="num">${d.new_expiry_date || ""}</td></tr>
          </table>`,
          d.company_name as string
        ),
      };

    // ═══════════════════════════════════════
    // INVENTORY EMAILS
    // ═══════════════════════════════════════
    case "inventory_low_stock":
      return {
        subject: `⚠️ مخزون منخفض – ${d.product_name || ""} – ${d.company_name || ""}`,
        html: formalWrap(
          "تنبيه: مخزون منخفض",
          `<p>المنتج التالي وصل لمستوى مخزون منخفض:</p>
          <div class="warning-box">
            <p class="amount">${d.current_qty || 0} وحدة</p>
            <p class="label">الكمية الحالية</p>
          </div>
          <table class="data-table">
            <tr><td>المنتج</td><td>${d.product_name || ""}</td></tr>
            <tr><td>الكمية الحالية</td><td class="num">${d.current_qty || 0}</td></tr>
            <tr><td>حد إعادة الطلب</td><td class="num">${d.reorder_level || 0}</td></tr>
            <tr><td>المستودع</td><td>${d.warehouse_name || "—"}</td></tr>
          </table>
          <p>يرجى إعادة الطلب لتجنب نفاد المخزون.</p>`,
          d.company_name as string
        ),
      };

    case "inventory_reorder":
      return {
        subject: `📦 طلب إعادة تعبئة مخزون – ${d.company_name || ""}`,
        html: formalWrap(
          "طلب إعادة تعبئة مخزون",
          `<p>تم إنشاء طلب إعادة تعبئة تلقائي:</p>
          <table class="data-table">
            <tr><td>المنتج</td><td>${d.product_name || ""}</td></tr>
            <tr><td>الكمية المطلوبة</td><td class="num">${d.order_qty || 0}</td></tr>
            <tr><td>المورد</td><td>${d.supplier_name || "—"}</td></tr>
          </table>`,
          d.company_name as string
        ),
      };

    // ═══════════════════════════════════════
    // QUOTATION EMAILS
    // ═══════════════════════════════════════
    case "quotation_created":
      return {
        subject: `عرض سعر رقم ${d.quotation_number || ""} – ${d.company_name || ""}`,
        html: formalWrap(
          "عرض سعر جديد",
          `<p>السيد/ة <strong>${d.customer_name || "العميل"}</strong> المحترم/ة،</p>
          <p>نرفق لكم عرض السعر التالي:</p>
          <table class="data-table">
            <tr><td>رقم العرض</td><td class="num">${d.quotation_number || ""}</td></tr>
            <tr><td>التاريخ</td><td class="num">${d.date || ""}</td></tr>
            <tr><td>صالح حتى</td><td class="num">${d.valid_until || ""}</td></tr>
          </table>
          <div class="amount-box">
            <p class="amount num">${d.total || 0} ${d.currency || "ر.س"}</p>
            <p class="label">إجمالي العرض (شامل الضريبة)</p>
          </div>`,
          d.company_name as string,
          d.vat_number as string
        ),
      };

    case "quotation_accepted":
      return {
        subject: `✅ تم قبول عرض السعر ${d.quotation_number || ""} – ${d.company_name || ""}`,
        html: generalWrap(
          "تم قبول عرض السعر",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">تم قبول عرض السعر رقم <strong>${d.quotation_number || ""}</strong> من العميل <strong>${d.customer_name || ""}</strong>.</p>
           <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
             <p style="margin:0;font-size:24px;font-weight:700;color:#166534;">${d.total || 0} ${d.currency || "ر.س"}</p>
             <p style="margin:4px 0 0;color:#15803d;font-size:13px;">✓ تم القبول</p>
           </div>`
        ),
      };

    case "quotation_expired":
      return {
        subject: `⏰ انتهاء صلاحية عرض السعر ${d.quotation_number || ""} – ${d.company_name || ""}`,
        html: generalWrap(
          "انتهاء صلاحية عرض سعر",
          `<p style="color:#4a5568;font-size:15px;line-height:1.9;">انتهت صلاحية عرض السعر رقم <strong>${d.quotation_number || ""}</strong> المقدم للعميل <strong>${d.customer_name || ""}</strong>.</p>
           <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
             <p style="margin:0;font-size:16px;font-weight:600;color:#92400e;">انتهت الصلاحية</p>
           </div>
           <p style="color:#6b7280;font-size:14px;">يمكنك إنشاء عرض سعر جديد أو تمديد الصلاحية.</p>`
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

// ─── Email Type → Preference Key Mapping ───
const TYPE_PREF_KEY: Record<string, string> = {
  invoice: "send_invoice_email",
  financial_invoice: "send_invoice_email",
  payment_receipt: "send_payment_receipt",
  financial_payment_receipt: "send_payment_receipt",
  security_alert: "send_security_alert",
};

// ─── Check tenant email preferences ───
async function isEmailAllowed(
  serviceClient: ReturnType<typeof createClient>,
  emailType: string,
  tenantId: string | null
): Promise<boolean> {
  if (!tenantId) return true; // Platform-level emails always sent
  const prefKey = TYPE_PREF_KEY[emailType];
  if (!prefKey) return true; // No preference mapping → always send

  try {
    const { data } = await serviceClient
      .from("tenant_settings")
      .select("email_preferences")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!data?.email_preferences) return true; // No settings → default to send
    const prefs = data.email_preferences as Record<string, unknown>;
    return prefs[prefKey] !== false; // Only block if explicitly false
  } catch {
    return true; // On error, default to send
  }
}

// ─── Get tenant sender overrides ───
async function getTenantSenderOverrides(
  serviceClient: ReturnType<typeof createClient>,
  tenantId: string | null
): Promise<{ fromName?: string; replyTo?: string }> {
  if (!tenantId) return {};
  try {
    const { data } = await serviceClient
      .from("tenant_settings")
      .select("email_preferences")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!data?.email_preferences) return {};
    const prefs = data.email_preferences as Record<string, unknown>;
    return {
      fromName: prefs.from_name as string || undefined,
      replyTo: prefs.reply_to_email as string || undefined,
    };
  } catch {
    return {};
  }
}

// ─── Send via Resend ───
async function sendViaResend(
  from: string,
  to: string,
  subject: string,
  html: string,
  replyTo?: string
): Promise<{ success: boolean; providerId?: string; error?: string }> {
  try {
    const payload: Record<string, unknown> = { from, to: [to], subject, html };
    if (replyTo) payload.reply_to = replyTo;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
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
    // Check tenant email preferences
    const allowed = await isEmailAllowed(serviceClient, log.email_type, log.tenant_id);
    if (!allowed) {
      await serviceClient.from("email_logs").update({ status: "skipped", failure_reason: "Disabled by tenant email preferences" }).eq("id", log.id);
      processed++;
      continue;
    }

    const meta = (log.metadata || {}) as Record<string, unknown>;
    const resolved = await resolveTemplate(serviceClient, log.email_type, log.tenant_id, meta);
    const overrides = await getTenantSenderOverrides(serviceClient, log.tenant_id);
    let fromAddress = SENDERS[resolved.senderKey] || SENDERS["no-reply"];
    if (overrides.fromName) {
      const email = fromAddress.match(/<(.+)>/)?.[1] || "no-reply@numaxio.com";
      fromAddress = `${overrides.fromName} <${email}>`;
    }

    const result = await sendViaResend(fromAddress, log.recipient_email, resolved.subject, resolved.html, overrides.replyTo);

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

      const retry = await sendViaResend(fromAddress, log.recipient_email, resolved.subject, resolved.html, overrides.replyTo);
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
      const retryOverrides = await getTenantSenderOverrides(serviceClient, logEntry.tenant_id);
      let fromAddr = SENDERS[resolved.senderKey] || SENDERS["no-reply"];
      if (retryOverrides.fromName) {
        const email = fromAddr.match(/<(.+)>/)?.[1] || "no-reply@numaxio.com";
        fromAddr = `${retryOverrides.fromName} <${email}>`;
      }

      const result = await sendViaResend(fromAddr, logEntry.recipient_email, resolved.subject, resolved.html, retryOverrides.replyTo);

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

    // Check tenant email preferences
    const allowed = await isEmailAllowed(serviceClient, email_type, tenant_id);
    if (!allowed) {
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: "Disabled by tenant email preferences" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resolved = await resolveTemplate(serviceClient, email_type, tenant_id, templateData || {});
    const overrides = await getTenantSenderOverrides(serviceClient, tenant_id);
    let fromAddress = SENDERS[resolved.senderKey] || SENDERS["no-reply"];
    if (overrides.fromName) {
      const email = fromAddress.match(/<(.+)>/)?.[1] || "no-reply@numaxio.com";
      fromAddress = `${overrides.fromName} <${email}>`;
    }
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

    const result = await sendViaResend(fromAddress, recipient_email, resolved.subject, resolved.html, overrides.replyTo);

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

      const retry = await sendViaResend(fromAddress, recipient_email, resolved.subject, resolved.html, overrides.replyTo);
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
