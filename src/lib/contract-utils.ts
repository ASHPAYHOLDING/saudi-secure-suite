import { formatDateAr, formatCurrency } from "./invoice-utils";

export const generateContractNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const random = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `CON-${year}-${random}`;
};

export const getContractTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    employment: 'عقد عمل',
    service: 'عقد خدمات',
    payment: 'اتفاقية دفع',
  };
  return labels[type] || type;
};

export const getContractStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    draft: 'مسودة',
    active: 'ساري',
    signed: 'موقّع',
    expired: 'منتهي',
    cancelled: 'ملغى',
  };
  return labels[status] || status;
};

export const getContractStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    active: 'bg-info/10 text-info',
    signed: 'bg-success/10 text-success',
    expired: 'bg-warning/10 text-warning',
    cancelled: 'bg-destructive/10 text-destructive',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
};

interface CompanyData {
  name: string;
  cr_number: string;
  vat_number: string;
  address: string;
  phone: string;
  email: string;
}

interface ClientData {
  name: string;
  cr_number?: string;
  vat_number?: string;
  address?: string;
  phone?: string;
}

export const fillTemplate = (
  html: string,
  company: CompanyData,
  client: ClientData,
  contractData: {
    contract_number: string;
    start_date: string;
    end_date?: string;
    total_value: number;
    title: string;
  }
): string => {
  return html
    .replace(/\{\{company_name\}\}/g, company.name)
    .replace(/\{\{company_cr\}\}/g, company.cr_number)
    .replace(/\{\{company_vat\}\}/g, company.vat_number)
    .replace(/\{\{company_address\}\}/g, company.address)
    .replace(/\{\{company_phone\}\}/g, company.phone)
    .replace(/\{\{company_email\}\}/g, company.email)
    .replace(/\{\{client_name\}\}/g, client.name)
    .replace(/\{\{client_cr\}\}/g, client.cr_number || '—')
    .replace(/\{\{client_vat\}\}/g, client.vat_number || '—')
    .replace(/\{\{client_address\}\}/g, client.address || '—')
    .replace(/\{\{client_phone\}\}/g, client.phone || '—')
    .replace(/\{\{contract_number\}\}/g, contractData.contract_number)
    .replace(/\{\{contract_title\}\}/g, contractData.title)
    .replace(/\{\{start_date\}\}/g, formatDateAr(contractData.start_date))
    .replace(/\{\{end_date\}\}/g, contractData.end_date ? formatDateAr(contractData.end_date) : '—')
    .replace(/\{\{total_value\}\}/g, formatCurrency(contractData.total_value))
    .replace(/\{\{today\}\}/g, formatDateAr(new Date()));
};

// Default Saudi-compliant contract templates
export const defaultTemplates: Record<string, { name: string; body: string }> = {
  employment: {
    name: "عقد عمل",
    body: `<div style="text-align:center;margin-bottom:24px;">
<h2 style="font-size:20px;font-weight:700;">عقد عمل</h2>
<p style="font-size:12px;color:#666;">رقم العقد: {{contract_number}}</p>
</div>

<p>إنه في يوم {{today}} تم الاتفاق بين كل من:</p>

<div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
<p><strong>الطرف الأول (صاحب العمل):</strong></p>
<p>{{company_name}}</p>
<p>السجل التجاري: {{company_cr}} | الرقم الضريبي: {{company_vat}}</p>
<p>العنوان: {{company_address}}</p>
</div>

<div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
<p><strong>الطرف الثاني (الموظف):</strong></p>
<p>{{client_name}}</p>
<p>رقم الهوية / الإقامة: {{client_cr}}</p>
<p>العنوان: {{client_address}}</p>
</div>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الأول: طبيعة العمل</h3>
<p>يلتزم الطرف الثاني بالعمل لدى الطرف الأول بمسمى وظيفي: <strong>{{contract_title}}</strong></p>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الثاني: مدة العقد</h3>
<p>يبدأ هذا العقد من تاريخ {{start_date}} وينتهي بتاريخ {{end_date}}، قابل للتجديد باتفاق الطرفين وفقاً لنظام العمل السعودي.</p>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الثالث: الأجر</h3>
<p>يتقاضى الطرف الثاني أجراً شهرياً إجمالياً قدره <strong>{{total_value}} ريال سعودي</strong> يشمل البدلات المنصوص عليها في نظام العمل.</p>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الرابع: فترة التجربة</h3>
<p>يخضع الطرف الثاني لفترة تجربة مدتها تسعون (90) يوماً من تاريخ مباشرة العمل، ويحق لأي من الطرفين إنهاء العقد خلالها.</p>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الخامس: ساعات العمل</h3>
<p>يلتزم الطرف الثاني بالعمل ثمان (8) ساعات يومياً وفقاً لنظام العمل السعودي، مع مراعاة تخفيض ساعات العمل خلال شهر رمضان.</p>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند السادس: أحكام عامة</h3>
<p>يخضع هذا العقد لأحكام نظام العمل السعودي الصادر بالمرسوم الملكي رقم م/51 وتاريخ 23/08/1426هـ وتعديلاته.</p>

<div style="margin-top:40px;display:flex;justify-content:space-between;">
<div style="text-align:center;width:45%;">
<p><strong>الطرف الأول</strong></p>
<p style="margin-top:40px;border-top:1px solid #000;padding-top:8px;">التوقيع والختم</p>
</div>
<div style="text-align:center;width:45%;">
<p><strong>الطرف الثاني</strong></p>
<p style="margin-top:40px;border-top:1px solid #000;padding-top:8px;">التوقيع</p>
</div>
</div>`,
  },
  service: {
    name: "عقد خدمات",
    body: `<div style="text-align:center;margin-bottom:24px;">
<h2 style="font-size:20px;font-weight:700;">عقد تقديم خدمات</h2>
<p style="font-size:12px;color:#666;">رقم العقد: {{contract_number}}</p>
</div>

<p>إنه في يوم {{today}} تم الاتفاق بين كل من:</p>

<div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
<p><strong>الطرف الأول (مقدم الخدمة):</strong></p>
<p>{{company_name}}</p>
<p>السجل التجاري: {{company_cr}} | الرقم الضريبي: {{company_vat}}</p>
<p>العنوان: {{company_address}} | هاتف: {{company_phone}}</p>
</div>

<div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
<p><strong>الطرف الثاني (العميل):</strong></p>
<p>{{client_name}}</p>
<p>السجل التجاري: {{client_cr}} | الرقم الضريبي: {{client_vat}}</p>
<p>العنوان: {{client_address}} | هاتف: {{client_phone}}</p>
</div>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الأول: موضوع العقد</h3>
<p>يلتزم الطرف الأول بتقديم الخدمات التالية للطرف الثاني: <strong>{{contract_title}}</strong></p>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الثاني: مدة العقد</h3>
<p>يبدأ تنفيذ هذا العقد من تاريخ {{start_date}} وينتهي بتاريخ {{end_date}}.</p>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الثالث: قيمة العقد</h3>
<p>قيمة هذا العقد الإجمالية هي <strong>{{total_value}} ريال سعودي</strong> شاملة ضريبة القيمة المضافة (15٪).</p>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الرابع: شروط الدفع</h3>
<p>يتم الدفع وفقاً للجدول الزمني المتفق عليه بين الطرفين، على أن يتم السداد خلال ثلاثين (30) يوماً من تاريخ تقديم الفاتورة.</p>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الخامس: السرية</h3>
<p>يلتزم كلا الطرفين بالمحافظة على سرية المعلومات والبيانات المتبادلة بموجب هذا العقد.</p>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند السادس: فض النزاعات</h3>
<p>في حال نشوء أي خلاف يتم حله ودياً، وفي حال تعذر ذلك يُحال إلى الجهات القضائية المختصة في المملكة العربية السعودية.</p>

<div style="margin-top:40px;display:flex;justify-content:space-between;">
<div style="text-align:center;width:45%;">
<p><strong>الطرف الأول</strong></p>
<p>{{company_name}}</p>
<p style="margin-top:40px;border-top:1px solid #000;padding-top:8px;">التوقيع والختم</p>
</div>
<div style="text-align:center;width:45%;">
<p><strong>الطرف الثاني</strong></p>
<p>{{client_name}}</p>
<p style="margin-top:40px;border-top:1px solid #000;padding-top:8px;">التوقيع والختم</p>
</div>
</div>`,
  },
  payment: {
    name: "اتفاقية دفع",
    body: `<div style="text-align:center;margin-bottom:24px;">
<h2 style="font-size:20px;font-weight:700;">اتفاقية سداد</h2>
<p style="font-size:12px;color:#666;">رقم الاتفاقية: {{contract_number}}</p>
</div>

<p>إنه في يوم {{today}} تم الاتفاق بين كل من:</p>

<div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
<p><strong>الطرف الأول (الدائن):</strong> {{company_name}}</p>
<p>السجل التجاري: {{company_cr}}</p>
</div>

<div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
<p><strong>الطرف الثاني (المدين):</strong> {{client_name}}</p>
<p>السجل التجاري: {{client_cr}}</p>
</div>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الأول: المبلغ المستحق</h3>
<p>يقر الطرف الثاني بأن ذمته مشغولة للطرف الأول بمبلغ وقدره <strong>{{total_value}} ريال سعودي</strong> وذلك عن: {{contract_title}}</p>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الثاني: جدول السداد</h3>
<p>يلتزم الطرف الثاني بسداد المبلغ المذكور ابتداءً من تاريخ {{start_date}} وحتى {{end_date}}.</p>

<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الثالث: التخلف عن السداد</h3>
<p>في حال تخلف الطرف الثاني عن السداد في المواعيد المحددة، يحق للطرف الأول اتخاذ الإجراءات النظامية اللازمة.</p>

<div style="margin-top:40px;display:flex;justify-content:space-between;">
<div style="text-align:center;width:45%;">
<p><strong>الطرف الأول</strong></p>
<p style="margin-top:40px;border-top:1px solid #000;padding-top:8px;">التوقيع والختم</p>
</div>
<div style="text-align:center;width:45%;">
<p><strong>الطرف الثاني</strong></p>
<p style="margin-top:40px;border-top:1px solid #000;padding-top:8px;">التوقيع</p>
</div>
</div>`,
  },
};
