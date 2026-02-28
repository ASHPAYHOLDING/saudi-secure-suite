/**
 * Widget registry — defines all available dashboard widgets.
 * Each widget declares its metadata, required permissions, and render component.
 */
import { lazy, type ComponentType } from "react";
import {
  CircleDollarSign, Receipt, CalendarClock, ShieldAlert,
  Banknote, TrendingUp, Users, Activity, Bell,
} from "lucide-react";

export interface WidgetSize {
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface WidgetDef {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: any;
  /** Permission key required — null = always visible */
  permissionKey: string | null;
  /** Default grid size */
  defaultSize: WidgetSize;
  /** Available sizes the user can pick */
  sizes: { label: string; w: number; h: number }[];
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  {
    id: "revenue",
    labelAr: "إجمالي الإيرادات",
    labelEn: "Total Revenue",
    icon: CircleDollarSign,
    permissionKey: "invoices.view",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    sizes: [
      { label: "صغير", w: 2, h: 2 },
      { label: "متوسط", w: 3, h: 2 },
      { label: "كبير", w: 4, h: 3 },
    ],
  },
  {
    id: "expenses",
    labelAr: "المصروفات",
    labelEn: "Expenses",
    icon: Receipt,
    permissionKey: "expenses.view",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    sizes: [
      { label: "صغير", w: 2, h: 2 },
      { label: "متوسط", w: 3, h: 2 },
      { label: "كبير", w: 4, h: 3 },
    ],
  },
  {
    id: "overdue",
    labelAr: "فواتير متأخرة",
    labelEn: "Overdue Invoices",
    icon: CalendarClock,
    permissionKey: "invoices.view",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    sizes: [
      { label: "صغير", w: 2, h: 2 },
      { label: "متوسط", w: 3, h: 2 },
    ],
  },
  {
    id: "vat",
    labelAr: "ضريبة القيمة المضافة",
    labelEn: "VAT",
    icon: ShieldAlert,
    permissionKey: "invoices.view",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    sizes: [
      { label: "صغير", w: 2, h: 2 },
      { label: "متوسط", w: 3, h: 2 },
    ],
  },
  {
    id: "collection",
    labelAr: "معدل التحصيل",
    labelEn: "Collection Rate",
    icon: TrendingUp,
    permissionKey: "invoices.view",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    sizes: [
      { label: "صغير", w: 2, h: 2 },
      { label: "متوسط", w: 3, h: 2 },
      { label: "كبير", w: 6, h: 3 },
    ],
  },
  {
    id: "payroll",
    labelAr: "الرواتب",
    labelEn: "Payroll",
    icon: Banknote,
    permissionKey: "hr.manage_payroll",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    sizes: [
      { label: "صغير", w: 2, h: 2 },
      { label: "متوسط", w: 3, h: 2 },
    ],
  },
  {
    id: "customers",
    labelAr: "العملاء",
    labelEn: "Customers",
    icon: Users,
    permissionKey: "customers.view",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    sizes: [
      { label: "صغير", w: 2, h: 2 },
      { label: "متوسط", w: 3, h: 2 },
    ],
  },
  {
    id: "alerts",
    labelAr: "التنبيهات",
    labelEn: "Alerts",
    icon: Bell,
    permissionKey: null,
    defaultSize: { w: 6, h: 2, minW: 3, minH: 2 },
    sizes: [
      { label: "متوسط", w: 4, h: 2 },
      { label: "كبير", w: 6, h: 2 },
      { label: "كامل", w: 12, h: 3 },
    ],
  },
  {
    id: "activity",
    labelAr: "آخر الأنشطة",
    labelEn: "Recent Activity",
    icon: Activity,
    permissionKey: null,
    defaultSize: { w: 6, h: 3, minW: 3, minH: 2 },
    sizes: [
      { label: "متوسط", w: 4, h: 3 },
      { label: "كبير", w: 6, h: 3 },
      { label: "كامل", w: 12, h: 4 },
    ],
  },
  {
    id: "charts",
    labelAr: "الرسوم البيانية",
    labelEn: "Charts",
    icon: TrendingUp,
    permissionKey: "invoices.view",
    defaultSize: { w: 12, h: 4, minW: 6, minH: 3 },
    sizes: [
      { label: "متوسط", w: 6, h: 3 },
      { label: "كبير", w: 12, h: 4 },
    ],
  },
];

/** Stored layout item in JSONB */
export interface LayoutItem {
  i: string; // widget id
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

/** Default layout for new users */
export function getDefaultLayout(): LayoutItem[] {
  return [
    { i: "revenue", x: 0, y: 0, w: 3, h: 2 },
    { i: "expenses", x: 3, y: 0, w: 3, h: 2 },
    { i: "overdue", x: 6, y: 0, w: 3, h: 2 },
    { i: "vat", x: 9, y: 0, w: 3, h: 2 },
    { i: "alerts", x: 0, y: 2, w: 6, h: 2 },
    { i: "collection", x: 6, y: 2, w: 3, h: 2 },
    { i: "customers", x: 9, y: 2, w: 3, h: 2 },
    { i: "charts", x: 0, y: 4, w: 12, h: 4 },
    { i: "activity", x: 0, y: 8, w: 6, h: 3 },
  ];
}
