import { FEATURE_KEYS, type FeatureKey } from "@/hooks/useEntitlements";

/**
 * Maps dashboard route segments to their required feature_key.
 * Routes not in this map are always accessible (no entitlement check).
 * This is the single source of truth for route → feature mapping.
 */
export const ROUTE_FEATURE_MAP: Record<string, { featureKey: FeatureKey; label: string; description: string }> = {
  customers: {
    featureKey: FEATURE_KEYS.CUSTOMERS,
    label: "إدارة العملاء",
    description: "إدارة بيانات العملاء وسجلاتهم التجارية.",
  },
  billing: {
    featureKey: FEATURE_KEYS.INVOICES_BASIC,
    label: "الفواتير",
    description: "إنشاء وإدارة الفواتير الضريبية والمبسطة.",
  },
  invoices: {
    featureKey: FEATURE_KEYS.INVOICES_BASIC,
    label: "الفواتير",
    description: "إنشاء وإدارة الفواتير الضريبية والمبسطة.",
  },
  "credit-notes": {
    featureKey: FEATURE_KEYS.INVOICES_BASIC,
    label: "إشعارات الائتمان",
    description: "إنشاء وإدارة إشعارات الائتمان والمرتجعات.",
  },
  quotations: {
    featureKey: FEATURE_KEYS.QUOTATIONS,
    label: "عروض الأسعار",
    description: "إنشاء وإرسال عروض الأسعار للعملاء.",
  },
  "sales-orders": {
    featureKey: FEATURE_KEYS.SALES_ORDERS,
    label: "أوامر البيع",
    description: "إدارة أوامر البيع وتتبع حالة التنفيذ.",
  },
  contracts: {
    featureKey: FEATURE_KEYS.CONTRACTS,
    label: "العقود",
    description: "إنشاء وإدارة العقود والتوقيع الإلكتروني.",
  },
  "purchase-orders": {
    featureKey: FEATURE_KEYS.PURCHASE_ORDERS,
    label: "أوامر الشراء",
    description: "إدارة طلبات الشراء من الموردين.",
  },
  "delivery-notes": {
    featureKey: FEATURE_KEYS.DELIVERY_NOTES,
    label: "سندات التسليم",
    description: "إنشاء وتتبع سندات التسليم والاستلام.",
  },
  "supplier-inbox": {
    featureKey: FEATURE_KEYS.PURCHASE_ORDERS,
    label: "صندوق الموردين",
    description: "استقبال ومعالجة فواتير الموردين.",
  },
  inventory: {
    featureKey: FEATURE_KEYS.INVENTORY,
    label: "المخزون",
    description: "إدارة المنتجات وحركة المخزون والتنبيهات.",
  },
  expenses: {
    featureKey: FEATURE_KEYS.EXPENSES,
    label: "المصروفات",
    description: "تسجيل وتتبع المصروفات والإيصالات.",
  },
  "journal-entries": {
    featureKey: FEATURE_KEYS.JOURNAL_ENTRIES,
    label: "القيود اليومية",
    description: "تسجيل القيود المحاسبية المتقدمة.",
  },
  "payment-reminders": {
    featureKey: FEATURE_KEYS.PAYMENT_REMINDERS,
    label: "تذكيرات الدفع",
    description: "إرسال تذكيرات تلقائية للعملاء بالمبالغ المستحقة.",
  },
  "vat-return": {
    featureKey: FEATURE_KEYS.ACCOUNTING_ADVANCED,
    label: "إقرار ضريبة القيمة المضافة",
    description: "إعداد وتصدير إقرارات ضريبة القيمة المضافة.",
  },
  wallet: {
    featureKey: FEATURE_KEYS.WALLET,
    label: "المحفظة الرقمية",
    description: "إدارة الرصيد والمعاملات المالية.",
  },
  "numaxio-pay": {
    featureKey: FEATURE_KEYS.NUMAXIO_PAY,
    label: "نيوماكسيو باي",
    description: "بوابة الدفع الإلكتروني وإدارة المدفوعات.",
  },
  reports: {
    featureKey: FEATURE_KEYS.ADVANCED_REPORTS,
    label: "التقارير المالية",
    description: "التقارير المتقدمة: ميزان المراجعة، قائمة الدخل، الميزانية.",
  },
  analytics: {
    featureKey: FEATURE_KEYS.ANALYTICS,
    label: "التحليلات",
    description: "لوحات تحليلية متقدمة وإحصائيات الأداء.",
  },
  "smart-query": {
    featureKey: FEATURE_KEYS.ANALYTICS,
    label: "الاستعلام الذكي",
    description: "استعلامات ذكية بالذكاء الاصطناعي على بياناتك.",
  },
  team: {
    featureKey: FEATURE_KEYS.TEAM_MANAGEMENT,
    label: "إدارة الفريق",
    description: "إدارة أعضاء الفريق وتعيين الأدوار.",
  },
  "paid-integrations": {
    featureKey: FEATURE_KEYS.PAID_INTEGRATIONS,
    label: "التكاملات المدفوعة",
    description: "الربط مع خدمات خارجية متقدمة.",
  },
  branches: {
    featureKey: FEATURE_KEYS.BRANCHES,
    label: "إدارة الفروع",
    description: "إدارة فروع المنشأة المتعددة.",
  },
  branding: {
    featureKey: FEATURE_KEYS.BRANDING,
    label: "الهوية البصرية",
    description: "تخصيص الألوان والشعار والعلامة التجارية.",
  },
  compliance: {
    featureKey: FEATURE_KEYS.ZATCA_PHASE1,
    label: "الامتثال الضريبي",
    description: "إعدادات الامتثال لمتطلبات هيئة الزكاة والدخل.",
  },
  stamp: {
    featureKey: FEATURE_KEYS.STAMP,
    label: "الختم الرقمي",
    description: "إنشاء وإدارة الختم الرقمي للمنشأة.",
  },
  audit: {
    featureKey: FEATURE_KEYS.AUDIT_LOG,
    label: "سجل المراجعة",
    description: "تتبع جميع العمليات والتغييرات في النظام.",
  },
  permissions: {
    featureKey: FEATURE_KEYS.TEAM_MANAGEMENT,
    label: "إدارة الصلاحيات",
    description: "تعيين وتعديل صلاحيات المستخدمين والأدوار.",
  },
};

/**
 * Maps sidebar nav items to their feature_key.
 * Used by DashboardSidebar to show lock icons on gated features.
 */
export const NAV_PATH_TO_FEATURE: Record<string, FeatureKey> = Object.fromEntries(
  Object.entries(ROUTE_FEATURE_MAP).map(([segment, config]) => [
    `/dashboard/${segment}`,
    config.featureKey,
  ])
);
