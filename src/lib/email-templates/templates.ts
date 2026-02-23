/**
 * All 6 email templates × 2 locales = 12 template definitions
 * Each template uses {{variables}} for runtime substitution
 */

import { buildBaseLayout, severityBadgeHtml } from "./base-layout";

export interface EmailTemplateDef {
  template_key: string;
  locale: "ar" | "en";
  subject: string;
  html_body: string;
  text_body: string;
}

// ────────────────────────────────
// 1) platform.security_alert
// ────────────────────────────────

const securityAlertAr = buildBaseLayout({
  locale: "ar",
  title: "{{title}}",
  severityBadge: severityBadgeHtml("critical", "ar"),
  body: `<p style="margin:0 0 12px;">مرحباً {{user_name}},</p>
<p style="margin:0 0 12px;">{{message}}</p>
<p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">التاريخ: {{date}}</p>`,
  ctaLabel: "{{cta_label}}",
  ctaUrl: "{{cta_url}}",
  companyName: "{{company_name}}",
});

const securityAlertEn = buildBaseLayout({
  locale: "en",
  title: "{{title}}",
  severityBadge: severityBadgeHtml("critical", "en"),
  body: `<p style="margin:0 0 12px;">Hi {{user_name}},</p>
<p style="margin:0 0 12px;">{{message}}</p>
<p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">Date: {{date}}</p>`,
  ctaLabel: "{{cta_label}}",
  ctaUrl: "{{cta_url}}",
  companyName: "{{company_name}}",
});

// ────────────────────────────────
// 2) subscription.payment_failed
// ────────────────────────────────

const paymentFailedAr = buildBaseLayout({
  locale: "ar",
  title: "{{title}}",
  severityBadge: severityBadgeHtml("warning", "ar"),
  body: `<p style="margin:0 0 12px;">مرحباً {{user_name}},</p>
<p style="margin:0 0 12px;">{{message}}</p>
<p style="margin:0 0 12px;">يرجى تحديث بيانات الدفع لتجنب انقطاع الخدمة.</p>
<p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">التاريخ: {{date}}</p>`,
  ctaLabel: "{{cta_label}}",
  ctaUrl: "{{cta_url}}",
  companyName: "{{company_name}}",
});

const paymentFailedEn = buildBaseLayout({
  locale: "en",
  title: "{{title}}",
  severityBadge: severityBadgeHtml("warning", "en"),
  body: `<p style="margin:0 0 12px;">Hi {{user_name}},</p>
<p style="margin:0 0 12px;">{{message}}</p>
<p style="margin:0 0 12px;">Please update your payment details to avoid service interruption.</p>
<p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">Date: {{date}}</p>`,
  ctaLabel: "{{cta_label}}",
  ctaUrl: "{{cta_url}}",
  companyName: "{{company_name}}",
});

// ────────────────────────────────
// 3) hr.document_expiring
// ────────────────────────────────

const hrDocExpiringAr = buildBaseLayout({
  locale: "ar",
  title: "{{title}}",
  severityBadge: "{{severity_badge}}",
  body: `<p style="margin:0 0 12px;">مرحباً {{user_name}},</p>
<p style="margin:0 0 12px;">{{message}}</p>
{{items_table}}
<p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">التاريخ: {{date}}</p>`,
  ctaLabel: "{{cta_label}}",
  ctaUrl: "{{cta_url}}",
  companyName: "{{company_name}}",
});

const hrDocExpiringEn = buildBaseLayout({
  locale: "en",
  title: "{{title}}",
  severityBadge: "{{severity_badge}}",
  body: `<p style="margin:0 0 12px;">Hi {{user_name}},</p>
<p style="margin:0 0 12px;">{{message}}</p>
{{items_table}}
<p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">Date: {{date}}</p>`,
  ctaLabel: "{{cta_label}}",
  ctaUrl: "{{cta_url}}",
  companyName: "{{company_name}}",
});

// ────────────────────────────────
// 4) invoices.overdue
// ────────────────────────────────

const invoicesOverdueAr = buildBaseLayout({
  locale: "ar",
  title: "{{title}}",
  severityBadge: severityBadgeHtml("warning", "ar"),
  body: `<p style="margin:0 0 12px;">مرحباً {{user_name}},</p>
<p style="margin:0 0 12px;">{{message}}</p>
{{items_table}}
<p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">التاريخ: {{date}}</p>`,
  ctaLabel: "{{cta_label}}",
  ctaUrl: "{{cta_url}}",
  companyName: "{{company_name}}",
});

const invoicesOverdueEn = buildBaseLayout({
  locale: "en",
  title: "{{title}}",
  severityBadge: severityBadgeHtml("warning", "en"),
  body: `<p style="margin:0 0 12px;">Hi {{user_name}},</p>
<p style="margin:0 0 12px;">{{message}}</p>
{{items_table}}
<p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">Date: {{date}}</p>`,
  ctaLabel: "{{cta_label}}",
  ctaUrl: "{{cta_url}}",
  companyName: "{{company_name}}",
});

// ────────────────────────────────
// 5) approvals.requested
// ────────────────────────────────

const approvalsRequestedAr = buildBaseLayout({
  locale: "ar",
  title: "{{title}}",
  severityBadge: severityBadgeHtml("info", "ar"),
  body: `<p style="margin:0 0 12px;">مرحباً {{user_name}},</p>
<p style="margin:0 0 12px;">{{message}}</p>
{{items_table}}
<p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">التاريخ: {{date}}</p>`,
  ctaLabel: "{{cta_label}}",
  ctaUrl: "{{cta_url}}",
  companyName: "{{company_name}}",
});

const approvalsRequestedEn = buildBaseLayout({
  locale: "en",
  title: "{{title}}",
  severityBadge: severityBadgeHtml("info", "en"),
  body: `<p style="margin:0 0 12px;">Hi {{user_name}},</p>
<p style="margin:0 0 12px;">{{message}}</p>
{{items_table}}
<p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">Date: {{date}}</p>`,
  ctaLabel: "{{cta_label}}",
  ctaUrl: "{{cta_url}}",
  companyName: "{{company_name}}",
});

// ────────────────────────────────
// 6) generic.notification
// ────────────────────────────────

const genericNotificationAr = buildBaseLayout({
  locale: "ar",
  title: "{{title}}",
  body: `<p style="margin:0 0 12px;">مرحباً {{user_name}},</p>
<p style="margin:0 0 12px;">{{message}}</p>
{{items_table}}
<p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">التاريخ: {{date}}</p>`,
  ctaLabel: "{{cta_label}}",
  ctaUrl: "{{cta_url}}",
  companyName: "{{company_name}}",
});

const genericNotificationEn = buildBaseLayout({
  locale: "en",
  title: "{{title}}",
  body: `<p style="margin:0 0 12px;">Hi {{user_name}},</p>
<p style="margin:0 0 12px;">{{message}}</p>
{{items_table}}
<p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">Date: {{date}}</p>`,
  ctaLabel: "{{cta_label}}",
  ctaUrl: "{{cta_url}}",
  companyName: "{{company_name}}",
});

// ────────────────────────────────
// Export all templates
// ────────────────────────────────

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  // 1) Security Alert
  {
    template_key: "platform.security_alert",
    locale: "ar",
    subject: "🔒 تنبيه أمني — {{title}}",
    html_body: securityAlertAr,
    text_body: "تنبيه أمني: {{title}}\n\n{{message}}\n\nالتاريخ: {{date}}\n\n{{cta_label}}: {{cta_url}}",
  },
  {
    template_key: "platform.security_alert",
    locale: "en",
    subject: "🔒 Security Alert — {{title}}",
    html_body: securityAlertEn,
    text_body: "Security Alert: {{title}}\n\n{{message}}\n\nDate: {{date}}\n\n{{cta_label}}: {{cta_url}}",
  },

  // 2) Payment Failed
  {
    template_key: "subscription.payment_failed",
    locale: "ar",
    subject: "⚠️ فشل الدفع — {{company_name}}",
    html_body: paymentFailedAr,
    text_body: "فشل الدفع\n\n{{message}}\n\nيرجى تحديث بيانات الدفع.\n\nالتاريخ: {{date}}\n\n{{cta_label}}: {{cta_url}}",
  },
  {
    template_key: "subscription.payment_failed",
    locale: "en",
    subject: "⚠️ Payment Failed — {{company_name}}",
    html_body: paymentFailedEn,
    text_body: "Payment Failed\n\n{{message}}\n\nPlease update your payment details.\n\nDate: {{date}}\n\n{{cta_label}}: {{cta_url}}",
  },

  // 3) HR Document Expiring
  {
    template_key: "hr.document_expiring",
    locale: "ar",
    subject: "📋 وثائق قاربت على الانتهاء — {{company_name}}",
    html_body: hrDocExpiringAr,
    text_body: "وثائق قاربت على الانتهاء\n\n{{message}}\n\nالتاريخ: {{date}}\n\n{{cta_label}}: {{cta_url}}",
  },
  {
    template_key: "hr.document_expiring",
    locale: "en",
    subject: "📋 Documents Expiring Soon — {{company_name}}",
    html_body: hrDocExpiringEn,
    text_body: "Documents Expiring Soon\n\n{{message}}\n\nDate: {{date}}\n\n{{cta_label}}: {{cta_url}}",
  },

  // 4) Invoices Overdue
  {
    template_key: "invoices.overdue",
    locale: "ar",
    subject: "📄 فواتير متأخرة — {{company_name}}",
    html_body: invoicesOverdueAr,
    text_body: "فواتير متأخرة\n\n{{message}}\n\nالتاريخ: {{date}}\n\n{{cta_label}}: {{cta_url}}",
  },
  {
    template_key: "invoices.overdue",
    locale: "en",
    subject: "📄 Overdue Invoices — {{company_name}}",
    html_body: invoicesOverdueEn,
    text_body: "Overdue Invoices\n\n{{message}}\n\nDate: {{date}}\n\n{{cta_label}}: {{cta_url}}",
  },

  // 5) Approvals Requested
  {
    template_key: "approvals.requested",
    locale: "ar",
    subject: "✅ طلب موافقة جديد — {{company_name}}",
    html_body: approvalsRequestedAr,
    text_body: "طلب موافقة جديد\n\n{{message}}\n\nالتاريخ: {{date}}\n\n{{cta_label}}: {{cta_url}}",
  },
  {
    template_key: "approvals.requested",
    locale: "en",
    subject: "✅ Approval Request — {{company_name}}",
    html_body: approvalsRequestedEn,
    text_body: "Approval Request\n\n{{message}}\n\nDate: {{date}}\n\n{{cta_label}}: {{cta_url}}",
  },

  // 6) Generic Notification
  {
    template_key: "generic.notification",
    locale: "ar",
    subject: "{{title}} — {{company_name}}",
    html_body: genericNotificationAr,
    text_body: "{{title}}\n\n{{message}}\n\nالتاريخ: {{date}}\n\n{{cta_label}}: {{cta_url}}",
  },
  {
    template_key: "generic.notification",
    locale: "en",
    subject: "{{title}} — {{company_name}}",
    html_body: genericNotificationEn,
    text_body: "{{title}}\n\n{{message}}\n\nDate: {{date}}\n\n{{cta_label}}: {{cta_url}}",
  },
];
