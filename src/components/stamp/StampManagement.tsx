/**
 * StampManagement — Admin/Owner-only page to configure the digital stamp.
 * Supports uploading a custom stamp image or generating one from company data.
 */
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, Trash2, Save, Shield, Eye, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DigitalStamp, { type StampData } from "./DigitalStamp";

const StampManagement = () => {
  // Demo data — will be replaced with tenant data from DB when auth is ready
  const [companyName, setCompanyName] = useState("شركة التقنية المتقدمة");
  const [crNumber, setCrNumber] = useState("1010234567");
  const [vatNumber, setVatNumber] = useState("310123456700003");
  const [stampEnabled, setStampEnabled] = useState(true);
  const [stampImageUrl, setStampImageUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview only — actual upload would go to storage bucket
    const url = URL.createObjectURL(file);
    setPreviewFile(url);
    setStampImageUrl(url);
  };

  const removeImage = () => {
    setStampImageUrl(null);
    setPreviewFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const stampPreview: StampData = {
    companyName,
    crNumber,
    vatNumber,
    imageUrl: stampImageUrl || undefined,
    enabled: stampEnabled,
  };

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield size={24} className="text-accent" />
            الختم الإلكتروني
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إعداد وإدارة الختم الرقمي للشركة — يُطبّق تلقائياً على الفواتير والعقود
          </p>
        </div>
        <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <Save size={16} />
          حفظ الإعدادات
        </Button>
      </div>

      {/* Access Notice */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 p-4"
      >
        <Shield size={18} className="text-accent shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">تنبيه أمني:</span> يمكن فقط لمالك الشركة أو المسؤول تعديل الختم الإلكتروني. لا يمكن للموظفين تغيير أو إزالة الختم.
        </p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Settings */}
        <div className="space-y-6">
          {/* Enable/Disable */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">تفعيل الختم</h3>
              <button
                onClick={() => setStampEnabled(!stampEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  stampEnabled ? "bg-accent" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform ${
                    stampEnabled ? "-translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              عند التفعيل، سيظهر الختم تلقائياً في جميع الفواتير والعقود والمستندات الرسمية.
            </p>
          </motion.div>

          {/* Company Data for Stamp */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 size={16} className="text-accent" />
              بيانات الختم
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">اسم الشركة *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">السجل التجاري *</label>
                <input
                  type="text"
                  value={crNumber}
                  onChange={(e) => setCrNumber(e.target.value)}
                  dir="ltr"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-english text-left focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">الرقم الضريبي (اختياري)</label>
                <input
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  dir="ltr"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-english text-left focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          </motion.div>

          {/* Upload Custom Stamp */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Upload size={16} className="text-accent" />
              صورة ختم مخصصة (اختياري)
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              يمكنك رفع صورة ختم الشركة الرسمي بصيغة PNG أو SVG (خلفية شفافة مُفضّلة). إذا لم ترفع صورة، سيتم إنشاء ختم رقمي تلقائياً.
            </p>

            {previewFile ? (
              <div className="flex items-center gap-4">
                <div className="h-24 w-24 rounded-xl border border-border bg-secondary/20 p-2 flex items-center justify-center">
                  <img
                    src={previewFile}
                    alt="صورة الختم"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={removeImage}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 size={14} />
                  إزالة الصورة
                </Button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/10 px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-accent hover:bg-accent/5"
              >
                <Upload size={20} />
                <span>اضغط لرفع صورة الختم</span>
              </button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/svg+xml,image/jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
          </motion.div>
        </div>

        {/* Preview */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card sticky top-24"
          >
            <h3 className="text-sm font-semibold text-foreground mb-6 flex items-center gap-2">
              <Eye size={16} className="text-accent" />
              معاينة الختم
            </h3>

            <div className="space-y-8">
              {/* Sizes */}
              {(["lg", "md", "sm"] as const).map((sz) => (
                <div key={sz} className="flex flex-col items-center gap-2">
                  <p className="text-[10px] text-muted-foreground">
                    {sz === "lg" ? "كبير (الفواتير)" : sz === "md" ? "متوسط (العقود)" : "صغير (المستندات)"}
                  </p>
                  <DigitalStamp stamp={stampPreview} size={sz} />
                </div>
              ))}

              {!stampEnabled && (
                <div className="rounded-lg bg-secondary/30 p-4 text-center">
                  <p className="text-xs text-muted-foreground">الختم معطّل حالياً</p>
                </div>
              )}
            </div>

            {/* Stamp on document preview */}
            {stampEnabled && (
              <div className="mt-8 rounded-xl border border-border p-6 bg-white">
                <p className="text-xs text-muted-foreground mb-4 text-center">معاينة على مستند</p>
                <div className="border-t border-dashed border-border pt-4 flex justify-between items-end">
                  <div className="text-[10px] text-muted-foreground">
                    <p>توقيع المستلم: ___________________</p>
                  </div>
                  <DigitalStamp stamp={stampPreview} size="md" />
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default StampManagement;
