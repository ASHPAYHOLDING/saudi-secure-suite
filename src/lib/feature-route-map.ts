import { FEATURE_KEYS, type FeatureKey } from "@/hooks/useEntitlements";

/**
 * ═══════════════════════════════════════════════════════════════
 *  ACCESS_MAP — Single Source of Truth
 * ═══════════════════════════════════════════════════════════════
 *
 * Maps dashboard route segments to:
 *   - featureKey:      Entitlement check (plan-level)
 *   - permissionKeys:  RBAC check (user-level, optional)
 *   - label / description: UI strings
 *
 * HOW TO ADD A NEW ROUTE:
 *   1. Add an entry here with segment, featureKey, permissionKeys, label, description.
 *   2. Add the route in dashboard-routes.tsx with gateSegment matching the segment.
 *   3. That's it — FeatureGate, RouteGuard, sidebar icons, and debug pages
 *      all read from this single map automatically.
 *
 * Routes not listed here are always accessible (no entitlement/RBAC check).
 */

export interface AccessMapEntry {
  featureKey: FeatureKey;
  /** RBAC permission keys required. Empty array = no RBAC gate. */
  permissionKeys: string[];
  label: string;
  description: string;
}

export const ROUTE_FEATURE_MAP: Record<string, AccessMapEntry> = {
  customers: {
    featureKey: FEATURE_KEYS.CUSTOMERS,
    permissionKeys: ["customers.view"],
    label: "إدارة العملاء",
    description: "إدارة بيانات العملاء وسجلاتهم التجارية.",
  },
  billing: {
    featureKey: FEATURE_KEYS.INVOICES_BASIC,
    permissionKeys: ["invoices.view"],
    label: "الفواتير",
    description: "إنشاء وإدارة الفواتير الضريبية والمبسطة.",
  },
  invoices: {
    featureKey: FEATURE_KEYS.INVOICES_BASIC,
    permissionKeys: ["invoices.view"],
    label: "الفواتير",
    description: "إنشاء وإدارة الفواتير الضريبية والمبسطة.",
  },
  "credit-notes": {
    featureKey: FEATURE_KEYS.INVOICES_BASIC,
    permissionKeys: ["invoices.view"],
    label: "إشعارات الائتمان",
    description: "إنشاء وإدارة إشعارات الائتمان والمرتجعات.",
  },
  quotations: {
    featureKey: FEATURE_KEYS.QUOTATIONS,
    permissionKeys: ["quotations.view"],
    label: "عروض الأسعار",
    description: "إنشاء وإرسال عروض الأسعار للعملاء.",
  },
  "sales-orders": {
    featureKey: FEATURE_KEYS.SALES_ORDERS,
    permissionKeys: ["sales_orders.view"],
    label: "أوامر البيع",
    description: "إدارة أوامر البيع وتتبع حالة التنفيذ.",
  },
  contracts: {
    featureKey: FEATURE_KEYS.CONTRACTS,
    permissionKeys: ["contracts.view"],
    label: "العقود",
    description: "إنشاء وإدارة العقود والتوقيع الإلكتروني.",
  },
  "purchase-orders": {
    featureKey: FEATURE_KEYS.PURCHASE_ORDERS,
    permissionKeys: ["purchase_orders.view"],
    label: "أوامر الشراء",
    description: "إدارة طلبات الشراء من الموردين.",
  },
  "delivery-notes": {
    featureKey: FEATURE_KEYS.DELIVERY_NOTES,
    permissionKeys: ["purchase_orders.view"],
    label: "سندات التسليم",
    description: "إنشاء وتتبع سندات التسليم والاستلام.",
  },
  "supplier-inbox": {
    featureKey: FEATURE_KEYS.PURCHASE_ORDERS,
    permissionKeys: ["purchase_orders.view"],
    label: "صندوق الموردين",
    description: "استقبال ومعالجة فواتير الموردين.",
  },
  inventory: {
    featureKey: FEATURE_KEYS.INVENTORY,
    permissionKeys: ["inventory.view"],
    label: "المخزون",
    description: "إدارة المنتجات وحركة المخزون والتنبيهات.",
  },
  expenses: {
    featureKey: FEATURE_KEYS.EXPENSES,
    permissionKeys: ["expenses.view"],
    label: "المصروفات",
    description: "تسجيل وتتبع المصروفات والإيصالات.",
  },
  "journal-entries": {
    featureKey: FEATURE_KEYS.JOURNAL_ENTRIES,
    permissionKeys: ["finance.view_overview"],
    label: "القيود اليومية",
    description: "تسجيل القيود المحاسبية المتقدمة.",
  },
  "payment-reminders": {
    featureKey: FEATURE_KEYS.PAYMENT_REMINDERS,
    permissionKeys: ["invoices.view"],
    label: "تذكيرات الدفع",
    description: "إرسال تذكيرات تلقائية للعملاء بالمبالغ المستحقة.",
  },
  "vat-return": {
    featureKey: FEATURE_KEYS.ACCOUNTING_ADVANCED,
    permissionKeys: ["finance.view_reports"],
    label: "إقرار ضريبة القيمة المضافة",
    description: "إعداد وتصدير إقرارات ضريبة القيمة المضافة.",
  },
  wallet: {
    featureKey: FEATURE_KEYS.WALLET,
    permissionKeys: ["subscription.view"],
    label: "المحفظة الرقمية",
    description: "إدارة الرصيد والمعاملات المالية.",
  },
  "numaxio-pay": {
    featureKey: FEATURE_KEYS.NUMAXIO_PAY,
    permissionKeys: ["subscription.manage"],
    label: "نيوماكسيو باي",
    description: "بوابة الدفع الإلكتروني وإدارة المدفوعات.",
  },
  reports: {
    featureKey: FEATURE_KEYS.ADVANCED_REPORTS,
    permissionKeys: ["finance.view_reports"],
    label: "التقارير المالية",
    description: "التقارير المتقدمة: ميزان المراجعة، قائمة الدخل، الميزانية.",
  },
  analytics: {
    featureKey: FEATURE_KEYS.ANALYTICS,
    permissionKeys: ["finance.view_analytics"],
    label: "التحليلات",
    description: "لوحات تحليلية متقدمة وإحصائيات الأداء.",
  },
  "financial-health": {
    featureKey: FEATURE_KEYS.ANALYTICS,
    permissionKeys: ["finance.view_analytics"],
    label: "الصحة المالية",
    description: "تقييم شامل للوضع المالي مع ملخص تنفيذي ذكي.",
  },
  "smart-query": {
    featureKey: FEATURE_KEYS.ANALYTICS,
    permissionKeys: ["finance.view_analytics"],
    label: "الاستعلام الذكي",
    description: "استعلامات ذكية بالذكاء الاصطناعي على بياناتك.",
  },
  team: {
    featureKey: FEATURE_KEYS.TEAM_MANAGEMENT,
    permissionKeys: ["team.view"],
    label: "إدارة الفريق",
    description: "إدارة أعضاء الفريق وتعيين الأدوار.",
  },
  branches: {
    featureKey: FEATURE_KEYS.BRANCHES,
    permissionKeys: ["branches.view"],
    label: "إدارة الفروع",
    description: "إدارة فروع المنشأة المتعددة.",
  },
  branding: {
    featureKey: FEATURE_KEYS.BRANDING,
    permissionKeys: ["settings.branding"],
    label: "الهوية البصرية",
    description: "تخصيص الألوان والشعار والعلامة التجارية.",
  },
  compliance: {
    featureKey: FEATURE_KEYS.ZATCA_PHASE1,
    permissionKeys: ["settings.compliance"],
    label: "الامتثال الضريبي",
    description: "إعدادات الامتثال لمتطلبات هيئة الزكاة والدخل.",
  },
  stamp: {
    featureKey: FEATURE_KEYS.STAMP,
    permissionKeys: ["settings.stamp"],
    label: "الختم الرقمي",
    description: "إنشاء وإدارة الختم الرقمي للمنشأة.",
  },
  audit: {
    featureKey: FEATURE_KEYS.AUDIT_LOG,
    permissionKeys: ["audit.view"],
    label: "سجل المراجعة",
    description: "تتبع جميع العمليات والتغييرات في النظام.",
  },
  permissions: {
    featureKey: FEATURE_KEYS.TEAM_MANAGEMENT,
    permissionKeys: ["team.view"],
    label: "إدارة الصلاحيات",
    description: "تعيين وتعديل صلاحيات المستخدمين والأدوار.",
  },
  budgets: {
    featureKey: FEATURE_KEYS.BUDGETS_BASIC,
    permissionKeys: ["finance.view_overview"],
    label: "الميزانيات",
    description: "إعداد وإدارة الميزانيات التقديرية ومتابعة الصرف الفعلي.",
  },
  "data-quality": {
    featureKey: FEATURE_KEYS.ACCOUNTING_ADVANCED,
    permissionKeys: ["finance.view_reports"],
    label: "مركز جودة البيانات",
    description: "التسوية والتحقق من سلامة البيانات المالية.",
  },
  approvals: {
    featureKey: FEATURE_KEYS.INVOICES_BASIC,
    permissionKeys: ["invoices.view"],
    label: "سلاسل الموافقة",
    description: "إدارة مسارات الموافقة على الفواتير والمستندات.",
  },
  finance: {
    featureKey: FEATURE_KEYS.ACCOUNTING_ADVANCED,
    permissionKeys: ["finance.view_reports"],
    label: "النظرة المالية",
    description: "لوحة ملخصة للوضع المالي والتدفقات النقدية.",
  },
  "collections-intelligence": {
    featureKey: FEATURE_KEYS.ADVANCED_REPORTS,
    permissionKeys: ["finance.view_reports"],
    label: "ذكاء التحصيل",
    description: "تحليل مخاطر العملاء وإدارة التحصيل الذكي.",
  },
  "cashflow-radar": {
    featureKey: FEATURE_KEYS.ADVANCED_REPORTS,
    permissionKeys: ["finance.view_reports"],
    label: "رادار التدفق النقدي",
    description: "توقعات السيولة والتنبيهات الذكية مع محاكاة السيناريوهات.",
  },
  "executive-intelligence": {
    featureKey: FEATURE_KEYS.ADVANCED_REPORTS,
    permissionKeys: ["finance.view_executive_board"],
    label: "لوحة الذكاء التنفيذي",
    description: "ملخص تنفيذي شامل للأداء المالي والمخاطر مع توصيات ذكية.",
  },
  "api-keys": {
    featureKey: FEATURE_KEYS.API_ACCESS,
    permissionKeys: ["settings.integrations"],
    label: "مفاتيح API",
    description: "إدارة مفاتيح الوصول البرمجي للنظام.",
  },
  integrations: {
    featureKey: FEATURE_KEYS.PAID_INTEGRATIONS,
    permissionKeys: ["settings.integrations"],
    label: "التكاملات",
    description: "ربط النظام مع بوابات الدفع والتسويق والأنظمة الخارجية.",
  },
  chat: {
    featureKey: FEATURE_KEYS.TEAM_MANAGEMENT,
    permissionKeys: ["team.view"],
    label: "المحادثات",
    description: "محادثات الفريق الداخلية والتعاون.",
  },
  group: {
    featureKey: FEATURE_KEYS.UNLIMITED_EVERYTHING,
    permissionKeys: ["settings.integrations"],
    label: "المجموعة المؤسسية",
    description: "لوحة تحكم المجموعة والشركات التابعة (باقة المؤسسات).",
  },
  enterprise: {
    featureKey: FEATURE_KEYS.ENTERPRISE_MODE,
    permissionKeys: ["company.view"],
    label: "حوكمة المؤسسة",
    description: "مركز الحوكمة والسياسات الأمنية وإدارة الجلسات.",
  },
  "governance-center": {
    featureKey: FEATURE_KEYS.ENTERPRISE_MODE,
    permissionKeys: ["company.view"],
    label: "مركز الحوكمة",
    description: "نظرة شاملة على الأمان والصلاحيات والامتثال المؤسسي.",
  },
  "compliance-score": {
    featureKey: FEATURE_KEYS.ENTERPRISE_MODE,
    permissionKeys: ["company.view"],
    label: "نقاط الامتثال",
    description: "تقييم شامل لمدى التزام المنشأة بمعايير الحوكمة والامتثال.",
  },
  "corporate-structure": {
    featureKey: FEATURE_KEYS.ENTERPRISE_MODE,
    permissionKeys: ["company.view"],
    label: "الهيكل المؤسسي",
    description: "إدارة الكيانات القانونية والفروع ومراكز التكلفة.",
  },
  coa: {
    featureKey: FEATURE_KEYS.ENTERPRISE_MODE,
    permissionKeys: ["company.view"],
    label: "شجرة الحسابات",
    description: "إدارة شجرة الحسابات المؤسسية مع الإصدارات.",
  },
  "enterprise-journal": {
    featureKey: FEATURE_KEYS.ENTERPRISE_MODE,
    permissionKeys: ["company.view"],
    label: "دفتر اليومية",
    description: "إنشاء وترحيل القيود اليومية المؤسسية.",
  },
  "enterprise-statements": {
    featureKey: FEATURE_KEYS.ENTERPRISE_MODE,
    permissionKeys: ["company.view"],
    label: "القوائم المالية",
    description: "قائمة الدخل والميزانية العمومية والتدفقات النقدية.",
  },
  "enterprise-journal-approvals": {
    featureKey: FEATURE_KEYS.ENTERPRISE_MODE,
    permissionKeys: ["company.view"],
    label: "موافقات القيود",
    description: "مراجعة واعتماد أو رفض القيود اليومية.",
  },
  "enterprise-finance-repair": {
    featureKey: FEATURE_KEYS.ENTERPRISE_MODE,
    permissionKeys: ["company.view"],
    label: "إصلاح البيانات المالية",
    description: "فحص وإصلاح مشاكل البيانات المالية.",
  },
  "document-templates": {
    featureKey: FEATURE_KEYS.ENTERPRISE_MODE,
    permissionKeys: ["templates.manage"],
    label: "محرك المستندات",
    description: "تصميم وإدارة قوالب المستندات (فواتير، أوامر شراء، قيود).",
  },

  // ── Routes added in P1 gating fix ──
  "cost-profit-centers": {
    featureKey: FEATURE_KEYS.ACCOUNTING_ADVANCED,
    permissionKeys: ["finance.view_reports"],
    label: "مراكز التكلفة والربح",
    description: "إدارة مراكز التكلفة والربحية وتوزيع المصروفات.",
  },
  "my-approvals": {
    featureKey: FEATURE_KEYS.INVOICES_BASIC,
    permissionKeys: ["invoices.view"],
    label: "موافقاتي",
    description: "عرض ومعالجة طلبات الموافقة المعلقة.",
  },
  "workflows-designer": {
    featureKey: FEATURE_KEYS.INVOICES_BASIC,
    permissionKeys: ["invoices.view"],
    label: "مصمم سلاسل العمل",
    description: "تصميم وتعديل مسارات الموافقة.",
  },
  productivity: {
    featureKey: FEATURE_KEYS.INVOICES_BASIC,
    permissionKeys: ["finance.view_overview"],
    label: "لوحة الإنتاجية",
    description: "لوحة عمل المحاسب وملخص المهام اليومية.",
  },
  "sheet-view": {
    featureKey: FEATURE_KEYS.INVOICES_BASIC,
    permissionKeys: ["finance.view_reports"],
    label: "العرض الجدولي",
    description: "عرض البيانات بنمط جدول بيانات تفاعلي.",
  },
  "affiliate-dashboard": {
    featureKey: FEATURE_KEYS.PAID_INTEGRATIONS,
    permissionKeys: ["settings.integrations"],
    label: "برنامج الشراكة",
    description: "لوحة تحكم برنامج الإحالة والعمولات.",
  },
  company: {
    featureKey: FEATURE_KEYS.TEAM_MANAGEMENT,
    permissionKeys: ["company.view"],
    label: "إعدادات المنشأة",
    description: "إعدادات المنشأة الأساسية والبيانات التجارية.",
  },
  "sso-settings": {
    featureKey: FEATURE_KEYS.ENTERPRISE_MODE,
    permissionKeys: ["company.view"],
    label: "تسجيل الدخول الموحد",
    description: "إعدادات تسجيل الدخول الموحد (SSO) للمؤسسة.",
  },
  "payment-marketplace": {
    featureKey: FEATURE_KEYS.PAID_INTEGRATIONS,
    permissionKeys: ["settings.integrations"],
    label: "سوق بوابات الدفع",
    description: "استعراض واختيار بوابات الدفع المتاحة.",
  },
  settings: {
    featureKey: FEATURE_KEYS.TEAM_MANAGEMENT,
    permissionKeys: ["settings.view"],
    label: "الإعدادات",
    description: "إعدادات النظام العامة والتخصيصات.",
  },
};

/**
 * Derived: featureKey → permissionKeys[]
 * Used by FeatureGate for inline RBAC checks.
 * Auto-generated from ROUTE_FEATURE_MAP — DO NOT duplicate manually.
 */
export const FEATURE_RBAC_MAP: Partial<Record<string, string[]>> = (() => {
  const map: Record<string, Set<string>> = {};
  for (const entry of Object.values(ROUTE_FEATURE_MAP)) {
    if (entry.permissionKeys.length === 0) continue;
    if (!map[entry.featureKey]) {
      map[entry.featureKey] = new Set();
    }
    for (const pk of entry.permissionKeys) {
      map[entry.featureKey].add(pk);
    }
  }
  const result: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(map)) {
    result[k] = Array.from(v);
  }
  return result;
})();

/**
 * Maps sidebar nav items to their feature_key.
 * Used by DashboardSidebar to show lock icons on gated features.
 */
export const NAV_PATH_TO_FEATURE: Record<string, FeatureKey> = {
  ...Object.fromEntries(
    Object.entries(ROUTE_FEATURE_MAP).map(([segment, config]) => [
      `/dashboard/${segment}`,
      config.featureKey,
    ])
  ),
  // Enterprise sub-routes
  "/dashboard/enterprise/security-policies": FEATURE_KEYS.ENTERPRISE_MODE,
  "/dashboard/enterprise/sessions": FEATURE_KEYS.ENTERPRISE_MODE,
  "/dashboard/enterprise/ip-restrictions": FEATURE_KEYS.ENTERPRISE_MODE,
  "/dashboard/enterprise/role-templates": FEATURE_KEYS.ENTERPRISE_MODE,
  "/dashboard/enterprise/audit-export": FEATURE_KEYS.ENTERPRISE_MODE,
  "/dashboard/finance/corporate-structure": FEATURE_KEYS.ENTERPRISE_MODE,
  "/dashboard/finance/coa": FEATURE_KEYS.ENTERPRISE_MODE,
  "/dashboard/finance/journal": FEATURE_KEYS.ENTERPRISE_MODE,
  "/dashboard/finance/period-close": FEATURE_KEYS.ENTERPRISE_MODE,
  "/dashboard/finance/statements": FEATURE_KEYS.ENTERPRISE_MODE,
  "/dashboard/enterprise/approvals/journal": FEATURE_KEYS.ENTERPRISE_MODE,
  "/dashboard/enterprise/finance-repair": FEATURE_KEYS.ENTERPRISE_MODE,
  "/dashboard/governance-center": FEATURE_KEYS.ENTERPRISE_MODE,
  "/dashboard/enterprise/compliance-score": FEATURE_KEYS.ENTERPRISE_MODE,
  "/dashboard/finance/collections-intelligence": FEATURE_KEYS.ADVANCED_REPORTS,
  "/dashboard/finance/cashflow-radar": FEATURE_KEYS.ADVANCED_REPORTS,
};
