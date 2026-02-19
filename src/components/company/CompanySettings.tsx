import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding, ARABIC_SAFE_FONTS } from "@/contexts/BrandingContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Building2, Save, Upload, Loader2, Palette, Globe, Phone, FileText, Mail,
  Shield, CheckCircle2, Clock, AlertTriangle, XCircle, RefreshCw, Wifi
} from "lucide-react";

interface CompanyData {
  name: string;
  name_en: string;
  email: string;
  phone: string;
  cr_number: string;
  vat_number: string;
  address_street: string;
  address_city: string;
  address_zip: string;
  building_number: string;
  address_district: string;
  additional_number: string;
  logo_url: string;
  industry: string;
}

type ZatcaStatus = 'connected' | 'pending' | 'expired' | 'error' | 'disconnected';

interface ZatcaSettingsData {
  zatca_status: ZatcaStatus;
  last_credential_refresh: string | null;
  last_error: string | null;
  credential_metadata: any;
}

const ZATCA_STATUS_CONFIG: Record<ZatcaStatus, { label: string; icon: React.ReactNode; variant: string; color: string }> = {
  connected: { label: 'متصل', icon: <CheckCircle2 size={14} />, variant: 'default', color: 'bg-accent/10 text-accent border-accent/20' },
  pending: { label: 'قيد المعالجة', icon: <Clock size={14} />, variant: 'secondary', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  expired: { label: 'منتهي الصلاحية', icon: <AlertTriangle size={14} />, variant: 'destructive', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  error: { label: 'خطأ', icon: <XCircle size={14} />, variant: 'destructive', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  disconnected: { label: 'غير متصل', icon: <Wifi size={14} />, variant: 'secondary', color: 'bg-muted text-muted-foreground border-border' },
};

const CompanySettings = () => {
  const { tenantId } = useAuth();
  const { branding, updateBranding, saving: brandingSaving } = useBranding();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshingZatca, setRefreshingZatca] = useState(false);
  const [data, setData] = useState<CompanyData>({
    name: "", name_en: "", email: "", phone: "", cr_number: "",
    vat_number: "", address_street: "", address_city: "", address_zip: "",
    building_number: "", address_district: "", additional_number: "",
    logo_url: "", industry: "",
  });

  const [zatcaSettings, setZatcaSettings] = useState<ZatcaSettingsData>({
    zatca_status: 'disconnected',
    last_credential_refresh: null,
    last_error: null,
    credential_metadata: {},
  });

  // Track original VAT number for change detection
  const [originalVatNumber, setOriginalVatNumber] = useState("");

  const [brandForm, setBrandForm] = useState({
    primaryColor: "#0f4c81", secondaryColor: "#1a9b8a",
    font: "IBM Plex Sans Arabic", invoiceFooterText: "",
    emailSignature: "", websiteUrl: "", supportPhone: "",
  });

  useEffect(() => {
    if (tenantId) fetchCompany();
  }, [tenantId]);

  useEffect(() => {
    setBrandForm({
      primaryColor: branding.primaryColor, secondaryColor: branding.secondaryColor,
      font: branding.font, invoiceFooterText: branding.invoiceFooterText,
      emailSignature: branding.emailSignature, websiteUrl: branding.websiteUrl,
      supportPhone: branding.supportPhone,
    });
  }, [branding]);

  // Realtime subscription for ZATCA status
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`zatca-status-${tenantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'zatca_settings',
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload: any) => {
        const newData = payload.new;
        if (newData) {
          setZatcaSettings({
            zatca_status: newData.zatca_status || 'disconnected',
            last_credential_refresh: newData.last_credential_refresh,
            last_error: newData.last_error,
            credential_metadata: newData.credential_metadata || {},
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const fetchCompany = async () => {
    const [tenantRes, zatcaRes] = await Promise.all([
      supabase
        .from("tenants")
        .select("name, name_en, email, phone, cr_number, vat_number, address_street, address_city, address_zip, logo_url, industry, building_number, address_district, additional_number")
        .eq("id", tenantId!)
        .single(),
      (supabase.from("zatca_settings" as any)
        .select("zatca_status, last_credential_refresh, last_error, credential_metadata")
        .eq("tenant_id", tenantId!)
        .maybeSingle() as any),
    ]);

    if (tenantRes.error) {
      toast.error("خطأ في تحميل بيانات الشركة");
    } else if (tenantRes.data) {
      const t = tenantRes.data as any;
      setData({
        name: t.name || "", name_en: t.name_en || "",
        email: t.email || "", phone: t.phone || "",
        cr_number: t.cr_number || "", vat_number: t.vat_number || "",
        address_street: t.address_street || "", address_city: t.address_city || "",
        address_zip: t.address_zip || "",
        building_number: t.building_number || "",
        address_district: t.address_district || "",
        additional_number: t.additional_number || "",
        logo_url: t.logo_url || "", industry: t.industry || "",
      });
      setOriginalVatNumber(t.vat_number || "");
    }

    if (zatcaRes.data) {
      const z = zatcaRes.data as any;
      setZatcaSettings({
        zatca_status: z.zatca_status || 'disconnected',
        last_credential_refresh: z.last_credential_refresh,
        last_error: z.last_error,
        credential_metadata: z.credential_metadata || {},
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);

    const { error } = await supabase
      .from("tenants")
      .update({
        name: data.name, name_en: data.name_en || null,
        email: data.email || null, phone: data.phone || null,
        cr_number: data.cr_number || null, vat_number: data.vat_number || null,
        address_street: data.address_street || null,
        address_city: data.address_city || null,
        address_zip: data.address_zip || null,
        building_number: data.building_number || null,
        address_district: data.address_district || null,
        additional_number: data.additional_number || null,
        industry: data.industry || null,
      })
      .eq("id", tenantId);

    await updateBranding({
      primaryColor: brandForm.primaryColor, secondaryColor: brandForm.secondaryColor,
      font: brandForm.font, invoiceFooterText: brandForm.invoiceFooterText,
      emailSignature: brandForm.emailSignature, websiteUrl: brandForm.websiteUrl,
      supportPhone: brandForm.supportPhone, companyName: data.name,
    });

    // If VAT number changed, trigger ZATCA credential regeneration
    if (data.vat_number !== originalVatNumber && data.vat_number) {
      await triggerZatcaRegeneration();
      setOriginalVatNumber(data.vat_number);
    }

    setSaving(false);
    if (error) {
      toast.error("فشل حفظ البيانات: " + error.message);
    } else {
      toast.success("تم حفظ بيانات الشركة بنجاح");
    }
  };

  const triggerZatcaRegeneration = useCallback(async () => {
    if (!tenantId || !data.vat_number) return;
    setRefreshingZatca(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("regenerate-zatca-credentials", {
        body: { tenantId, vatNumber: data.vat_number },
      });
      if (error) throw error;
      if (result?.status) {
        setZatcaSettings(prev => ({ ...prev, zatca_status: result.status, last_error: result.error }));
      }
      toast.success("تم تحديث حالة ZATCA");
    } catch (err: any) {
      toast.error("فشل تحديث ZATCA: " + (err.message || "خطأ"));
    }
    setRefreshingZatca(false);
  }, [tenantId, data.vat_number]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    if (!file.type.startsWith("image/")) { toast.error("يرجى اختيار ملف صورة"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("حجم الصورة يجب أن يكون أقل من 2 ميجابايت"); return; }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${tenantId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("tenant-stamps").upload(filePath, file, { upsert: true });
    if (uploadError) { toast.error("فشل رفع الشعار: " + uploadError.message); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("tenant-stamps").getPublicUrl(filePath);
    const logoUrl = urlData.publicUrl;

    const { error: updateError } = await supabase.from("tenants").update({ logo_url: logoUrl }).eq("id", tenantId);
    setUploading(false);
    if (updateError) { toast.error("فشل تحديث رابط الشعار"); }
    else { setData(prev => ({ ...prev, logo_url: logoUrl })); updateBranding({ logoUrl }); toast.success("تم رفع الشعار بنجاح"); }
  };

  const update = (field: keyof CompanyData, value: string) => setData(prev => ({ ...prev, [field]: value }));
  const updateBrand = (field: keyof typeof brandForm, value: string) => setBrandForm(prev => ({ ...prev, [field]: value }));

  const zatcaStatusConfig = ZATCA_STATUS_CONFIG[zatcaSettings.zatca_status] || ZATCA_STATUS_CONFIG.disconnected;

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">إعدادات الشركة</h1>
        </div>
        <Button onClick={handleSave} disabled={saving || brandingSaving}>
          {(saving || brandingSaving) ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
          حفظ التغييرات
        </Button>
      </div>

      {/* ZATCA Status Card */}
      <Card className="border-2" style={{ borderColor: zatcaSettings.zatca_status === 'connected' ? 'hsl(var(--accent))' : zatcaSettings.zatca_status === 'error' || zatcaSettings.zatca_status === 'expired' ? 'hsl(var(--destructive))' : undefined }}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              حالة الامتثال الضريبي (ZATCA)
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`gap-1.5 ${zatcaStatusConfig.color}`}>
                {zatcaStatusConfig.icon}
                {zatcaStatusConfig.label}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={triggerZatcaRegeneration}
                disabled={refreshingZatca || !data.vat_number}
                className="h-8 w-8 p-0"
              >
                {refreshingZatca ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-[10px] text-muted-foreground mb-1">الحالة</p>
              <div className="flex items-center gap-1.5">
                {zatcaStatusConfig.icon}
                <span className="text-sm font-semibold text-foreground">{zatcaStatusConfig.label}</span>
              </div>
            </div>
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-[10px] text-muted-foreground mb-1">آخر تحديث</p>
              <p className="text-sm font-semibold text-foreground">
                {zatcaSettings.last_credential_refresh
                  ? new Date(zatcaSettings.last_credential_refresh).toLocaleDateString("ar-SA", { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-[10px] text-muted-foreground mb-1">الشهادات</p>
              <p className="text-sm font-semibold text-foreground">
                {zatcaSettings.credential_metadata?.certificates_count ?? 0} شهادة
              </p>
            </div>
          </div>

          {/* Error Display */}
          {zatcaSettings.last_error && (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{zatcaSettings.last_error}</p>
            </div>
          )}

          {/* VAT Number Change Notice */}
          {data.vat_number !== originalVatNumber && data.vat_number && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 flex items-start gap-2">
              <Clock size={14} className="text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-800">
                تم تغيير الرقم الضريبي — سيتم تحديث بيانات ZATCA تلقائياً عند حفظ التغييرات
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader><CardTitle className="text-lg">شعار الشركة</CardTitle></CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="h-24 w-24 shrink-0 rounded-xl border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
            {data.logo_url ? (
              <img src={data.logo_url} alt="شعار الشركة" className="h-full w-full object-contain" />
            ) : (
              <Building2 className="h-10 w-10 text-muted-foreground/50" />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo-upload" className="cursor-pointer">
              <Button variant="outline" asChild disabled={uploading}>
                <span>
                  {uploading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Upload className="ml-2 h-4 w-4" />}
                  {uploading ? "جارٍ الرفع..." : "رفع شعار جديد"}
                </span>
              </Button>
            </Label>
            <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <p className="text-xs text-muted-foreground">PNG أو JPG — أقصى حجم 2 ميجابايت</p>
          </div>
        </CardContent>
      </Card>

      {/* Branding / Visual Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            الهوية البصرية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>اللون الأساسي</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={brandForm.primaryColor} onChange={(e) => updateBrand("primaryColor", e.target.value)} className="h-10 w-14 rounded-lg border border-border cursor-pointer" />
                <Input value={brandForm.primaryColor} onChange={(e) => updateBrand("primaryColor", e.target.value)} className="font-mono text-sm" dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>اللون الثانوي</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={brandForm.secondaryColor} onChange={(e) => updateBrand("secondaryColor", e.target.value)} className="h-10 w-14 rounded-lg border border-border cursor-pointer" />
                <Input value={brandForm.secondaryColor} onChange={(e) => updateBrand("secondaryColor", e.target.value)} className="font-mono text-sm" dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>الخط</Label>
              <Select value={brandForm.font} onValueChange={(v) => updateBrand("font", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ARABIC_SAFE_FONTS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Live Preview */}
          <div className="rounded-xl border border-border p-4 space-y-2">
            <p className="text-xs text-muted-foreground mb-2">معاينة مباشرة</p>
            <div className="rounded-lg overflow-hidden" style={{ fontFamily: `'${brandForm.font}', sans-serif` }}>
              <div className="p-4" style={{ background: brandForm.primaryColor, color: '#fff' }}>
                <div className="flex items-center gap-3">
                  {data.logo_url && (
                    <div className="h-10 w-10 rounded-lg bg-white/15 p-1 shrink-0">
                      <img src={data.logo_url} alt="" className="h-full w-full object-contain" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold">{data.name || "اسم الشركة"}</p>
                    <p className="text-xs opacity-70">{data.name_en || "Company Name"}</p>
                  </div>
                </div>
              </div>
              <div className="p-3 border-t" style={{ borderColor: brandForm.secondaryColor }}>
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: brandForm.secondaryColor, color: '#fff' }}>
                  نموذج ألوان العلامة التجارية
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Extended Branding Fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            بيانات الفواتير والتواصل
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />نص ذيل الفاتورة</Label>
            <Textarea value={brandForm.invoiceFooterText} onChange={(e) => updateBrand("invoiceFooterText", e.target.value)} placeholder="مثال: شكراً لتعاملكم معنا — يرجى السداد خلال 30 يوماً" rows={2} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />توقيع البريد الإلكتروني</Label>
            <Textarea value={brandForm.emailSignature} onChange={(e) => updateBrand("emailSignature", e.target.value)} placeholder="مثال: مع أطيب التحيات — فريق شركة التقنية المتقدمة" rows={2} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />رابط الموقع الإلكتروني</Label>
            <Input value={brandForm.websiteUrl} onChange={(e) => updateBrand("websiteUrl", e.target.value)} placeholder="https://www.example.com" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />هاتف الدعم الفني</Label>
            <Input value={brandForm.supportPhone} onChange={(e) => updateBrand("supportPhone", e.target.value)} placeholder="+966 xx xxx xxxx" dir="ltr" />
          </div>
        </CardContent>
      </Card>

      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle className="text-lg">البيانات الأساسية</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>اسم الشركة (عربي) *</Label>
            <Input value={data.name} onChange={(e) => update("name", e.target.value)} placeholder="مثال: شركة النجاح للتقنية" />
          </div>
          <div className="space-y-2">
            <Label>اسم الشركة (إنجليزي)</Label>
            <Input value={data.name_en} onChange={(e) => update("name_en", e.target.value)} placeholder="e.g. Success Tech Co." dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input type="email" value={data.email} onChange={(e) => update("email", e.target.value)} placeholder="info@company.sa" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>رقم الهاتف</Label>
            <Input value={data.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+966 5x xxx xxxx" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>القطاع</Label>
            <Input value={data.industry} onChange={(e) => update("industry", e.target.value)} placeholder="مثال: تقنية المعلومات" />
          </div>
        </CardContent>
      </Card>

      {/* Legal / Tax Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            البيانات النظامية والضريبية
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>رقم السجل التجاري *</Label>
            <Input value={data.cr_number} onChange={(e) => update("cr_number", e.target.value)} placeholder="10xxxxxxxx" dir="ltr" />
            <p className="text-[10px] text-muted-foreground">مطلوب لإصدار فواتير ZATCA</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              الرقم الضريبي (VAT) *
              {data.vat_number !== originalVatNumber && data.vat_number && (
                <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200">تم التعديل</Badge>
              )}
            </Label>
            <Input value={data.vat_number} onChange={(e) => update("vat_number", e.target.value)} placeholder="3xxxxxxxxxxxxxxx" dir="ltr" />
            <p className="text-[10px] text-muted-foreground">15 رقماً يبدأ بـ 3 — تغيير الرقم يُعيد فحص ZATCA تلقائياً</p>
          </div>
        </CardContent>
      </Card>

      {/* National Address (ZATCA requirement) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">العنوان الوطني</CardTitle>
          <p className="text-xs text-muted-foreground">مطلوب للامتثال لمتطلبات ZATCA Phase 2</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>الشارع</Label>
            <Input value={data.address_street} onChange={(e) => update("address_street", e.target.value)} placeholder="مثال: شارع الملك فهد" />
          </div>
          <div className="space-y-2">
            <Label>رقم المبنى</Label>
            <Input value={data.building_number} onChange={(e) => update("building_number", e.target.value)} placeholder="1234" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>الحي</Label>
            <Input value={data.address_district} onChange={(e) => update("address_district", e.target.value)} placeholder="مثال: حي العليا" />
          </div>
          <div className="space-y-2">
            <Label>المدينة</Label>
            <Input value={data.address_city} onChange={(e) => update("address_city", e.target.value)} placeholder="مثال: الرياض" />
          </div>
          <div className="space-y-2">
            <Label>الرمز البريدي</Label>
            <Input value={data.address_zip} onChange={(e) => update("address_zip", e.target.value)} placeholder="12345" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>الرقم الإضافي</Label>
            <Input value={data.additional_number} onChange={(e) => update("additional_number", e.target.value)} placeholder="6789" dir="ltr" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanySettings;
