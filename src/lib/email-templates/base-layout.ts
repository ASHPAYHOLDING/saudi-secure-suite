/**
 * Base Email Layout — Modern, Minimal, Mobile-first
 * Supports RTL (Arabic) and LTR (English)
 * Uses Tajawal/Cairo for Arabic, Inter for English
 * Single accent color (platform green) + black/gray text
 */

const ACCENT = "#10B981";  // emerald-500
const BG = "#F6F7F9";
const CARD_BG = "#FFFFFF";
const TEXT_PRIMARY = "#0F172A";   // slate-900
const TEXT_SECONDARY = "#475569"; // slate-600
const TEXT_MUTED = "#94A3B8";    // slate-400
const BORDER = "#E8EAED";
const FOOTER_TEXT = "#64748B";   // slate-500

export interface EmailLayoutOptions {
  locale: "ar" | "en";
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  itemsTable?: string;
  severityBadge?: string;
  footerText?: string;
  companyName?: string;
}

function getFontStack(locale: "ar" | "en"): string {
  return locale === "ar"
    ? "'Tajawal', 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif"
    : "'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif";
}

function getDir(locale: "ar" | "en"): string {
  return locale === "ar" ? "rtl" : "ltr";
}

function getAlign(locale: "ar" | "en"): string {
  return locale === "ar" ? "right" : "left";
}

export function severityBadgeHtml(severity: string, locale: "ar" | "en"): string {
  const colors: Record<string, { bg: string; text: string; label_ar: string; label_en: string }> = {
    info: { bg: "#EFF6FF", text: "#1E40AF", label_ar: "معلومة", label_en: "Info" },
    warning: { bg: "#FFFBEB", text: "#92400E", label_ar: "تحذير", label_en: "Warning" },
    critical: { bg: "#FEF2F2", text: "#991B1B", label_ar: "حرج", label_en: "Critical" },
  };
  const s = colors[severity] || colors.info;
  const label = locale === "ar" ? s.label_ar : s.label_en;
  return `<span style="display:inline-block;padding:4px 14px;border-radius:20px;background:${s.bg};color:${s.text};font-size:12px;font-weight:600;line-height:1.5;">${label}</span>`;
}

export function buildBaseLayout(options: EmailLayoutOptions): string {
  const {
    locale,
    title,
    body,
    ctaLabel,
    ctaUrl,
    itemsTable,
    severityBadge,
    footerText,
    companyName,
  } = options;

  const dir = getDir(locale);
  const align = getAlign(locale);
  const fontStack = getFontStack(locale);
  const year = new Date().getFullYear();

  const defaultFooter = locale === "ar"
    ? "هذه رسالة تشغيلية آلية — لا تتطلب رداً"
    : "This is an automated operational message — no reply needed";

  const poweredBy = locale === "ar" ? "مدعوم من" : "Powered by";

  const ctaBlock = ctaLabel && ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
        <tr>
          <td>
            <a href="${ctaUrl}" target="_blank" style="display:inline-block;background:${ACCENT};color:#FFFFFF;padding:0 32px;height:44px;line-height:44px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:600;font-family:${fontStack};">${ctaLabel}</a>
          </td>
        </tr>
       </table>`
    : "";

  const tableBlock = itemsTable || "";

  const badgeBlock = severityBadge
    ? `<div style="margin-bottom:16px;">${severityBadge}</div>`
    : "";

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${locale === "ar" ? "ar" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${title}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-rspace: 0pt; mso-table-lspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: ${BG}; }
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; padding: 16px !important; }
    .card { border-radius: 0 !important; }
    .content-cell { padding: 24px 20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${fontStack};direction:${dir};">

<!-- Preheader -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
  ${title}
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BG};">
<tr>
<td align="center" style="padding:32px 16px;">

  <!-- Container -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;width:100%;">

    <!-- Logo Header -->
    <tr>
      <td align="center" style="padding:0 0 24px;">
        <span style="font-family:${fontStack};font-size:20px;font-weight:700;color:${TEXT_PRIMARY};letter-spacing:-0.5px;">NUMAX<span style="color:${ACCENT};">IO</span></span>
      </td>
    </tr>

    <!-- Card -->
    <tr>
      <td>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="card" style="background:${CARD_BG};border-radius:16px;border:1px solid ${BORDER};overflow:hidden;">

          <!-- Accent top bar -->
          <tr>
            <td style="height:3px;background:${ACCENT};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content-cell" style="padding:32px 36px;">
              ${badgeBlock}
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:${TEXT_PRIMARY};font-family:${fontStack};line-height:1.4;text-align:${align};">${title}</h1>
              <div style="margin:0 0 20px;font-size:14px;line-height:1.8;color:${TEXT_SECONDARY};font-family:${fontStack};text-align:${align};">
                ${body}
              </div>
              ${tableBlock}
              ${ctaBlock}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:24px 0;text-align:center;">
        <p style="margin:0 0 6px;font-size:12px;color:${FOOTER_TEXT};font-family:${fontStack};">
          ${footerText || defaultFooter}
        </p>
        <p style="margin:0;font-size:11px;color:${TEXT_MUTED};font-family:${fontStack};">
          © ${year} ${companyName || "Numaxio"} · ${poweredBy} Numaxio
        </p>
      </td>
    </tr>

  </table>

</td>
</tr>
</table>

</body>
</html>`;
}

/**
 * Build a data table for email (items list)
 */
export function buildItemsTable(
  headers: string[],
  rows: string[][],
  locale: "ar" | "en"
): string {
  const align = locale === "ar" ? "right" : "left";
  const fontStack = getFontStack(locale);

  const headerCells = headers
    .map(
      (h) =>
        `<th style="padding:10px 14px;text-align:${align};font-size:12px;font-weight:600;color:${TEXT_SECONDARY};font-family:${fontStack};border-bottom:2px solid ${BORDER};white-space:nowrap;">${h}</th>`
    )
    .join("");

  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="padding:10px 14px;text-align:${align};font-size:13px;color:${TEXT_PRIMARY};font-family:${fontStack};border-bottom:1px solid #F1F5F9;">${cell}</td>`
          )
          .join("")}</tr>`
    )
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0 8px;border-collapse:collapse;">
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>`;
}
