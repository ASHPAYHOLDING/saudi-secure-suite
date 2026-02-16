import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Save,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building2,
  QrCode,
  FileText,
  Lock,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComplianceState {
  vatRegistered: boolean;
  vatPercentage: number;
  crNumber: string;
  vatNumber: string;
  zatcaPhase1: boolean;
  zatcaPhase2Ready: boolean;
}

const ComplianceSettings = () => {
  const [state, setState] = useState<ComplianceState>({
    vatRegistered: true,
    vatPercentage: 15,
    crNumber: "1010234567",
    vatNumber: "310123456700003",
    zatcaPhase1: true,
    zatcaPhase2Ready: false,
  });

  const update = (partial: Partial<ComplianceState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  };

  // Validation checks
  const checks = [
    {
      label: "تسجيل ضريبة القيمة المضافة",
      passed: state.vatRegistered,
      required: true,
      detail: state.vatRegistered ? `مسجّل بنسبة ${state.vatPercentage}٪` : "غير مسجّل",
    },
    {
      label: "رقم السجل التجاري",
      passed: state.crNumber.length >= 10,
      required: true,
      detail: state.crNumber || "غير محدد",
    },
    {
      label: "الرقم الضريبي",
      passed: state.vatNumber.length >= 15,
      required: state.vatRegistered,
      detail: state.vatNumber || "غير محدد",
    },
    {
      label: "ZATCA المرحلة الأولى (الفوترة الإلكترونية)",
      passed: state.zatcaPhase1,
      required: true,
      detail: state.zatcaPhase1 ? "مُفعّل" : "غير مُفعّل",
    },
    {
      label: "ZATCA المرحلة الثانية (التكامل)",
      passed: state.zatcaPhase2Ready,
      required: false,
      detail: state.zatcaPhase2Ready ? "جاهز" : "قيد التجهيز",
    },
  ];

  const requiredPassed = checks.filter((c) => c.required && c.passed).length;
  const requiredTotal = checks.filter((c) => c.required).length;
  const allRequiredPassed = requiredPassed === requiredTotal;

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <ShieldCheck size={24} className="text-accent" />
            الامتثال والتنظيم
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إعدادات ضريبة القيمة المضافة ومتطلبات هيئة الزكاة والضريبة والجمارك (ZATCA)
          </p>
        </div>
        <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <Save size={16} />
          حفظ الإعدادات
        </Button>
      </div>

      {/* Compliance Score */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border p-5 ${
          allRequiredPassed
            ? "border-success/30 bg-success/5"
            : "border-warning/30 bg-warning/5"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {allRequiredPassed ? (
              <CheckCircle2 size={24} className="text-success" />
            ) : (
              <AlertTriangle size={24} className="text-warning" />
            )}
            <div>
              <p className="text-sm font-bold text-foreground">
                {allRequiredPassed ? "المنشأة مُتوافقة" : "يتطلب إكمال الإعدادات"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {requiredPassed} من {requiredTotal} متطلبات إلزامية مُحققة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {checks.filter((c) => c.required).map((c, i) => (
              <div
                key={i}
                className={`h-2.5 w-2.5 rounded-full ${c.passed ? "bg-success" : "bg-warning"}`}
              />
            ))}
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Settings */}
        <div className="space-y-6">
          {/* VAT Registration */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText size={16} className="text-accent" />
              ضريبة القيمة المضافة
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">مسجّل في ضريبة القيمة المضافة</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    إلزامي للمنشآت التي تتجاوز إيراداتها 375,000 ر.س سنوياً
                  </p>
                </div>
                <button
                  onClick={() => update({ vatRegistered: !state.vatRegistered })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    state.vatRegistered ? "bg-accent" : "bg-muted"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform ${
                      state.vatRegistered ? "-translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {state.vatRegistered && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">نسبة الضريبة (%)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={state.vatPercentage}
                      onChange={(e) => update({ vatPercentage: parseFloat(e.target.value) || 0 })}
                      min="0"
                      max="100"
                      step="0.5"
                      dir="ltr"
                      className="h-10 w-24 rounded-lg border border-input bg-background px-3 text-sm font-english text-center focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <span className="text-xs text-muted-foreground">النسبة المعتمدة حالياً: ١٥٪</span>
                  </div>
                </div>
              )}

              {!state.vatRegistered && (
                <div className="flex items-start gap-2 rounded-lg bg-warning/5 border border-warning/20 p-3">
                  <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">تنبيه:</span> عدم التسجيل في ضريبة القيمة المضافة عند تجاوز الحد النظامي يُعرّض المنشأة لغرامات مالية من هيئة الزكاة والضريبة والجمارك.
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Commercial Registration */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 size={16} className="text-accent" />
              بيانات المنشأة
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  رقم السجل التجاري *
                  <span className="text-destructive mr-1">(إلزامي)</span>
                </label>
                <input
                  type="text"
                  value={state.crNumber}
                  onChange={(e) => update({ crNumber: e.target.value })}
                  placeholder="10XXXXXXXX"
                  dir="ltr"
                  className={`h-10 w-full rounded-lg border bg-background px-3 text-sm font-english text-left focus:outline-none focus:ring-1 ${
                    state.crNumber.length >= 10
                      ? "border-success/50 focus:border-success focus:ring-success"
                      : "border-destructive/50 focus:border-destructive focus:ring-destructive"
                  }`}
                />
                {state.crNumber.length > 0 && state.crNumber.length < 10 && (
                  <p className="text-[10px] text-destructive mt-1">رقم السجل التجاري يجب أن يكون 10 أرقام على الأقل</p>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  الرقم الضريبي {state.vatRegistered && <span className="text-destructive mr-1">(إلزامي)</span>}
                </label>
                <input
                  type="text"
                  value={state.vatNumber}
                  onChange={(e) => update({ vatNumber: e.target.value })}
                  placeholder="3XXXXXXXXXX00003"
                  dir="ltr"
                  className={`h-10 w-full rounded-lg border bg-background px-3 text-sm font-english text-left focus:outline-none focus:ring-1 ${
                    state.vatNumber.length >= 15
                      ? "border-success/50 focus:border-success focus:ring-success"
                      : state.vatRegistered
                        ? "border-destructive/50 focus:border-destructive focus:ring-destructive"
                        : "border-input focus:border-accent focus:ring-accent"
                  }`}
                />
                {state.vatRegistered && state.vatNumber.length > 0 && state.vatNumber.length < 15 && (
                  <p className="text-[10px] text-destructive mt-1">الرقم الضريبي يجب أن يكون 15 رقماً</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* ZATCA Phases */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <QrCode size={16} className="text-accent" />
              الفوترة الإلكترونية (ZATCA)
            </h3>

            {/* Phase 1 */}
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${state.zatcaPhase1 ? "bg-success" : "bg-muted"}`} />
                    <p className="text-sm font-semibold text-foreground">المرحلة الأولى — الإنشاء والحفظ</p>
                  </div>
                  <button
                    onClick={() => update({ zatcaPhase1: !state.zatcaPhase1 })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      state.zatcaPhase1 ? "bg-accent" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform ${
                        state.zatcaPhase1 ? "-translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <div className="space-y-1.5 text-[10px] text-muted-foreground mr-4">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={10} className="text-success shrink-0" />
                    <span>إصدار فواتير إلكترونية بصيغة محددة</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={10} className="text-success shrink-0" />
                    <span>رمز QR يحتوي على بيانات البائع والضريبة</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={10} className="text-success shrink-0" />
                    <span>الاحتفاظ بالفواتير إلكترونياً</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={10} className="text-success shrink-0" />
                    <span>عدم إصدار فواتير مكتوبة بخط اليد</span>
                  </div>
                </div>
              </div>

              {/* Phase 2 */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${state.zatcaPhase2Ready ? "bg-success" : "bg-warning animate-pulse"}`} />
                    <p className="text-sm font-semibold text-foreground">المرحلة الثانية — التكامل والربط</p>
                    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[9px] font-medium text-warning">قيد التجهيز</span>
                  </div>
                </div>
                <div className="space-y-1.5 text-[10px] text-muted-foreground mr-4">
                  <div className="flex items-center gap-1.5">
                    <Lock size={10} className="text-muted-foreground/50 shrink-0" />
                    <span>ربط API مع منصة فاتورة (ZATCA)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Lock size={10} className="text-muted-foreground/50 shrink-0" />
                    <span>إصدار XML موقّع رقمياً</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Lock size={10} className="text-muted-foreground/50 shrink-0" />
                    <span>رمز QR بتشفير TLV متوافق</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Lock size={10} className="text-muted-foreground/50 shrink-0" />
                    <span>ختم التشفير (Cryptographic Stamp)</span>
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-2 rounded-lg bg-info/5 border border-info/20 p-2.5">
                  <Info size={12} className="text-info shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    البنية التحتية للمرحلة الثانية جاهزة (API endpoints، XML schema، QR TLV encoding). سيتم تفعيلها عند اكتمال التكامل مع بوابة ZATCA.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Checklist & Info Column */}
        <div className="space-y-6">
          {/* Compliance Checklist */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card sticky top-24"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <ShieldCheck size={16} className="text-accent" />
              قائمة الامتثال
            </h3>

            <div className="space-y-3">
              {checks.map((check, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    check.passed
                      ? "border-success/20 bg-success/5"
                      : check.required
                        ? "border-destructive/20 bg-destructive/5"
                        : "border-border bg-secondary/10"
                  }`}
                >
                  {check.passed ? (
                    <CheckCircle2 size={16} className="text-success shrink-0" />
                  ) : check.required ? (
                    <XCircle size={16} className="text-destructive shrink-0" />
                  ) : (
                    <AlertTriangle size={16} className="text-warning shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{check.label}</p>
                    <p className="text-[10px] text-muted-foreground font-english">{check.detail}</p>
                  </div>
                  {check.required && (
                    <span className="text-[9px] text-muted-foreground shrink-0">إلزامي</span>
                  )}
                </div>
              ))}
            </div>

            {/* Enforcement Notice */}
            <div className="mt-6 rounded-lg border border-accent/20 bg-accent/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock size={14} className="text-accent" />
                <span className="text-xs font-semibold text-foreground">حماية إلزامية</span>
              </div>
              <div className="space-y-1.5 text-[10px] text-muted-foreground leading-relaxed">
                <p>• لا يمكن إصدار فاتورة بدون ضريبة إذا كانت المنشأة مسجّلة</p>
                <p>• لا يمكن إصدار فاتورة بدون سجل تجاري ورقم ضريبي عند تفعيل ZATCA</p>
                <p>• جميع القيود تُطبّق على مستوى قاعدة البيانات (لا يمكن تجاوزها)</p>
                <p>• يتم تسجيل جميع التغييرات في سجل المراجعة تلقائياً</p>
              </div>
            </div>

            {/* ZATCA Architecture Info */}
            <div className="mt-4 rounded-lg border border-border p-4">
              <h4 className="text-xs font-semibold text-foreground mb-2">البنية التقنية للمرحلة الثانية</h4>
              <div className="space-y-2 text-[10px] text-muted-foreground">
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span>XML Schema (UBL 2.1)</span>
                  <span className="text-success font-english">Ready ✓</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span>QR Code (TLV Encoding)</span>
                  <span className="text-success font-english">Ready ✓</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span>API Integration Endpoints</span>
                  <span className="text-success font-english">Ready ✓</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span>Digital Signature (X.509)</span>
                  <span className="text-warning font-english">Pending</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span>ZATCA Sandbox Testing</span>
                  <span className="text-warning font-english">Pending</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceSettings;
