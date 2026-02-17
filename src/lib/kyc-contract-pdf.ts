/**
 * Professional KYC Contract PDF Generator
 * Generates a fully RTL Arabic official contract with Numaxio branding
 */

const NUMAXIO_LOGO_URL = '/numaxio-logo.png';

interface KycContractData {
  contractNumber: string;
  businessName: string;
  businessNameEn?: string;
  applicantType: string;
  crNumber?: string;
  vatNumber?: string;
  nationalId?: string;
  phone: string;
  email: string;
  iban: string;
  bankName?: string;
  subscriberFullName: string;
  subscriberSignedAt?: string;
  subscriberSignatureData?: string;
  agreementHtml: string;
  createdAt: string;
  status: string;
}

export const generateKycContractPdf = (data: KycContractData) => {
  const signDate = data.subscriberSignedAt
    ? new Date(data.subscriberSignedAt).toLocaleDateString('ar-SA', {
        year: 'numeric', month: 'long', day: 'numeric',
        calendar: 'islamic-umalqura',
      })
    : new Date(data.createdAt).toLocaleDateString('ar-SA', {
        year: 'numeric', month: 'long', day: 'numeric',
        calendar: 'islamic-umalqura',
      });

  const gregorianDate = new Date(data.createdAt).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const applicantTypeLabel =
    data.applicantType === 'company' ? 'شركة / مؤسسة' :
    data.applicantType === 'freelancer' ? 'عامل مستقل' : 'فرد';

  const statusLabel =
    data.status === 'approved' ? 'مُعتمد ✓' :
    data.status === 'pending' ? 'قيد المراجعة' :
    data.status === 'under_review' ? 'قيد التحقق' :
    data.status === 'rejected' ? 'مرفوض' : data.status;

  const statusColor =
    data.status === 'approved' ? '#059669' :
    data.status === 'pending' ? '#d97706' :
    data.status === 'rejected' ? '#dc2626' : '#6b7280';

  const signatureHtml = data.subscriberSignatureData
    ? `<img src="${data.subscriberSignatureData}" style="max-height:70px; margin-top:8px;" />`
    : '<div style="height:70px; border-bottom: 2px dotted #94a3b8; margin-top:8px;"></div>';

  const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>عقد خدمة نيوماكسيو باي - ${data.contractNumber}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html { direction: rtl; -webkit-text-size-adjust: 100%; }
  body {
    font-family: 'IBM Plex Sans Arabic', 'Arial', sans-serif;
    direction: rtl;
    color: #1a1a2e;
    background: white;
    line-height: 1.85;
    font-size: 12.5px;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  @page { size: A4; margin: 0; }
  @media print {
    html, body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body { padding: 0; }
    .page { page-break-after: always; min-height: auto; }
    .page:last-child { page-break-after: avoid; }
    .no-break { page-break-inside: avoid; }
  }
  @media screen {
    body { padding: 0; background: #f1f5f9; }
    .page {
      max-width: 210mm;
      margin: 20px auto;
      background: white;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      border-radius: 4px;
    }
  }
  .page { padding: 0; position: relative; min-height: 297mm; }
  .page-content { padding: 0 40px 40px 40px; }

  /* Header */
  .header {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    padding: 28px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 4px solid #14b8a6;
  }
  .header-right { display: flex; align-items: center; gap: 16px; }
  .header-logo {
    width: 48px;
    height: 48px;
    background: rgba(255,255,255,0.1);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .header-logo img { width: 40px; height: 40px; object-fit: contain; }
  .header-brand h1 {
    color: white;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }
  .header-brand p {
    color: #94a3b8;
    font-size: 11px;
    margin-top: 2px;
  }
  .header-left { text-align: left; direction: ltr; }
  .header-left p {
    color: #94a3b8;
    font-size: 10px;
    font-family: 'Inter', sans-serif;
  }
  .header-left .contract-num {
    color: #14b8a6;
    font-size: 13px;
    font-weight: 600;
    font-family: 'Inter', monospace;
  }

  /* Title Section */
  .title-section {
    text-align: center;
    padding: 30px 0 20px;
    border-bottom: 2px solid #e2e8f0;
    margin-bottom: 24px;
  }
  .title-section h2 {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 6px;
  }
  .title-section .subtitle {
    font-size: 11px;
    color: #64748b;
    line-height: 1.6;
  }
  .status-badge {
    display: inline-block;
    padding: 4px 16px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    margin-top: 10px;
  }

  /* Info Grid */
  .info-section {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 20px 24px;
    margin-bottom: 22px;
  }
  .info-section-title {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 14px;
    padding-bottom: 8px;
    border-bottom: 2px solid #14b8a6;
    display: inline-block;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 32px;
  }
  .info-item label {
    display: block;
    font-size: 10px;
    color: #94a3b8;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
  .info-item .value {
    font-size: 13px;
    font-weight: 600;
    color: #1e293b;
  }
  .info-item .value.en {
    font-family: 'Inter', monospace;
    direction: ltr;
    text-align: right;
    unicode-bidi: embed;
    letter-spacing: 0.5px;
  }

  /* Articles */
  .articles-section { margin-top: 20px; }
  .article {
    margin-bottom: 16px;
    page-break-inside: avoid;
  }
  .article-title {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .article-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: #14b8a6;
    color: white;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .article-body {
    font-size: 12px;
    line-height: 2;
    color: #334155;
    padding-right: 34px;
    text-align: justify;
  }

  /* Signature Section */
  .signature-section {
    margin-top: 30px;
    page-break-inside: avoid;
    border-top: 2px solid #e2e8f0;
    padding-top: 24px;
  }
  .sig-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
  }
  .sig-box {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
  }
  .sig-box-title {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 4px;
  }
  .sig-box-name {
    font-size: 12px;
    color: #64748b;
    margin-bottom: 8px;
  }
  .sig-date {
    font-size: 10px;
    color: #94a3b8;
    margin-top: 8px;
  }

  /* Footer */
  .footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    padding: 14px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9px;
    color: #94a3b8;
  }
  .footer-brand {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: #64748b;
  }
  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 80px;
    font-weight: 700;
    color: rgba(20, 184, 166, 0.04);
    pointer-events: none;
    white-space: nowrap;
    z-index: 0;
  }
</style>
</head>
<body>

<!-- Page 1 -->
<div class="page">
  <div class="watermark">نيوماكسيو باي</div>

  <!-- Header -->
  <div class="header">
    <div class="header-right">
      <div class="header-logo">
        <img src="${NUMAXIO_LOGO_URL}" alt="Numaxio" onerror="this.parentElement.innerHTML='<span style=\\'color:#14b8a6;font-size:20px;font-weight:700;\\'>N</span>'" />
      </div>
      <div class="header-brand">
        <h1>نيوماكسيو باي</h1>
        <p>خدمة الوساطة التقنية للدفع الإلكتروني</p>
      </div>
    </div>
    <div class="header-left">
      <p class="contract-num">${data.contractNumber}</p>
      <p>Numaxio Pay Service Agreement</p>
      <p>numaxio.com</p>
    </div>
  </div>

  <div class="page-content">
    <!-- Title -->
    <div class="title-section">
      <h2>إقرار وتعهد بالموافقة على شروط وأحكام خدمة "نيوماكسيو باي"</h2>
      <p class="subtitle">صادر وفقاً لأحكام نظام التجارة الإلكترونية ونظام المدفوعات بالمملكة العربية السعودية</p>
      <div class="status-badge" style="background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}40;">
        حالة العقد: ${statusLabel}
      </div>
    </div>

    <!-- Parties Info -->
    <div class="info-section">
      <div class="info-section-title">بيانات الطرف الأول (المنصة)</div>
      <div class="info-grid">
        <div class="info-item">
          <label>اسم المنصة</label>
          <div class="value">منصة نيوماكسيو</div>
        </div>
        <div class="info-item">
          <label>الموقع الإلكتروني</label>
          <div class="value en">numaxio.com</div>
        </div>
        <div class="info-item">
          <label>نوع الخدمة</label>
          <div class="value">وسيط تقني للدفع الإلكتروني</div>
        </div>
        <div class="info-item">
          <label>البلد</label>
          <div class="value">المملكة العربية السعودية</div>
        </div>
      </div>
    </div>

    <div class="info-section">
      <div class="info-section-title">بيانات الطرف الثاني (المشترك)</div>
      <div class="info-grid">
        <div class="info-item">
          <label>الاسم التجاري</label>
          <div class="value">${data.businessName}</div>
        </div>
        <div class="info-item">
          <label>نوع المنشأة</label>
          <div class="value">${applicantTypeLabel}</div>
        </div>
        ${data.crNumber ? `
        <div class="info-item">
          <label>رقم السجل التجاري</label>
          <div class="value en">${data.crNumber}</div>
        </div>` : ''}
        ${data.vatNumber ? `
        <div class="info-item">
          <label>الرقم الضريبي</label>
          <div class="value en">${data.vatNumber}</div>
        </div>` : ''}
        ${data.nationalId ? `
        <div class="info-item">
          <label>رقم الهوية الوطنية</label>
          <div class="value en">${data.nationalId}</div>
        </div>` : ''}
        <div class="info-item">
          <label>اسم المفوّض</label>
          <div class="value">${data.subscriberFullName}</div>
        </div>
        <div class="info-item">
          <label>البريد الإلكتروني</label>
          <div class="value en">${data.email}</div>
        </div>
        <div class="info-item">
          <label>رقم الجوال</label>
          <div class="value en">${data.phone}</div>
        </div>
        <div class="info-item">
          <label>رقم الآيبان (IBAN)</label>
          <div class="value en">${data.iban}</div>
        </div>
        ${data.bankName ? `
        <div class="info-item">
          <label>اسم البنك</label>
          <div class="value">${data.bankName}</div>
        </div>` : ''}
      </div>
    </div>

    <!-- Articles -->
    <div class="articles-section">

      <div class="article no-break">
        <div class="article-title"><span class="article-num">١</span> طبيعة الخدمة والوساطة التقنية</div>
        <div class="article-body">
          إن خدمة "نيوماكسيو باي" هي خدمة وساطة تقنية للدفع الإلكتروني تُتيحها منصة نيوماكسيو لمشتركيها وفقاً لنموذج التجميع (Payment Aggregation). يُقرّ المشترك بعلمه وفهمه التام بأن منصة نيوماكسيو ليست بنكاً ولا مؤسسة مالية مرخّصة ولا تقوم بمعالجة المدفوعات بشكل مباشر، وإنما تعمل حصراً بصفتها وسيط تقني يربط المشترك بمزوّد خدمة دفع طرف ثالث مرخّص ومعتمد من الجهات الرقابية المختصة في المملكة العربية السعودية.
        </div>
      </div>

      <div class="article no-break">
        <div class="article-title"><span class="article-num">٢</span> مزوّد خدمة الدفع</div>
        <div class="article-body">
          جميع عمليات الدفع والتحصيل والمعالجة المالية تتم حصرياً عبر مزوّد خدمة دفع طرف ثالث مرخّص من البنك المركزي السعودي (ساما) ومتوافق مع معايير أمان بيانات صناعة بطاقات الدفع (PCI DSS). إدارة نيوماكسيو هي الطرف المتعاقد مباشرةً مع مزوّد الخدمة، ويتم ربط المشتركين عبر البنية التقنية للمنصة دون الحاجة لتقديم مفاتيح API خاصة بهم.
        </div>
      </div>

      <div class="article no-break">
        <div class="article-title"><span class="article-num">٣</span> الرسوم والعمولات</div>
        <div class="article-body">
          يوافق المشترك على أن إدارة نيوماكسيو تحتفظ بالحق في تحديد وتعديل هيكل الرسوم المطبّقة على كل عملية دفع واردة، سواء كانت نسبة مئوية من قيمة العملية أو مبلغاً ثابتاً أو مزيجاً من الاثنين. يتم خصم الرسوم تلقائياً من المبالغ الواردة قبل تحويل الصافي إلى حساب المشترك. تحتفظ الإدارة بحق تعديل هيكل الرسوم مع إشعار مسبق لا يقل عن خمسة عشر (15) يوم عمل.
        </div>
      </div>

      <div class="article no-break">
        <div class="article-title"><span class="article-num">٤</span> تسوية المبالغ والتحويلات</div>
        <div class="article-body">
          تتم تسوية المبالغ الصافية (بعد خصم الرسوم) وفقاً لجدول التحويل المحدد من قبل الإدارة. يُقرّ المشترك بأن أوقات التسوية قد تتأثر بالعطل الرسمية والإجراءات البنكية. يلتزم المشترك بتقديم بيانات حسابه البنكي (IBAN) الصحيحة، ويتحمل كامل المسؤولية عن أي تأخير ناتج عن بيانات خاطئة.
        </div>
      </div>

      <div class="article no-break">
        <div class="article-title"><span class="article-num">٥</span> صحة البيانات والمعلومات</div>
        <div class="article-body">
          يتعهد المشترك بأن جميع البيانات والمستندات المقدّمة في هذا الطلب صحيحة ودقيقة ومحدّثة، ويتحمل كامل المسؤولية القانونية عن أي أخطاء أو معلومات مضللة. كما يلتزم بإخطار الإدارة فوراً بأي تغيير جوهري في بياناته خلال ثلاثين (30) يوماً من حدوث التغيير.
        </div>
      </div>

      <div class="article no-break">
        <div class="article-title"><span class="article-num">٦</span> الامتثال التنظيمي ومكافحة غسيل الأموال</div>
        <div class="article-body">
          يتعهد المشترك بالتزامه التام بجميع الأنظمة واللوائح المعمول بها في المملكة العربية السعودية، بما في ذلك على سبيل المثال لا الحصر: نظام مكافحة غسل الأموال، ونظام مكافحة تمويل الإرهاب، ونظام التجارة الإلكترونية، وأنظمة حماية المستهلك. يحق للإدارة طلب مستندات إضافية للتحقق من الامتثال في أي وقت.
        </div>
      </div>

      <div class="article no-break">
        <div class="article-title"><span class="article-num">٧</span> حق التعليق والإنهاء</div>
        <div class="article-body">
          يحق لإدارة نيوماكسيو تعليق أو إنهاء خدمة المشترك فوراً ودون إنذار مسبق في الحالات التالية: الاشتباه بعمليات احتيال أو غسيل أموال، مخالفة أي من شروط هذه الاتفاقية، تقديم معلومات كاذبة أو مضللة، صدور أمر قضائي أو طلب من جهة رقابية، أو وجود مخاطر تشغيلية تهدد سلامة المنصة.
        </div>
      </div>

      <div class="article no-break">
        <div class="article-title"><span class="article-num">٨</span> المسؤولية القانونية والتعويض</div>
        <div class="article-body">
          يتحمل المشترك كامل المسؤولية القانونية والمالية عن جميع العمليات التي تتم عبر حسابه، بما فيها عمليات الاسترداد (Chargebacks) والنزاعات المالية. تُعفى منصة نيوماكسيو من أي مسؤولية مباشرة أو غير مباشرة ناتجة عن استخدام المشترك للخدمة بما يخالف الأنظمة المعمول بها.
        </div>
      </div>

      <div class="article no-break">
        <div class="article-title"><span class="article-num">٩</span> حماية البيانات والخصوصية</div>
        <div class="article-body">
          يُقرّ المشترك بعلمه وموافقته على مشاركة بياناته الشخصية والتجارية مع مزوّد خدمة الدفع وذلك لأغراض معالجة المدفوعات والتحقق من الهوية والامتثال التنظيمي، وفقاً لأحكام نظام حماية البيانات الشخصية (PDPL) المعمول به في المملكة العربية السعودية. تلتزم الإدارة بحماية البيانات وعدم مشاركتها مع أطراف أخرى إلا بموجب متطلبات قانونية.
        </div>
      </div>

      <div class="article no-break">
        <div class="article-title"><span class="article-num">١٠</span> تعديل الشروط والأحكام</div>
        <div class="article-body">
          يحق لإدارة نيوماكسيو تعديل شروط وأحكام هذه الاتفاقية في أي وقت مع إخطار المشترك مسبقاً بمدة لا تقل عن خمسة عشر (15) يوم عمل. يُعتبر استمرار المشترك في استخدام الخدمة بعد سريان التعديلات موافقة ضمنية عليها.
        </div>
      </div>

    </div>

    <!-- Legal Notice -->
    <div class="no-break" style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 14px 18px; margin: 24px 0; font-size: 11px; color: #92400e; line-height: 1.8;">
      <strong>⚖️ ملاحظة قانونية:</strong> هذا الإقرار يُعدّ عقداً إلكترونياً ملزماً وفقاً لأحكام نظام التعاملات الإلكترونية الصادر بالمرسوم الملكي رقم (م/18) وتاريخ 8/3/1428هـ، ويخضع في تفسيره وتنفيذه للقضاء السعودي المختص في مدينة الرياض.
    </div>

    <!-- Signature Section -->
    <div class="signature-section no-break">
      <div class="sig-grid">
        <!-- Subscriber Signature -->
        <div class="sig-box" style="border-color: #14b8a6;">
          <div class="sig-box-title">توقيع الطرف الثاني (المشترك)</div>
          <div class="sig-box-name">${data.subscriberFullName}</div>
          ${signatureHtml}
          <div class="sig-date">التاريخ: ${signDate}</div>
          <div class="sig-date">الموافق: ${gregorianDate}</div>
        </div>

        <!-- Admin Signature Placeholder -->
        <div class="sig-box">
          <div class="sig-box-title">توقيع الطرف الأول (الإدارة)</div>
          <div class="sig-box-name">إدارة منصة نيوماكسيو</div>
          <div style="height:70px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:11px;">
            ${data.status === 'approved' ? '<span style="color:#059669;font-weight:700;font-size:14px;">✓ مُعتمد</span>' : 'في انتظار الاعتماد'}
          </div>
          <div class="sig-date">التاريخ: _______________</div>
        </div>
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-brand">
      نيوماكسيو — خدمات تقنية مالية متكاملة
    </div>
    <div style="text-align:left; direction:ltr;">
      <span style="font-family: 'Inter', monospace;">${data.contractNumber}</span>
      &nbsp;|&nbsp; صفحة ١ من ١
      &nbsp;|&nbsp; ${gregorianDate}
    </div>
  </div>
</div>

</body>
</html>`;

  return htmlContent;
};

export const downloadKycContractPdf = (data: KycContractData) => {
  const html = generateKycContractPdf(data);
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Fallback: download as HTML
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `عقد-نيوماكسيو-باي-${data.contractNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for fonts to load then trigger print (save as PDF)
  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
  };

  if (printWindow.document.fonts) {
    printWindow.document.fonts.ready.then(() => setTimeout(triggerPrint, 400));
  } else {
    setTimeout(triggerPrint, 1500);
  }
};
