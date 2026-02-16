import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Palette, Type, Upload, Save, Eye, Trash2, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBranding, ARABIC_SAFE_FONTS } from "@/contexts/BrandingContext";

const BrandingSettings = () => {
  const { branding, updateBranding } = useBranding();
  const [primary, setPrimary] = useState(branding.primaryColor);
  const [secondary, setSecondary] = useState(branding.secondaryColor);
  const [font, setFont] = useState(branding.font);
  const [logoPreview, setLogoPreview] = useState<string | null>(branding.logoUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    updateBranding({
      primaryColor: primary,
      secondaryColor: secondary,
      font,
      logoUrl: logoPreview,
    });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  };

  const removeLogo = () => {
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const presetPalettes = [
    { name: "الأزرق الكلاسيكي", primary: "#0f4c81", secondary: "#1a9b8a" },
    { name: "الأخضر السعودي", primary: "#006c35", secondary: "#c8a951" },
    { name: "البنفسجي العصري", primary: "#4c1d95", secondary: "#7c3aed" },
    { name: "الرمادي الفاخر", primary: "#1f2937", secondary: "#6b7280" },
    { name: "البرتقالي الجريء", primary: "#9a3412", secondary: "#ea580c" },
  ];

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Palette size={24} className="text-accent" />
            هوية الشركة
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            خصّص ألوان وخطوط وشعار شركتك — سيُطبّق على لوحة التحكم والفواتير والعقود
          </p>
        </div>
        <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSave}>
          <Save size={16} />
          حفظ التغييرات
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Settings Column */}
        <div className="space-y-6">
          {/* Logo Upload */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Image size={16} className="text-accent" />
              شعار الشركة
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              ارفع شعار شركتك بصيغة PNG أو SVG (خلفية شفافة مُفضّلة). سيظهر في الفواتير والعقود والمستندات.
            </p>

            {logoPreview ? (
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-xl border border-border bg-secondary/20 p-2 flex items-center justify-center">
                  <img src={logoPreview} alt="شعار الشركة" className="max-h-full max-w-full object-contain" />
                </div>
                <Button variant="outline" size="sm" onClick={removeLogo} className="gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 size={14} />
                  إزالة
                </Button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/10 px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-accent hover:bg-accent/5">
                <Upload size={20} />
                <span>اضغط لرفع الشعار</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg" onChange={handleLogoChange} className="hidden" />
          </motion.div>

          {/* Colors */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Palette size={16} className="text-accent" />
              الألوان
            </h3>

            {/* Presets */}
            <p className="text-xs text-muted-foreground mb-3">ألوان مُعدّة مسبقاً</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {presetPalettes.map((p) => (
                <button
                  key={p.name}
                  onClick={() => { setPrimary(p.primary); setSecondary(p.secondary); }}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                    primary === p.primary && secondary === p.secondary ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
                  }`}
                >
                  <div className="flex gap-1">
                    <div className="h-4 w-4 rounded-full" style={{ background: p.primary }} />
                    <div className="h-4 w-4 rounded-full" style={{ background: p.secondary }} />
                  </div>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>

            {/* Custom colors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">اللون الأساسي</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border border-input" />
                  <input type="text" value={primary} onChange={(e) => setPrimary(e.target.value)} dir="ltr" className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm font-english text-left focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">اللون الثانوي</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border border-input" />
                  <input type="text" value={secondary} onChange={(e) => setSecondary(e.target.value)} dir="ltr" className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm font-english text-left focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Font */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Type size={16} className="text-accent" />
              الخط العربي
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              اختر الخط المناسب لهوية شركتك. جميع الخطوط المتاحة تدعم اللغة العربية بالكامل.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ARABIC_SAFE_FONTS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFont(f.value)}
                  className={`rounded-lg border px-4 py-3 text-right transition-colors ${
                    font === f.value ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
                  }`}
                >
                  <span className="text-sm font-medium text-foreground" style={{ fontFamily: `'${f.value}', sans-serif` }}>
                    {f.label}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-1" style={{ fontFamily: `'${f.value}', sans-serif` }}>
                    بسم الله الرحمن الرحيم — ١٢٣٤٥
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Preview Column */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border border-border bg-card p-6 shadow-card sticky top-24">
            <h3 className="text-sm font-semibold text-foreground mb-6 flex items-center gap-2">
              <Eye size={16} className="text-accent" />
              معاينة مباشرة
            </h3>

            {/* Document Header Preview */}
            <div className="rounded-xl overflow-hidden border border-border">
              <div className="px-6 py-4" style={{ background: primary, fontFamily: `'${font}', sans-serif` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {logoPreview ? (
                      <div className="h-10 w-10 rounded-lg bg-white/10 p-1.5 flex items-center justify-center">
                        <img src={logoPreview} alt="" className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: secondary }}>
                        <span className="text-sm font-bold text-white font-english">S</span>
                      </div>
                    )}
                    <div className="text-white">
                      <p className="text-sm font-bold">{branding.companyName}</p>
                      <p className="text-[10px] opacity-70 font-english">Company Name</p>
                    </div>
                  </div>
                  <div className="text-left text-white">
                    <p className="text-lg font-bold">فاتورة ضريبية</p>
                    <p className="text-[10px] opacity-70 font-english">Tax Invoice</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 space-y-3" style={{ fontFamily: `'${font}', sans-serif` }}>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>رقم الفاتورة: <span className="font-english font-semibold text-foreground">INV-2026-0001</span></span>
                  <span>تاريخ الإصدار: ١٠ فبراير ٢٠٢٦</span>
                </div>

                {/* Mini table */}
                <table className="w-full text-[10px]">
                  <thead>
                    <tr>
                      <th className="text-right py-1.5 px-2 text-white rounded-r" style={{ background: primary }}>الوصف</th>
                      <th className="text-center py-1.5 px-2 text-white" style={{ background: primary }}>الكمية</th>
                      <th className="text-left py-1.5 px-2 text-white rounded-l" style={{ background: primary }}>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/30">
                      <td className="py-1.5 px-2">استشارات تقنية</td>
                      <td className="text-center py-1.5 px-2 font-english">40</td>
                      <td className="text-left py-1.5 px-2 font-english">٨٬٠٠٠٫٠٠</td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-start">
                  <div className="rounded-lg px-3 py-2 text-xs font-bold text-white" style={{ background: primary }}>
                    الإجمالي: ٩٬٢٠٠٫٠٠ ر.س
                  </div>
                </div>
              </div>

              {/* Footer with secondary color */}
              <div className="px-4 py-2 text-[9px] text-white flex justify-between" style={{ background: secondary }}>
                <span>مستند رسمي</span>
                <span className="font-english">Numaxio</span>
              </div>
            </div>

            {/* Button Preview */}
            <div className="mt-6 space-y-3">
              <p className="text-xs text-muted-foreground">معاينة الأزرار</p>
              <div className="flex gap-2">
                <button className="rounded-lg px-4 py-2 text-xs font-medium text-white" style={{ background: primary }}>زر أساسي</button>
                <button className="rounded-lg px-4 py-2 text-xs font-medium text-white" style={{ background: secondary }}>زر ثانوي</button>
                <button className="rounded-lg border px-4 py-2 text-xs font-medium" style={{ borderColor: primary, color: primary }}>زر محدد</button>
              </div>
            </div>

            {/* Font Preview */}
            <div className="mt-6 p-4 rounded-lg bg-secondary/20">
              <p className="text-xs text-muted-foreground mb-2">معاينة الخط</p>
              <p className="text-lg font-bold text-foreground" style={{ fontFamily: `'${font}', sans-serif` }}>
                شركة التقنية المتقدمة
              </p>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: `'${font}', sans-serif` }}>
                نقدم أفضل الحلول التقنية المتكاملة للشركات والمؤسسات
              </p>
              <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: `'${font}', sans-serif` }}>
                المبلغ الإجمالي: <span className="font-english">١٥٬٧٥٠٫٠٠</span> ريال سعودي
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default BrandingSettings;
