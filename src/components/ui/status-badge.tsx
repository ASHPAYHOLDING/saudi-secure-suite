import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Unified StatusBadge — single source of truth for document/entity statuses.
 * Covers invoices, purchases, expenses, contracts, quotations, journal entries,
 * leave requests, subscriptions, delivery notes, etc.
 *
 * Usage:
 *   <StatusBadge status="paid" />
 *   <StatusBadge status="overdue" size="lg" />
 *   <StatusBadge status="draft" pulse />
 */

/* ── Status → visual config mapping ───────────────────────────── */
export type StatusKey =
  | "draft"
  | "pending"
  | "pending_approval"
  | "sent"
  | "issued"
  | "approved"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "rejected"
  | "voided"
  | "converted"
  | "posted"
  | "active"
  | "inactive"
  | "expired"
  | "trial"
  | "past_due"
  | "delivered"
  | "returned"
  | "closed"
  | "open"
  | "in_progress"
  | "completed"
  | "refunded"
  | "suspended"
  | (string & {}); // allow arbitrary strings as fallback

interface StatusConfig {
  labelAr: string;
  labelEn: string;
  /** Tailwind classes — uses semantic tokens / design-system palette */
  className: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  // ── Neutral / Initial ──
  draft:            { labelAr: "مسودة",          labelEn: "Draft",            className: "bg-muted text-muted-foreground border-border" },
  inactive:         { labelAr: "غير نشط",        labelEn: "Inactive",         className: "bg-muted text-muted-foreground border-border" },

  // ── Pending / Waiting ──
  pending:          { labelAr: "قيد الانتظار",    labelEn: "Pending",          className: "bg-warning/10 text-warning border-warning/20" },
  pending_approval: { labelAr: "قيد الموافقة",    labelEn: "Pending Approval", className: "bg-warning/10 text-warning border-warning/20" },
  in_progress:      { labelAr: "قيد التنفيذ",     labelEn: "In Progress",      className: "bg-warning/10 text-warning border-warning/20" },
  trial:            { labelAr: "تجريبي",          labelEn: "Trial",            className: "bg-warning/10 text-warning border-warning/20" },
  open:             { labelAr: "مفتوح",           labelEn: "Open",             className: "bg-warning/10 text-warning border-warning/20" },

  // ── Info / Sent ──
  sent:             { labelAr: "مُرسل",           labelEn: "Sent",             className: "bg-info/10 text-info border-info/20" },
  issued:           { labelAr: "صادرة",           labelEn: "Issued",           className: "bg-info/10 text-info border-info/20" },
  delivered:        { labelAr: "تم التسليم",      labelEn: "Delivered",        className: "bg-info/10 text-info border-info/20" },

  // ── Success / Positive ──
  paid:             { labelAr: "مدفوعة",          labelEn: "Paid",             className: "bg-success/10 text-success border-success/20" },
  approved:         { labelAr: "موافق عليه",      labelEn: "Approved",         className: "bg-success/10 text-success border-success/20" },
  posted:           { labelAr: "مرحّل",           labelEn: "Posted",           className: "bg-success/10 text-success border-success/20" },
  active:           { labelAr: "نشط",             labelEn: "Active",           className: "bg-success/10 text-success border-success/20" },
  completed:        { labelAr: "مكتمل",           labelEn: "Completed",        className: "bg-success/10 text-success border-success/20" },
  converted:        { labelAr: "تم التحويل",      labelEn: "Converted",        className: "bg-success/10 text-success border-success/20" },
  closed:           { labelAr: "مغلق",            labelEn: "Closed",           className: "bg-success/10 text-success border-success/20" },

  // ── Partial ──
  partially_paid:   { labelAr: "مدفوعة جزئياً",   labelEn: "Partially Paid",   className: "bg-accent/10 text-accent-foreground border-accent/20" },
  refunded:         { labelAr: "مُسترد",          labelEn: "Refunded",         className: "bg-accent/10 text-accent-foreground border-accent/20" },

  // ── Danger / Negative ──
  overdue:          { labelAr: "متأخرة",          labelEn: "Overdue",          className: "bg-destructive/10 text-destructive border-destructive/20" },
  cancelled:        { labelAr: "ملغاة",           labelEn: "Cancelled",        className: "bg-destructive/10 text-destructive border-destructive/20" },
  rejected:         { labelAr: "مرفوض",           labelEn: "Rejected",         className: "bg-destructive/10 text-destructive border-destructive/20" },
  voided:           { labelAr: "مُلغى",           labelEn: "Voided",           className: "bg-destructive/10 text-destructive border-destructive/20" },
  expired:          { labelAr: "منتهي",           labelEn: "Expired",          className: "bg-destructive/10 text-destructive border-destructive/20" },
  past_due:         { labelAr: "فترة سماح",       labelEn: "Past Due",         className: "bg-destructive/10 text-destructive border-destructive/20" },
  suspended:        { labelAr: "معلّق",           labelEn: "Suspended",        className: "bg-destructive/10 text-destructive border-destructive/20" },
  returned:         { labelAr: "مُرتجع",          labelEn: "Returned",         className: "bg-destructive/10 text-destructive border-destructive/20" },
};

/* ── Fallback for unknown statuses ── */
const FALLBACK: StatusConfig = {
  labelAr: "",
  labelEn: "",
  className: "bg-muted text-muted-foreground border-border",
};

/* ── Size presets ── */
const SIZE = {
  sm: "text-[10px] px-2 py-0.5",
  md: "text-xs px-2.5 py-0.5",
  lg: "text-sm px-3 py-1",
} as const;

/* ── Component ── */
export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
  size?: keyof typeof SIZE;
  /** Override display label */
  label?: string;
  /** Show a pulsing dot indicator */
  pulse?: boolean;
  /** Force language: defaults to document dir */
  lang?: "ar" | "en";
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, size = "md", label, pulse, lang, className, ...props }, ref) => {
    const config = STATUS_MAP[status] ?? FALLBACK;
    const isRTL = lang ? lang === "ar" : document.documentElement.dir === "rtl";
    const displayLabel = label ?? ((isRTL ? config.labelAr : config.labelEn) || status);

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap select-none transition-colors",
          SIZE[size],
          config.className,
          className,
        )}
        {...props}
      >
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
          </span>
        )}
        {displayLabel}
      </span>
    );
  },
);

StatusBadge.displayName = "StatusBadge";

export { StatusBadge, STATUS_MAP };

/* ── Helper: get label/color for use outside JSX ── */
export const getStatusConfig = (status: string) => STATUS_MAP[status] ?? FALLBACK;
