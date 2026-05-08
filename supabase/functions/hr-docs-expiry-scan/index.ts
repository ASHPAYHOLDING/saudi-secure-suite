import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const THRESHOLDS = [
  { days: 0, type: "expired" as const },
  { days: 7, type: "expiring_7" as const },
  { days: 14, type: "expiring_14" as const },
  { days: 30, type: "expiring_30" as const },
];

// Ignore these document types for expiry alerts
const IGNORED_TYPES = ["gosi_contract"];

const DEDUP_HOURS = 72;

const DOC_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  national_id: { ar: "الهوية الوطنية", en: "National ID" },
  national_id_or_iqama: { ar: "الهوية / الإقامة", en: "National ID / Iqama" },
  passport: { ar: "جواز السفر", en: "Passport" },
  iqama: { ar: "الإقامة", en: "Iqama" },
  work_contract: { ar: "عقد العمل", en: "Work Contract" },
  medical_insurance: { ar: "التأمين الطبي", en: "Medical Insurance" },
  driving_license: { ar: "رخصة القيادة", en: "Driving License" },
  degree_certificate: { ar: "شهادة جامعية", en: "Degree Certificate" },
  training_certificate: { ar: "شهادة تدريب", en: "Training Certificate" },
  bank_letter: { ar: "خطاب البنك", en: "Bank Letter" },
  other: { ar: "مستند", en: "Document" },
};

function buildEmailHtml(
  employeeName: string,
  docTypeAr: string,
  docTypeEn: string,
  expiryDate: string,
  daysLeft: number,
  employeeLink: string
): string {
  const isExpired = daysLeft < 0;
  const statusAr = isExpired ? "منتهي الصلاحية" : `ينتهي خلال ${Math.abs(daysLeft)} يوم`;
  const statusEn = isExpired ? "Expired" : `Expires in ${Math.abs(daysLeft)} days`;
  const headerBg = isExpired ? "#991b1b" : "#92400e";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin:0; padding:0; background:#f4f5f7; font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif; direction:rtl; }
  .container { max-width:600px; margin:0 auto; padding:24px 16px; }
  .card { background:#fff; border-radius:8px; border:1px solid #e2e8f0; overflow:hidden; }
  .header { background:${headerBg}; color:#fff; padding:20px 24px; }
  .header h1 { margin:0; font-size:17px; font-weight:600; }
  .header .subtitle { margin:4px 0 0; font-size:12px; color:#fef3c7; }
  .body { padding:24px; }
  .body p { margin:0 0 12px; font-size:14px; line-height:1.8; color:#334155; }
  .data-table { width:100%; border-collapse:collapse; margin:16px 0; }
  .data-table td { padding:10px 16px; font-size:13px; border-bottom:1px solid #f1f5f9; }
  .data-table td:first-child { color:#64748b; width:40%; }
  .data-table td:last-child { color:#0f172a; font-weight:600; text-align:left; }
  .warning-box { background:#fefce8; border:1px solid #fde68a; border-radius:8px; padding:16px; text-align:center; margin:16px 0; }
  .expired-box { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:16px; text-align:center; margin:16px 0; }
  .status { font-size:18px; font-weight:700; margin:0; }
  .label { font-size:12px; margin:4px 0 0; }
  .btn { display:inline-block; background:#0f172a; color:#fff; padding:10px 24px; border-radius:6px; text-decoration:none; font-size:13px; font-weight:600; margin:8px 0; }
  .footer { padding:16px 24px; text-align:center; }
  .footer p { margin:0; font-size:11px; color:#94a3b8; }
  .num { font-family:'Inter','SF Mono',monospace; direction:ltr; unicode-bidi:embed; }
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <div class="header">
      <h1>${isExpired ? "⚠ مستند منتهي الصلاحية" : "⏳ تنبيه انتهاء مستند"}</h1>
      <p class="subtitle">${isExpired ? "Expired Document Alert" : "Document Expiry Warning"}</p>
    </div>
    <div class="body">
      <p>يرجى الانتباه إلى أن أحد مستندات الموظف يحتاج إلى إجراء عاجل:</p>
      <div class="${isExpired ? "expired-box" : "warning-box"}">
        <p class="status" style="color:${isExpired ? "#991b1b" : "#92400e"}">${statusAr}</p>
        <p class="label" style="color:${isExpired ? "#b91c1c" : "#a16207"}">${statusEn}</p>
      </div>
      <table class="data-table">
        <tr><td>الموظف</td><td>${employeeName}</td></tr>
        <tr><td>نوع المستند</td><td>${docTypeAr} — ${docTypeEn}</td></tr>
        <tr><td>تاريخ الانتهاء</td><td class="num">${expiryDate}</td></tr>
      </table>
      <p>يرجى تحديث المستند لتجنب إيقاف الخدمات.</p>
      <p style="text-align:center;">
        <a class="btn" href="${employeeLink}">عرض ملف الموظف</a>
      </p>
    </div>
  </div>
  <div class="footer">
    <p>هذه رسالة آلية من نظام إدارة الموارد البشرية – لا تتطلب رداً</p>
    <p>© ${new Date().getFullYear()} Numaxio – نظام إدارة الأعمال</p>
  </div>
</div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Get the date 30 days from now
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 30);
    const futureDateStr = futureDate.toISOString().split("T")[0];

    // Find all documents with expiry_date <= 30 days from now, excluding gosi_contract
    const { data: docs, error: docsErr } = await serviceClient
      .from("employee_documents")
      .select(`
        id, tenant_id, employee_id, document_type, title, expiry_date,
        employee:hr_employees!employee_id(id, first_name, last_name)
      `)
      .not("expiry_date", "is", null)
      .lte("expiry_date", futureDateStr)
      .not("document_type", "eq", "gosi_contract");

    if (docsErr) throw docsErr;
    if (!docs || docs.length === 0) {
      return new Response(JSON.stringify({ message: "No expiring documents found", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let alertsCreated = 0;
    let emailsSent = 0;
    let notificationsCreated = 0;

    for (const doc of docs) {
      const expiryDate = new Date(doc.expiry_date);
      const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Determine alert type
      let alertType: string | null = null;
      for (const t of THRESHOLDS) {
        if (diffDays <= t.days) {
          alertType = t.type;
          break;
        }
      }
      if (!alertType) continue;

      // Check dedup: don't resend same alert_type for same doc within 72 hours
      const cutoff = new Date(today.getTime() - DEDUP_HOURS * 60 * 60 * 1000).toISOString();
      const { data: existing } = await serviceClient
        .from("hr_document_alerts")
        .select("id, last_sent_at")
        .eq("document_id", doc.id)
        .eq("alert_type", alertType)
        .single();

      if (existing && new Date(existing.last_sent_at).toISOString() > cutoff) {
        continue; // Already sent within 72h
      }

      const emp = doc.employee as any;
      const employeeName = `${emp?.first_name || ""} ${emp?.last_name || ""}`.trim();
      const docTypeInfo = DOC_TYPE_LABELS[doc.document_type] || DOC_TYPE_LABELS.other;

      // Get Owner + CFO users for this tenant
      const { data: members } = await serviceClient
        .from("tenant_members")
        .select("user_id, role")
        .eq("tenant_id", doc.tenant_id)
        .in("role", ["owner", "cfo"]);

      if (!members || members.length === 0) continue;

      // Build notification content
      const isExpired = diffDays < 0;
      const titleAr = isExpired
        ? `⚠ مستند منتهي: ${docTypeInfo.ar} — ${employeeName}`
        : `⏳ تنبيه: ${docTypeInfo.ar} ينتهي خلال ${Math.abs(diffDays)} يوم — ${employeeName}`;
      const bodyAr = isExpired
        ? `يرجى تحديث ${docTypeInfo.ar} للموظف ${employeeName} فوراً. المستند منتهي الصلاحية.`
        : `${docTypeInfo.ar} للموظف ${employeeName} ينتهي بتاريخ ${doc.expiry_date}. يرجى التحديث لتجنب إيقاف الخدمات.`;
      const link = `/dashboard/hr/employees/${doc.employee_id}?tab=documents`;

      // Insert notifications for each owner/cfo
      const notifRows = members.map((m: any) => ({
        tenant_id: doc.tenant_id,
        user_id: m.user_id,
        type: "hr_doc_expiry",
        title: titleAr,
        body: bodyAr,
        link,
      }));

      const { error: notifErr } = await serviceClient
        .from("user_notifications")
        .insert(notifRows);

      if (!notifErr) notificationsCreated += notifRows.length;

      // Send email to each owner/cfo
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, email, full_name")
        .in("id", members.map((m: any) => m.user_id));

      const appUrl = "https://numaxio.com";
      const employeeLink = `${appUrl}/dashboard/hr/employees/${doc.employee_id}?tab=documents`;

      for (const profile of (profiles || [])) {
        if (!profile.email) continue;

        const html = buildEmailHtml(
          employeeName,
          docTypeInfo.ar,
          docTypeInfo.en,
          doc.expiry_date,
          diffDays,
          employeeLink
        );

        const subject = isExpired
          ? `⚠ مستند منتهي: ${docTypeInfo.ar} — ${employeeName}`
          : `⏳ تنبيه انتهاء: ${docTypeInfo.ar} — ${employeeName}`;

        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "Numaxio HR <no-reply@numaxio.com>",
              to: [profile.email],
              subject,
              html,
            }),
          });
          const resData = await res.json();
          if (res.ok) emailsSent++;
          else console.error("Resend error:", resData);
        } catch (e) {
          console.error("Email send error:", e);
        }
      }

      // Upsert alert record
      if (existing) {
        await serviceClient
          .from("hr_document_alerts")
          .update({
            sent_in_app: true,
            sent_email: emailsSent > 0,
            last_sent_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await serviceClient
          .from("hr_document_alerts")
          .insert({
            tenant_id: doc.tenant_id,
            employee_id: doc.employee_id,
            document_id: doc.id,
            alert_type: alertType,
            sent_in_app: true,
            sent_email: emailsSent > 0,
            last_sent_at: new Date().toISOString(),
          });
      }

      alertsCreated++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: docs.length,
        alerts_created: alertsCreated,
        notifications_created: notificationsCreated,
        emails_sent: emailsSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in hr-docs-expiry-scan:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
