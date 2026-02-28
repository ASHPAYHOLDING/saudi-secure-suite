/**
 * Unified formatting utilities for currency, numbers, and dates.
 * All formatters are locale-aware (ar-SA default) and produce
 * consistent output across the platform.
 */

// ─── Currency ───

const currencyFormatter = new Intl.NumberFormat("ar-SA", {
  style: "currency",
  currency: "SAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormatterCompact = new Intl.NumberFormat("ar-SA", {
  style: "currency",
  currency: "SAR",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/**
 * Format a number as SAR currency: ١٬٢٣٤٫٥٦ ر.س
 * Use `compact` for KPI cards: ١٫٢ ألف ر.س
 */
export function fmtCurrency(
  amount: number,
  opts?: { compact?: boolean; currency?: string }
): string {
  if (opts?.compact) {
    if (opts?.currency && opts.currency !== "SAR") {
      return new Intl.NumberFormat("ar-SA", {
        style: "currency",
        currency: opts.currency,
        notation: "compact",
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(amount);
    }
    return currencyFormatterCompact.format(amount);
  }
  if (opts?.currency && opts.currency !== "SAR") {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: opts.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return currencyFormatter.format(amount);
}

// ─── Numbers ───

const numberFormatter = new Intl.NumberFormat("ar-SA");

const percentFormatter = new Intl.NumberFormat("ar-SA", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** Format plain number: ١٬٢٣٤ */
export function fmtNumber(n: number, decimals?: number): string {
  if (decimals !== undefined) {
    return new Intl.NumberFormat("ar-SA", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  }
  return numberFormatter.format(n);
}

/** Format percentage: ٪٨٥٫٣ — input is a fraction (0.853) */
export function fmtPercent(n: number): string {
  return percentFormatter.format(n);
}

// ─── Dates ───

const dateLongFormatter = new Intl.DateTimeFormat("ar-SA", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const dateShortFormatter = new Intl.DateTimeFormat("ar-SA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ar-SA", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const relativeFormatter = new Intl.RelativeTimeFormat("ar-SA", {
  numeric: "auto",
});

/** Long date: ١٥ محرم ١٤٤٧ */
export function fmtDate(date: string | Date): string {
  return dateLongFormatter.format(new Date(date));
}

/** Short date: ١٤٤٧/٠١/١٥ */
export function fmtDateShort(date: string | Date): string {
  return dateShortFormatter.format(new Date(date));
}

/** Date + time: ١٥ محرم ١٤٤٧ ٠٢:٣٠ */
export function fmtDateTime(date: string | Date): string {
  return dateTimeFormatter.format(new Date(date));
}

/** Relative time: منذ ٣ أيام */
export function fmtRelativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = then - now;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffDays) < 1) {
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (Math.abs(diffHours) < 1) {
      const diffMins = Math.round(diffMs / (1000 * 60));
      return relativeFormatter.format(diffMins, "minute");
    }
    return relativeFormatter.format(diffHours, "hour");
  }
  if (Math.abs(diffDays) > 30) {
    const diffMonths = Math.round(diffDays / 30);
    return relativeFormatter.format(diffMonths, "month");
  }
  return relativeFormatter.format(diffDays, "day");
}
