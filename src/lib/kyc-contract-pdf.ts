/**
 * Professional KYC Contract PDF Generator - Premium Edition
 * Modern, animated-style contract with SVG icons, tables, and comprehensive legal terms
 * Full RTL Arabic with Numaxio branding
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

// SVG Icons as inline strings
const ICONS = {
  shield: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  handshake: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17a4 4 0 0 0 8 0"/><path d="M5 17a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4"/><path d="m15 5-3 3-3-3"/><path d="M9 8V3h6v5"/></svg>`,
  building: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`,
  user: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  wallet: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>`,
  scale: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>`,
  clock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  fileCheck: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>`,
  lock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  alertTriangle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  banknote: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>`,
  globe: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
  pen: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`,
  gavel: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 13-7.5 7.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/></svg>`,
  checkCircle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
  xCircle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
  stamp: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-.66-.26-1.3-.73-1.77Z"/><path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13"/></svg>`,
};

const ARTICLE_ICONS: Record<number, string> = {
  1: ICONS.globe,
  2: ICONS.wallet,
  3: ICONS.banknote,
  4: ICONS.clock,
  5: ICONS.fileCheck,
  6: ICONS.shield,
  7: ICONS.alertTriangle,
  8: ICONS.scale,
  9: ICONS.lock,
  10: ICONS.pen,
  11: ICONS.gavel,
  12: ICONS.handshake,
};

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
    data.status === 'approved' ? 'مُعتمد' :
    data.status === 'pending' ? 'قيد المراجعة' :
    data.status === 'under_review' ? 'قيد التحقق' :
    data.status === 'rejected' ? 'مرفوض' : data.status;

  const statusColor =
    data.status === 'approved' ? '#059669' :
    data.status === 'pending' ? '#d97706' :
    data.status === 'rejected' ? '#dc2626' : '#6b7280';

  const statusIcon = data.status === 'approved' ? ICONS.checkCircle : 
    data.status === 'rejected' ? ICONS.xCircle : 
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${statusColor}" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;

  const signatureHtml = data.subscriberSignatureData
    ? `<img src="${data.subscriberSignatureData}" style="max-height:80px; margin-top:12px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));" />`
    : '<div style="height:80px; border-bottom: 2px dotted #cbd5e1; margin-top:12px;"></div>';

  const articles = [
    {
      num: 1, title: 'طبيعة الخدمة والوساطة التقنية',
      body: `إن خدمة "نيوماكسيو باي" هي خدمة وساطة تقنية تُتيحها منصة نيوماكسيو لمشتركيها وفقاً لنموذج التجميع (Payment Aggregation). يُقرّ المشترك بعلمه وفهمه التام بأن منصة نيوماكسيو <strong>ليست بنكاً ولا مؤسسة مالية مرخّصة</strong> ولا تقوم بمعالجة المدفوعات بشكل مباشر، وإنما تعمل حصراً بصفتها <strong>وسيط تقني</strong> يربط المشترك بمزوّد خدمة دفع طرف ثالث مرخّص ومعتمد من الجهات الرقابية المختصة في المملكة العربية السعودية.`,
    },
    {
      num: 2, title: 'مزوّد خدمة الدفع والبنية التقنية',
      body: `جميع عمليات الدفع والتحصيل والمعالجة المالية تتم حصرياً عبر مزوّد خدمة دفع طرف ثالث مرخّص من البنك المركزي السعودي (ساما) ومتوافق مع معايير أمان بيانات صناعة بطاقات الدفع (<strong>PCI DSS</strong>). إدارة نيوماكسيو هي الطرف المتعاقد مباشرةً مع مزوّد الخدمة، ويتم ربط المشتركين عبر البنية التقنية للمنصة دون الحاجة لتقديم مفاتيح API خاصة بهم.`,
    },
    {
      num: 3, title: 'الرسوم والعمولات',
      body: `يوافق المشترك على أن إدارة نيوماكسيو تحتفظ بالحق في تحديد وتعديل هيكل الرسوم المطبّقة على كل عملية دفع واردة. يتم خصم الرسوم تلقائياً من المبالغ الواردة قبل تحويل الصافي إلى حساب المشترك. تحتفظ الإدارة بحق تعديل هيكل الرسوم مع إشعار مسبق لا يقل عن <strong>خمسة عشر (15) يوم عمل</strong>.`,
      table: `
        <table class="fee-table">
          <thead><tr><th>نوع الرسم</th><th>الوصف</th><th>آلية الاحتساب</th></tr></thead>
          <tbody>
            <tr><td>رسوم المعالجة</td><td>نسبة من كل عملية دفع واردة</td><td>خصم تلقائي من المبلغ</td></tr>
            <tr><td>رسوم ثابتة</td><td>مبلغ ثابت لكل عملية</td><td>خصم تلقائي من المبلغ</td></tr>
            <tr><td>رسوم التحويل</td><td>عند طلب سحب الرصيد</td><td>خصم عند التنفيذ</td></tr>
          </tbody>
        </table>`,
    },
    {
      num: 4, title: 'تسوية المبالغ والتحويلات',
      body: `تتم تسوية المبالغ الصافية (بعد خصم الرسوم) وفقاً لجدول التحويل المحدد من قبل الإدارة. يُقرّ المشترك بأن أوقات التسوية قد تتأثر بالعطل الرسمية والإجراءات البنكية. يلتزم المشترك بتقديم بيانات حسابه البنكي (<strong>IBAN</strong>) الصحيحة، ويتحمل كامل المسؤولية عن أي تأخير ناتج عن بيانات خاطئة.`,
    },
    {
      num: 5, title: 'صحة البيانات والمستندات',
      body: `يتعهد المشترك بأن جميع البيانات والمستندات المقدّمة في هذا الطلب صحيحة ودقيقة ومحدّثة، ويتحمل كامل المسؤولية القانونية عن أي أخطاء أو معلومات مضللة. كما يلتزم بإخطار الإدارة فوراً بأي تغيير جوهري في بياناته خلال <strong>ثلاثين (30) يوماً</strong> من حدوث التغيير.`,
    },
    {
      num: 6, title: 'الامتثال التنظيمي ومكافحة غسيل الأموال',
      body: `يتعهد المشترك بالتزامه التام بجميع الأنظمة واللوائح المعمول بها في المملكة العربية السعودية، بما في ذلك على سبيل المثال لا الحصر:`,
      list: [
        'نظام مكافحة غسل الأموال ونظام مكافحة تمويل الإرهاب',
        'نظام التجارة الإلكترونية ونظام حماية المستهلك',
        'نظام حماية البيانات الشخصية (PDPL)',
        'أنظمة ولوائح البنك المركزي السعودي (ساما)',
        'معايير الهيئة الوطنية للأمن السيبراني (NCA)',
      ],
    },
    {
      num: 7, title: 'حق التعليق والإنهاء الفوري',
      body: `يحق لإدارة نيوماكسيو تعليق أو إنهاء خدمة المشترك فوراً ودون إنذار مسبق في أي من الحالات التالية:`,
      list: [
        'الاشتباه بعمليات احتيال أو غسيل أموال أو تمويل إرهاب',
        'مخالفة أي من شروط وأحكام هذه الاتفاقية',
        'تقديم معلومات أو مستندات كاذبة أو مضللة',
        'صدور أمر قضائي أو طلب من جهة رقابية مختصة',
        'وجود مخاطر تشغيلية أو أمنية تهدد سلامة المنصة أو مستخدميها',
      ],
    },
    {
      num: 8, title: 'المسؤولية القانونية والتعويض',
      body: `يتحمل المشترك كامل المسؤولية القانونية والمالية عن جميع العمليات التي تتم عبر حسابه، بما فيها عمليات الاسترداد (<strong>Chargebacks</strong>) والنزاعات المالية. تُعفى منصة نيوماكسيو من أي مسؤولية مباشرة أو غير مباشرة ناتجة عن استخدام المشترك للخدمة بما يخالف الأنظمة المعمول بها. يلتزم المشترك بتعويض المنصة عن أي خسائر أو أضرار ناتجة عن مخالفاته.`,
    },
    {
      num: 9, title: 'حماية البيانات والخصوصية',
      body: `يُقرّ المشترك بموافقته على مشاركة بياناته الشخصية والتجارية مع مزوّد خدمة الدفع لأغراض معالجة المدفوعات والتحقق من الهوية والامتثال التنظيمي، وفقاً لأحكام <strong>نظام حماية البيانات الشخصية (PDPL)</strong> المعمول به في المملكة العربية السعودية. تلتزم الإدارة بتطبيق أعلى معايير الأمان والتشفير لحماية بيانات المشتركين.`,
    },
    {
      num: 10, title: 'تعديل الشروط والأحكام',
      body: `يحق لإدارة نيوماكسيو تعديل شروط وأحكام هذه الاتفاقية في أي وقت مع إخطار المشترك مسبقاً بمدة لا تقل عن <strong>خمسة عشر (15) يوم عمل</strong>. يُعتبر استمرار المشترك في استخدام الخدمة بعد سريان التعديلات موافقة ضمنية عليها. في حال عدم موافقة المشترك، يحق له إنهاء الاتفاقية وطلب تسوية المبالغ المستحقة.`,
    },
    {
      num: 11, title: 'القانون الواجب التطبيق والاختصاص القضائي',
      body: `يخضع هذا العقد في تفسيره وتنفيذه لأنظمة ولوائح المملكة العربية السعودية. في حال نشوء أي نزاع بين الطرفين، يتم حله ودياً خلال <strong>ثلاثين (30) يوماً</strong>. وفي حال تعذر ذلك، يُحال النزاع للجهة القضائية المختصة في مدينة الرياض بالمملكة العربية السعودية.`,
    },
    {
      num: 12, title: 'الإقرار والتعهد النهائي',
      body: `بتوقيعه على هذا العقد إلكترونياً، يُقرّ المشترك بأنه قد قرأ وفهم جميع بنود وشروط هذه الاتفاقية بالكامل، وأنه يوافق عليها طوعاً ودون أي إكراه. كما يُقرّ بأهليته القانونية الكاملة لإبرام هذا العقد نيابةً عن المنشأة المذكورة أعلاه.`,
    },
  ];

  const articlesHtml = articles.map(a => {
    const icon = ARTICLE_ICONS[a.num] || ICONS.fileCheck;
    const listHtml = a.list ? `<ul class="article-list">${a.list.map(l => `<li>${l}</li>`).join('')}</ul>` : '';
    const tableHtml = (a as any).table || '';
    return `
      <div class="article no-break">
        <div class="article-header">
          <div class="article-icon">${icon}</div>
          <div class="article-num-badge">${a.num}</div>
          <div class="article-title">${a.title}</div>
        </div>
        <div class="article-body">${a.body}${listHtml}${tableHtml}</div>
      </div>`;
  }).join('');

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
    font-size: 12px;
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
    @keyframes none {}
  }
  @media screen {
    body { padding: 0; background: #f1f5f9; }
    .page {
      max-width: 210mm;
      margin: 20px auto;
      background: white;
      box-shadow: 0 8px 40px rgba(0,0,0,0.12);
      border-radius: 6px;
    }
    .article { animation: fadeSlideIn 0.4s ease-out backwards; }
    .article:nth-child(1) { animation-delay: 0.05s; }
    .article:nth-child(2) { animation-delay: 0.1s; }
    .article:nth-child(3) { animation-delay: 0.15s; }
    .article:nth-child(4) { animation-delay: 0.2s; }
    .article:nth-child(5) { animation-delay: 0.25s; }
    .article:nth-child(6) { animation-delay: 0.3s; }
    .article:nth-child(7) { animation-delay: 0.35s; }
    .article:nth-child(8) { animation-delay: 0.4s; }
    .article:nth-child(9) { animation-delay: 0.45s; }
    .article:nth-child(10) { animation-delay: 0.5s; }
    .article:nth-child(11) { animation-delay: 0.55s; }
    .article:nth-child(12) { animation-delay: 0.6s; }
    .info-card { animation: fadeSlideIn 0.5s ease-out backwards; }
    .info-card:nth-child(1) { animation-delay: 0.1s; }
    .info-card:nth-child(2) { animation-delay: 0.2s; }
  }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  .page { padding: 0; position: relative; min-height: 297mm; overflow: hidden; }
  .page-content { padding: 0 36px 50px 36px; }

  /* ===== HEADER ===== */
  .header {
    background: linear-gradient(135deg, #0c1222 0%, #162036 50%, #1a2744 100%);
    padding: 24px 36px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    overflow: hidden;
  }
  .header::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -20%;
    width: 60%;
    height: 200%;
    background: radial-gradient(ellipse, rgba(20,184,166,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #14b8a6, #0ea5e9, #14b8a6);
  }
  .header-right { display: flex; align-items: center; gap: 14px; z-index: 1; }
  .header-logo {
    width: 50px; height: 50px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
    backdrop-filter: blur(8px);
  }
  .header-logo img { width: 42px; height: 42px; object-fit: contain; }
  .header-brand h1 {
    color: white;
    font-size: 21px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }
  .header-brand p {
    color: #7dd3c8;
    font-size: 10.5px;
    margin-top: 2px;
    font-weight: 500;
  }
  .header-left { text-align: left; direction: ltr; z-index: 1; }
  .header-left .contract-num {
    color: #5eead4;
    font-size: 13px;
    font-weight: 700;
    font-family: 'Inter', monospace;
    letter-spacing: 1px;
    background: rgba(20,184,166,0.12);
    padding: 4px 12px;
    border-radius: 6px;
    border: 1px solid rgba(20,184,166,0.2);
    display: inline-block;
    margin-bottom: 4px;
  }
  .header-left p {
    color: #94a3b8;
    font-size: 9.5px;
    font-family: 'Inter', sans-serif;
  }

  /* ===== TITLE BAR ===== */
  .title-bar {
    text-align: center;
    padding: 22px 0 18px;
    margin-bottom: 20px;
    position: relative;
  }
  .title-bar::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 15%;
    right: 15%;
    height: 1px;
    background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
  }
  .title-bar h2 {
    font-size: 17px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 6px;
  }
  .title-bar .subtitle {
    font-size: 10.5px;
    color: #64748b;
    line-height: 1.6;
  }
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 18px;
    border-radius: 24px;
    font-size: 11px;
    font-weight: 700;
    margin-top: 10px;
    border: 1.5px solid;
  }
  .dates-row {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin-top: 10px;
    font-size: 10px;
    color: #94a3b8;
  }
  .dates-row span { display: flex; align-items: center; gap: 4px; }

  /* ===== INFO CARDS ===== */
  .info-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
  .info-card {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
  }
  .info-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    font-size: 12.5px;
    font-weight: 700;
    color: white;
  }
  .info-card-header.platform { background: linear-gradient(135deg, #0f172a, #1e293b); }
  .info-card-header.subscriber { background: linear-gradient(135deg, #0d4a42, #14705e); }
  .info-card-header svg { color: #5eead4; }
  .info-card-body { padding: 14px 16px; }
  .info-table { width: 100%; border-collapse: collapse; }
  .info-table td {
    padding: 6px 0;
    font-size: 11px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: top;
  }
  .info-table tr:last-child td { border-bottom: none; }
  .info-table .label-cell {
    color: #94a3b8;
    font-weight: 500;
    width: 35%;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .info-table .value-cell {
    color: #1e293b;
    font-weight: 600;
    font-size: 11.5px;
  }
  .info-table .value-cell.en {
    font-family: 'Inter', monospace;
    direction: ltr;
    text-align: right;
    unicode-bidi: embed;
    letter-spacing: 0.5px;
    font-size: 11px;
  }

  /* ===== ARTICLES ===== */
  .articles-section { margin-top: 8px; }
  .article {
    margin-bottom: 14px;
    page-break-inside: avoid;
    border: 1px solid #f1f5f9;
    border-radius: 10px;
    overflow: hidden;
    transition: box-shadow 0.2s;
  }
  .article:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
  .article-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: #f8fafc;
    border-bottom: 1px solid #f1f5f9;
  }
  .article-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px; height: 32px;
    background: linear-gradient(135deg, #0f172a, #1e293b);
    border-radius: 8px;
    color: #5eead4;
    flex-shrink: 0;
  }
  .article-num-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px; height: 22px;
    background: linear-gradient(135deg, #14b8a6, #0d9488);
    color: white;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 800;
    flex-shrink: 0;
    padding: 0 4px;
  }
  .article-title {
    font-size: 12.5px;
    font-weight: 700;
    color: #0f172a;
    flex: 1;
  }
  .article-body {
    font-size: 11.5px;
    line-height: 2;
    color: #334155;
    padding: 12px 16px;
    text-align: justify;
  }
  .article-body strong {
    color: #0f172a;
    font-weight: 700;
  }
  .article-list {
    list-style: none;
    padding: 8px 0 0 0;
    margin: 0;
  }
  .article-list li {
    position: relative;
    padding-right: 22px;
    padding-top: 3px;
    padding-bottom: 3px;
    font-size: 11px;
    line-height: 1.8;
    color: #475569;
  }
  .article-list li::before {
    content: '';
    position: absolute;
    right: 4px;
    top: 11px;
    width: 8px; height: 8px;
    background: linear-gradient(135deg, #14b8a6, #0d9488);
    border-radius: 3px;
    transform: rotate(45deg);
  }

  /* ===== FEE TABLE ===== */
  .fee-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin-top: 12px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
  }
  .fee-table th {
    background: linear-gradient(135deg, #0f172a, #1e293b);
    color: #e2e8f0;
    padding: 8px 14px;
    font-size: 10px;
    font-weight: 600;
    text-align: right;
    letter-spacing: 0.3px;
  }
  .fee-table td {
    padding: 8px 14px;
    font-size: 10.5px;
    border-bottom: 1px solid #f1f5f9;
    color: #475569;
    background: #fafbfc;
  }
  .fee-table tr:last-child td { border-bottom: none; }
  .fee-table tbody tr:hover td { background: #f1f5f9; }

  /* ===== LEGAL NOTICE ===== */
  .legal-notice {
    background: linear-gradient(135deg, #fffbeb, #fef3c7);
    border: 1px solid #fbbf24;
    border-right: 4px solid #f59e0b;
    border-radius: 8px;
    padding: 14px 18px;
    margin: 20px 0;
    font-size: 10.5px;
    color: #92400e;
    line-height: 1.9;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .legal-notice-icon {
    flex-shrink: 0;
    width: 28px; height: 28px;
    background: #f59e0b;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: white;
    margin-top: 2px;
  }

  /* ===== SIGNATURE ===== */
  .signature-section {
    margin-top: 24px;
    page-break-inside: avoid;
  }
  .sig-title {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sig-title-icon {
    width: 28px; height: 28px;
    background: linear-gradient(135deg, #0f172a, #1e293b);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    color: #5eead4;
  }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .sig-box {
    border: 1.5px solid #e2e8f0;
    border-radius: 12px;
    padding: 18px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .sig-box::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
  }
  .sig-box.subscriber::before { background: linear-gradient(90deg, #14b8a6, #0ea5e9); }
  .sig-box.admin::before { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
  .sig-box-label {
    font-size: 9px;
    color: #94a3b8;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .sig-box-title {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 2px;
  }
  .sig-box-name {
    font-size: 11px;
    color: #64748b;
    margin-bottom: 8px;
  }
  .sig-date-row {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 10px;
  }
  .sig-date {
    font-size: 9px;
    color: #94a3b8;
    background: #f8fafc;
    padding: 3px 10px;
    border-radius: 12px;
  }
  .approved-stamp {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #059669;
    font-weight: 800;
    font-size: 15px;
    padding: 8px 20px;
    border: 2.5px solid #059669;
    border-radius: 10px;
    background: rgba(5,150,105,0.05);
    margin-top: 8px;
  }

  /* ===== FOOTER ===== */
  .footer {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    background: linear-gradient(135deg, #0f172a, #1e293b);
    padding: 12px 36px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8.5px;
    color: #64748b;
  }
  .footer-brand {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: #94a3b8;
  }
  .footer-brand svg { color: #14b8a6; }
  .footer-links {
    display: flex;
    gap: 12px;
    font-family: 'Inter', sans-serif;
    color: #64748b;
    font-size: 8px;
  }

  /* ===== WATERMARK ===== */
  .watermark {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 72px;
    font-weight: 800;
    color: rgba(20,184,166,0.025);
    pointer-events: none;
    white-space: nowrap;
    z-index: 0;
    letter-spacing: 8px;
  }

  /* ===== DECORATIVE ===== */
  .corner-decoration {
    position: absolute;
    width: 120px; height: 120px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(20,184,166,0.04) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
  .corner-tl { top: -40px; right: -40px; }
  .corner-br { bottom: 60px; left: -40px; }
</style>
</head>
<body>

<!-- Page 1 -->
<div class="page">
  <div class="watermark">NUMAXIO</div>
  <div class="corner-decoration corner-tl"></div>
  <div class="corner-decoration corner-br"></div>

  <!-- Header -->
  <div class="header">
    <div class="header-right">
      <div class="header-logo">
        <img src="${NUMAXIO_LOGO_URL}" alt="Numaxio" onerror="this.parentElement.innerHTML='<span style=\\'color:#5eead4;font-size:22px;font-weight:800;\\'>N</span>'" />
      </div>
      <div class="header-brand">
        <h1>نيوماكسيو باي</h1>
        <p>خدمة الوساطة التقنية</p>
      </div>
    </div>
    <div class="header-left">
      <div class="contract-num">${data.contractNumber}</div>
      <p>Numaxio Pay — Service Agreement</p>
    </div>
  </div>

  <div class="page-content">
    <!-- Title -->
    <div class="title-bar">
      <h2>عقد خدمة الوساطة التقنية — نيوماكسيو باي</h2>
      <p class="subtitle">إقرار وتعهد بالموافقة على شروط وأحكام خدمة الوساطة التقنية • صادر وفقاً لأنظمة المملكة العربية السعودية</p>
      <div class="status-pill" style="background: ${statusColor}08; color: ${statusColor}; border-color: ${statusColor}40;">
        ${statusIcon}
        ${statusLabel}
      </div>
      <div class="dates-row">
        <span>📅 التاريخ الهجري: ${signDate}</span>
        <span>📅 التاريخ الميلادي: ${gregorianDate}</span>
      </div>
    </div>

    <!-- Info Cards -->
    <div class="info-cards">
      <!-- Platform Info -->
      <div class="info-card">
        <div class="info-card-header platform">
          ${ICONS.building}
          الطرف الأول — المنصة
        </div>
        <div class="info-card-body">
          <table class="info-table">
            <tr><td class="label-cell">اسم المنصة</td><td class="value-cell">منصة نيوماكسيو</td></tr>
            <tr><td class="label-cell">الموقع الإلكتروني</td><td class="value-cell en">numaxio.com</td></tr>
            <tr><td class="label-cell">طبيعة العمل</td><td class="value-cell">وسيط تقني</td></tr>
            <tr><td class="label-cell">الدولة</td><td class="value-cell">المملكة العربية السعودية 🇸🇦</td></tr>
          </table>
        </div>
      </div>

      <!-- Subscriber Info -->
      <div class="info-card">
        <div class="info-card-header subscriber">
          ${ICONS.user}
          الطرف الثاني — المشترك
        </div>
        <div class="info-card-body">
          <table class="info-table">
            <tr><td class="label-cell">الاسم التجاري</td><td class="value-cell">${data.businessName}</td></tr>
            <tr><td class="label-cell">نوع المنشأة</td><td class="value-cell">${applicantTypeLabel}</td></tr>
            ${data.crNumber ? `<tr><td class="label-cell">السجل التجاري</td><td class="value-cell en">${data.crNumber}</td></tr>` : ''}
            ${data.vatNumber ? `<tr><td class="label-cell">الرقم الضريبي</td><td class="value-cell en">${data.vatNumber}</td></tr>` : ''}
            ${data.nationalId ? `<tr><td class="label-cell">رقم الهوية</td><td class="value-cell en">${data.nationalId}</td></tr>` : ''}
            <tr><td class="label-cell">المفوّض</td><td class="value-cell">${data.subscriberFullName}</td></tr>
            <tr><td class="label-cell">البريد</td><td class="value-cell en">${data.email}</td></tr>
            <tr><td class="label-cell">الجوال</td><td class="value-cell en">${data.phone}</td></tr>
            <tr><td class="label-cell">IBAN</td><td class="value-cell en">${data.iban}</td></tr>
            ${data.bankName ? `<tr><td class="label-cell">البنك</td><td class="value-cell">${data.bankName}</td></tr>` : ''}
          </table>
        </div>
      </div>
    </div>

    <!-- Articles -->
    <div class="articles-section">
      ${articlesHtml}
    </div>

    <!-- Legal Notice -->
    <div class="legal-notice no-break">
      <div class="legal-notice-icon">${ICONS.scale}</div>
      <div>
        <strong>ملاحظة قانونية هامة:</strong> هذا الإقرار يُعدّ عقداً إلكترونياً ملزماً وفقاً لأحكام نظام التعاملات الإلكترونية الصادر بالمرسوم الملكي رقم (م/18) وتاريخ 8/3/1428هـ. يخضع هذا العقد في تفسيره وتنفيذه وجميع ما ينشأ عنه من نزاعات للقضاء السعودي المختص في مدينة الرياض. منصة نيوماكسيو تعمل بصفتها <strong>وسيط تقني فقط</strong> ولا تتحمل أي مسؤولية مالية مباشرة عن عمليات الدفع.
      </div>
    </div>

    <!-- Signature Section -->
    <div class="signature-section no-break">
      <div class="sig-title">
        <div class="sig-title-icon">${ICONS.pen}</div>
        التوقيعات والاعتماد
      </div>
      <div class="sig-grid">
        <div class="sig-box subscriber">
          <div class="sig-box-label">الطرف الثاني</div>
          <div class="sig-box-title">توقيع المشترك</div>
          <div class="sig-box-name">${data.subscriberFullName}</div>
          ${signatureHtml}
          <div class="sig-date-row">
            <span class="sig-date">${signDate}</span>
            <span class="sig-date">${gregorianDate}</span>
          </div>
        </div>

        <div class="sig-box admin">
          <div class="sig-box-label">الطرف الأول</div>
          <div class="sig-box-title">إدارة نيوماكسيو</div>
          <div class="sig-box-name">منصة نيوماكسيو — الإدارة التنفيذية</div>
          <div style="min-height:60px; display:flex; align-items:center; justify-content:center; margin-top:8px;">
            ${data.status === 'approved' 
              ? `<div class="approved-stamp">${ICONS.stamp} مُعتمد رسمياً</div>` 
              : '<span style="color:#94a3b8; font-size:11px;">في انتظار الاعتماد</span>'}
          </div>
          <div class="sig-date-row">
            <span class="sig-date">${data.status === 'approved' ? signDate : '___________'}</span>
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-brand">
      ${ICONS.shield}
      نيوماكسيو — وسيط تقني متكامل
    </div>
    <div class="footer-links">
      <span>${data.contractNumber}</span>
      <span>|</span>
      <span>${gregorianDate}</span>
      <span>|</span>
      <span>numaxio.com</span>
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
