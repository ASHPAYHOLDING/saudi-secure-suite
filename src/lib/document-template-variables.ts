/**
 * Document Template Variables — defines available placeholders per document type.
 * Language-neutral: variable names are keys, displayed labels come from i18n.
 */

export interface TemplateVariable {
  key: string;
  labelAr: string;
  labelEn: string;
  category: string;
  sampleValue: string;
}

const COMMON_VARS: TemplateVariable[] = [
  { key: "{{company_name}}", labelAr: "اسم المنشأة", labelEn: "Company Name", category: "company", sampleValue: "شركة نيوماكسيو" },
  { key: "{{company_logo}}", labelAr: "شعار المنشأة", labelEn: "Company Logo", category: "company", sampleValue: "<img src='/logo.png' width='120'/>" },
  { key: "{{company_vat}}", labelAr: "الرقم الضريبي", labelEn: "VAT Number", category: "company", sampleValue: "300000000000003" },
  { key: "{{company_cr}}", labelAr: "السجل التجاري", labelEn: "CR Number", category: "company", sampleValue: "1010000000" },
  { key: "{{company_address}}", labelAr: "عنوان المنشأة", labelEn: "Company Address", category: "company", sampleValue: "الرياض، المملكة العربية السعودية" },
  { key: "{{company_phone}}", labelAr: "هاتف المنشأة", labelEn: "Company Phone", category: "company", sampleValue: "+966 50 000 0000" },
  { key: "{{company_email}}", labelAr: "بريد المنشأة", labelEn: "Company Email", category: "company", sampleValue: "info@company.sa" },
  { key: "{{branch_name}}", labelAr: "اسم الفرع", labelEn: "Branch Name", category: "company", sampleValue: "الفرع الرئيسي" },
  { key: "{{current_date}}", labelAr: "التاريخ الحالي", labelEn: "Current Date", category: "meta", sampleValue: "2026-02-21" },
  { key: "{{current_date_hijri}}", labelAr: "التاريخ الهجري", labelEn: "Hijri Date", category: "meta", sampleValue: "1447/08/23" },
  { key: "{{page_number}}", labelAr: "رقم الصفحة", labelEn: "Page Number", category: "meta", sampleValue: "1" },
  { key: "{{digital_stamp}}", labelAr: "الختم الرقمي", labelEn: "Digital Stamp", category: "meta", sampleValue: "[ختم رقمي]" },
];

const CUSTOMER_VARS: TemplateVariable[] = [
  { key: "{{customer_name}}", labelAr: "اسم العميل", labelEn: "Customer Name", category: "customer", sampleValue: "محمد أحمد" },
  { key: "{{customer_vat}}", labelAr: "رقم ضريبي العميل", labelEn: "Customer VAT", category: "customer", sampleValue: "300000000000004" },
  { key: "{{customer_address}}", labelAr: "عنوان العميل", labelEn: "Customer Address", category: "customer", sampleValue: "جدة، السعودية" },
  { key: "{{customer_phone}}", labelAr: "هاتف العميل", labelEn: "Customer Phone", category: "customer", sampleValue: "+966 55 000 0000" },
  { key: "{{customer_email}}", labelAr: "بريد العميل", labelEn: "Customer Email", category: "customer", sampleValue: "customer@example.com" },
];

const INVOICE_VARS: TemplateVariable[] = [
  { key: "{{invoice_number}}", labelAr: "رقم الفاتورة", labelEn: "Invoice Number", category: "document", sampleValue: "INV-2026-0001" },
  { key: "{{invoice_date}}", labelAr: "تاريخ الفاتورة", labelEn: "Invoice Date", category: "document", sampleValue: "2026-02-21" },
  { key: "{{due_date}}", labelAr: "تاريخ الاستحقاق", labelEn: "Due Date", category: "document", sampleValue: "2026-03-21" },
  { key: "{{subtotal}}", labelAr: "المجموع الفرعي", labelEn: "Subtotal", category: "amounts", sampleValue: "10,000.00" },
  { key: "{{vat_amount}}", labelAr: "مبلغ الضريبة", labelEn: "VAT Amount", category: "amounts", sampleValue: "1,500.00" },
  { key: "{{discount_amount}}", labelAr: "مبلغ الخصم", labelEn: "Discount", category: "amounts", sampleValue: "0.00" },
  { key: "{{total}}", labelAr: "الإجمالي", labelEn: "Total", category: "amounts", sampleValue: "11,500.00" },
  { key: "{{total_in_words}}", labelAr: "المبلغ كتابة", labelEn: "Total in Words", category: "amounts", sampleValue: "أحد عشر ألف وخمسمائة ريال" },
  { key: "{{currency}}", labelAr: "العملة", labelEn: "Currency", category: "amounts", sampleValue: "SAR" },
  { key: "{{items_table}}", labelAr: "جدول الأصناف", labelEn: "Items Table", category: "items", sampleValue: "<table><tr><th>الوصف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr><tr><td>خدمة استشارية</td><td>1</td><td>10,000</td><td>10,000</td></tr></table>" },
  { key: "{{payment_terms}}", labelAr: "شروط الدفع", labelEn: "Payment Terms", category: "document", sampleValue: "صافي 30 يوم" },
  { key: "{{notes}}", labelAr: "ملاحظات", labelEn: "Notes", category: "document", sampleValue: "" },
  { key: "{{qr_code}}", labelAr: "رمز QR", labelEn: "QR Code", category: "meta", sampleValue: "<img src='/qr.png' width='120'/>" },
];

const PO_VARS: TemplateVariable[] = [
  { key: "{{po_number}}", labelAr: "رقم أمر الشراء", labelEn: "PO Number", category: "document", sampleValue: "PO-2026-0001" },
  { key: "{{po_date}}", labelAr: "تاريخ أمر الشراء", labelEn: "PO Date", category: "document", sampleValue: "2026-02-21" },
  { key: "{{supplier_name}}", labelAr: "اسم المورد", labelEn: "Supplier Name", category: "supplier", sampleValue: "شركة التوريدات" },
  { key: "{{supplier_vat}}", labelAr: "رقم ضريبي المورد", labelEn: "Supplier VAT", category: "supplier", sampleValue: "300000000000005" },
  { key: "{{supplier_address}}", labelAr: "عنوان المورد", labelEn: "Supplier Address", category: "supplier", sampleValue: "الدمام، السعودية" },
  { key: "{{delivery_date}}", labelAr: "تاريخ التسليم", labelEn: "Delivery Date", category: "document", sampleValue: "2026-03-01" },
  { key: "{{items_table}}", labelAr: "جدول الأصناف", labelEn: "Items Table", category: "items", sampleValue: "<table><tr><th>الصنف</th><th>الكمية</th><th>السعر</th></tr></table>" },
  { key: "{{subtotal}}", labelAr: "المجموع الفرعي", labelEn: "Subtotal", category: "amounts", sampleValue: "5,000.00" },
  { key: "{{vat_amount}}", labelAr: "مبلغ الضريبة", labelEn: "VAT Amount", category: "amounts", sampleValue: "750.00" },
  { key: "{{total}}", labelAr: "الإجمالي", labelEn: "Total", category: "amounts", sampleValue: "5,750.00" },
];

const JOURNAL_VARS: TemplateVariable[] = [
  { key: "{{journal_number}}", labelAr: "رقم القيد", labelEn: "Journal Number", category: "document", sampleValue: "JE-2026-0001" },
  { key: "{{journal_date}}", labelAr: "تاريخ القيد", labelEn: "Journal Date", category: "document", sampleValue: "2026-02-21" },
  { key: "{{description}}", labelAr: "الوصف", labelEn: "Description", category: "document", sampleValue: "قيد إثبات إيرادات" },
  { key: "{{entries_table}}", labelAr: "جدول القيود", labelEn: "Entries Table", category: "items", sampleValue: "<table><tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr></table>" },
  { key: "{{total_debit}}", labelAr: "إجمالي المدين", labelEn: "Total Debit", category: "amounts", sampleValue: "10,000.00" },
  { key: "{{total_credit}}", labelAr: "إجمالي الدائن", labelEn: "Total Credit", category: "amounts", sampleValue: "10,000.00" },
  { key: "{{posted_by}}", labelAr: "مرحّل بواسطة", labelEn: "Posted By", category: "meta", sampleValue: "أحمد محمد" },
  { key: "{{approved_by}}", labelAr: "معتمد بواسطة", labelEn: "Approved By", category: "meta", sampleValue: "خالد علي" },
];

export type DocumentTemplateType = 
  | "invoice" | "credit_note" | "quotation" | "purchase_order"
  | "delivery_note" | "sales_order" | "journal_entry" | "contract" | "receipt";

export const DOCUMENT_TYPE_LABELS: Record<DocumentTemplateType, { ar: string; en: string }> = {
  invoice: { ar: "فاتورة", en: "Invoice" },
  credit_note: { ar: "إشعار دائن", en: "Credit Note" },
  quotation: { ar: "عرض سعر", en: "Quotation" },
  purchase_order: { ar: "أمر شراء", en: "Purchase Order" },
  delivery_note: { ar: "سند تسليم", en: "Delivery Note" },
  sales_order: { ar: "أمر بيع", en: "Sales Order" },
  journal_entry: { ar: "قيد يومية", en: "Journal Entry" },
  contract: { ar: "عقد", en: "Contract" },
  receipt: { ar: "سند قبض", en: "Receipt" },
};

export function getVariablesForType(type: DocumentTemplateType): TemplateVariable[] {
  const base = [...COMMON_VARS];

  switch (type) {
    case "invoice":
    case "credit_note":
    case "receipt":
      return [...base, ...CUSTOMER_VARS, ...INVOICE_VARS];
    case "quotation":
    case "sales_order":
      return [...base, ...CUSTOMER_VARS, ...INVOICE_VARS.filter(v => !["{{qr_code}}"].includes(v.key))];
    case "purchase_order":
    case "delivery_note":
      return [...base, ...PO_VARS];
    case "journal_entry":
      return [...base, ...JOURNAL_VARS];
    case "contract":
      return [...base, ...CUSTOMER_VARS];
    default:
      return base;
  }
}

/** Group variables by category */
export function groupVariables(vars: TemplateVariable[]): Record<string, TemplateVariable[]> {
  return vars.reduce((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {} as Record<string, TemplateVariable[]>);
}

export const CATEGORY_LABELS: Record<string, { ar: string; en: string }> = {
  company: { ar: "بيانات المنشأة", en: "Company Info" },
  customer: { ar: "بيانات العميل", en: "Customer Info" },
  supplier: { ar: "بيانات المورد", en: "Supplier Info" },
  document: { ar: "بيانات المستند", en: "Document Info" },
  amounts: { ar: "المبالغ", en: "Amounts" },
  items: { ar: "الأصناف", en: "Items" },
  meta: { ar: "بيانات النظام", en: "System" },
};
