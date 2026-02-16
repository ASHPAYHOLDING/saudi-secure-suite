/**
 * StampManagement — Admin/Owner-only page to configure the digital stamp.
 * Supports uploading a custom stamp image or generating one from company data.
 * Persists to the tenants table and uploads images to the tenant-stamps bucket.
 */
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, Trash2, Save, Shield, Eye, Building2, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import DigitalStamp, { type StampData } from "./DigitalStamp";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const StampManagement = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [stampEnabled, setStampEnabled] = useState(false);
  const [stampImageUrl, setStampImageUrl] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAuthorized = userRole === "owner" || userRole === "admin";

  // Load tenant stamp data + user role
  useEffect(() => {
    if (!tenantId || !user) return;

    const load = async () => {
      const [tenantRes, roleRes] = await Promise.all([
        supabase.from("tenants").select("stamp_enabled, stamp_company_name, stamp_cr_number, stamp_vat_number, stamp_image_url, name, cr_number, vat_number").eq("id", tenantId).single(),
        supabase.from("tenant_members").select("role").eq("tenant_id", tenantId).eq("user_id", user.id).single(),
      ]);

      if (tenantRes.data) {
        const t = tenantRes.data;
        setStampEnabled(t.stamp_enabled);
        setCompanyName(t.stamp_company_name || t.name || "");
        setCrNumber(t.stamp_cr_number || t.cr_number || "");
        setVatNumber(t.stamp_vat_number || t.vat_number || "");
        setStampImageUrl(t.stamp_image_url);
      }
      if (roleRes.data) {
        setUserRole(roleRes.data.role);
      }
      setLoading(false);
    };
    load();
  }, [tenantId, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "خطأ", description: "حجم الملف يجب أن يكون أقل من 2 ميجابايت", variant: "destructive" });
      return;
    }
    setPendingFile(file);
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
  };

  const removeImage = () => {
    setStampImageUrl(null);
    setLocalPreview(null);
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    if (!tenantId || !user || !isAuthorized) return;
    setSaving(true);

    let finalImageUrl = stampImageUrl;

    // Upload new stamp image if pending
    if (pendingFile) {
      const ext = pendingFile.name.split(".").pop() || "png";
      const path = `${tenantId}/stamp-${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("tenant-stamps")
        .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });

      if (uploadError) {
        toast({ title: "خطأ في رفع الصورة", description: uploadError.message, variant: "destructive" });
        setSaving(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("tenant-stamps").getPublicUrl(path);
      finalImageUrl = urlData.publicUrl;
    }

    // If image was removed (no pending file + no stampImageUrl)
    if (!pendingFile && !stampImageUrl) {
      finalImageUrl = null;
    }

    const { error } = await supabase.from("tenants").update({
      stamp_enabled: stampEnabled,
      stamp_company_name: companyName || null,
      stamp_cr_number: crNumber || null,
      stamp_vat_number: vatNumber || null,
      stamp_image_url: finalImageUrl,
    }).eq("id", tenantId);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      setStampImageUrl(finalImageUrl);
      setLocalPreview(null);
      setPendingFile(null);
      toast({ title: "تم حفظ إعدادات الختم بنجاح" });
    }
    setSaving(false);
  };

  const stampPreview: StampData = {
    companyName,
    crNumber,
    vatNumber,
    imageUrl: localPreview || stampImageUrl || undefined,
    enabled: stampEnabled,
  };

  const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors";

  if (loading) {
    return <div className="flex justify-center items-center py-32"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  return (
    <div dir="rtl" className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield size={24} className="text-accent" />
            الختم الإلكتروني
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إعداد وإدارة الختم الرقمي للشركة — يُطبّق تلقائياً على الفواتير والعقود
          </p>
        </div>
        {isAuthorized && (
          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            حفظ الإعدادات
          </Button>
        )}
      </div>

      {/* Access Notice */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-3 rounded-xl border p-4 ${isAuthorized ? 'border-accent/20 bg-accent/5' : 'border-destructive/20 bg-destructive/5'}`}
      >
        <Shield size={18} className={isAuthorized ? "text-accent" : "text-destructive"} />
        <p className="text-xs text-muted-foreground">
          {isAuthorized ? (
            <><span className="font-semibold text-foreground">صلاحية كاملة:</span> يمكنك تعديل وحفظ إعدادات الختم الإلكتروني. جميع التغييرات مسجلة في سجل التدقيق.</>
          ) : (
            <><span className="font-semibold text-destructive">عرض فقط:</span> لا يمكنك تعديل الختم الإلكتروني. يمكن فقط لمالك الشركة أو المسؤول تعديل هذه الإعدادات.</>
          )}
        </p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Settings */}
        <div className="space-y-6">
          {/* Enable/Disable */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">تفعيل الختم</h3>
              <button
                onClick={() => isAuthorized && setStampEnabled(!stampEnabled)}
                disabled={!isAuthorized}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  stampEnabled ? "bg-accent" : "bg-muted"
                } ${!isAuthorized ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
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
            className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card"
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
                  disabled={!isAuthorized}
                  maxLength={100}
                  className={`${inputClass} ${!isAuthorized ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">السجل التجاري *</label>
                <input
                  type="text"
                  value={crNumber}
                  onChange={(e) => setCrNumber(e.target.value)}
                  disabled={!isAuthorized}
                  maxLength={20}
                  dir="ltr"
                  className={`${inputClass} font-english text-left ${!isAuthorized ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">الرقم الضريبي</label>
                <input
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  disabled={!isAuthorized}
                  maxLength={20}
                  dir="ltr"
                  className={`${inputClass} font-english text-left ${!isAuthorized ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>
          </motion.div>

          {/* Upload Custom Stamp */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Upload size={16} className="text-accent" />
              صورة ختم مخصصة (اختياري)
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              يمكنك رفع صورة ختم الشركة الرسمي بصيغة PNG أو SVG (خلفية شفافة مُفضّلة، حد أقصى 2 ميجابايت). إذا لم ترفع صورة، سيتم إنشاء ختم رقمي تلقائياً.
            </p>

            {(localPreview || stampImageUrl) ? (
              <div className="flex items-center gap-4">
                <div className="h-24 w-24 rounded-xl border border-border bg-secondary/20 p-2 flex items-center justify-center">
                  <img
                    src={localPreview || stampImageUrl || ""}
                    alt="صورة الختم"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                {isAuthorized && (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={removeImage}
                      className="gap-1.5 text-destructive hover:text-destructive"
                    >
                      <Trash2 size={14} />
                      إزالة الصورة
                    </Button>
                    {localPreview && (
                      <p className="text-[10px] text-warning">سيتم رفع الصورة عند الحفظ</p>
                    )}
                  </div>
                )}
              </div>
            ) : isAuthorized ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/10 px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-accent hover:bg-accent/5"
              >
                <Upload size={20} />
                <span>اضغط لرفع صورة الختم</span>
              </button>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-border bg-secondary/10 px-4 py-8 text-center">
                <p className="text-xs text-muted-foreground">لا توجد صورة ختم مرفوعة</p>
              </div>
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
            className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card sticky top-24"
          >
            <h3 className="text-sm font-semibold text-foreground mb-6 flex items-center gap-2">
              <Eye size={16} className="text-accent" />
              معاينة الختم
            </h3>

            <div className="space-y-8">
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
