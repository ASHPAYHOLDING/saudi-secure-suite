// Arabic number formatting utilities
// Re-exports fmtCurrency/fmtNumber/fmtDate from formatters for backward compat
import { fmtCurrency, fmtNumber, fmtDate, fmtDateShort } from "@/lib/formatters";

/** Currency symbol map for common currencies */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  SAR: 'ر.س', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ',
  KWD: 'د.ك', BHD: 'د.ب', QAR: 'ر.ق', OMR: 'ر.ع',
  EGP: 'ج.م', JOD: 'د.أ', TRY: '₺', INR: '₹', CNY: '¥',
};

export const getCurrencySymbol = (code: string): string =>
  CURRENCY_SYMBOLS[code] || code;

/**
 * Format currency number only (no symbol): ١٬٢٣٤٫٥٦
 * For display with symbol use fmtCurrency from @/lib/formatters
 */
export const formatCurrency = (amount: number, _currencyCode?: string): string => {
  return fmtCurrency(amount, { symbolOnly: true });
};

export const formatCurrencyWithSymbol = (amount: number, currencyCode: string = 'SAR'): string => {
  return fmtCurrency(amount, { currency: currencyCode });
};

export const formatNumber = (num: number, decimals = 0): string => {
  return fmtNumber(num, decimals);
};

export const formatDateAr = (date: string | Date): string => {
  return fmtDate(date);
};

export { fmtDateShort as formatDateShort };

export const generateInvoiceNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `INV-${year}${month}-${random}`;
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    draft: 'مسودة',
    pending_approval: 'قيد الموافقة',
    issued: 'صادرة',
    sent: 'مُرسلة',
    partially_paid: 'مدفوعة جزئياً',
    paid: 'مدفوعة',
    overdue: 'متأخرة',
    cancelled: 'ملغاة',
  };
  return labels[status] || status;
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    pending_approval: 'bg-amber-100 text-amber-800',
    issued: 'bg-info/10 text-info',
    sent: 'bg-info/10 text-info',
    partially_paid: 'bg-warning/10 text-warning',
    paid: 'bg-success/10 text-success',
    overdue: 'bg-destructive/10 text-destructive',
    cancelled: 'bg-muted text-muted-foreground',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
};

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  vat_rate: number;
  vat_amount: number;
  line_total: number;
}

export const calculateItemTotals = (item: Partial<InvoiceItem>): { vat_amount: number; line_total: number } => {
  const qty = item.quantity || 0;
  const price = item.unit_price || 0;
  const discount = item.discount || 0;
  const vatRate = item.vat_rate ?? 15;

  const subtotal = qty * price - discount;
  const vat_amount = subtotal * (vatRate / 100);
  const line_total = subtotal + vat_amount;

  return { vat_amount: Math.round(vat_amount * 100) / 100, line_total: Math.round(line_total * 100) / 100 };
};

export const calculateInvoiceTotals = (items: InvoiceItem[]) => {
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const discount_total = items.reduce((sum, item) => sum + item.discount, 0);
  const vat_total = items.reduce((sum, item) => sum + item.vat_amount, 0);
  const grand_total = subtotal - discount_total + vat_total;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount_total: Math.round(discount_total * 100) / 100,
    vat_total: Math.round(vat_total * 100) / 100,
    grand_total: Math.round(grand_total * 100) / 100,
  };
};
