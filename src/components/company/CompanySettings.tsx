import { useEffect, useState, useCallback, useRef } from "react";
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
  Shield, CheckCircle2, Clock, AlertTriangle, XCircle, RefreshCw, Wifi,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import FinanceControlPanel from "@/components/company/FinanceControlPanel";
import EmailPreferencesPanel from "@/components/company/EmailPreferencesPanel";
import SecuritySettingsPanel from "@/components/company/SecuritySettingsPanel";
import { useSmartSaveSettingsCAS } from "@/hooks/useSmartSaveSettingsCAS";
import {
  ConflictResolutionModal,
  RemoteChangeBanner,
  SaveStatusBadge,
} from "@/components/company/ConflictResolutionModal";
import type { BrandingConfig } from "@/contexts/BrandingContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyData {
  name: string; name_en: string; email: string; phone: string;
  cr_number: string; vat_number: string; address_street: string;
  address_city: string; address_zip: string; building_number: string;
  address_district: string; additional_number: string; logo_url: string; industry: string;
}

type ZatcaStatus = "connected" | "pending" | "expired" | "error" | "disconnected";

interface ZatcaSettingsData {
  zatca_status: ZatcaStatus;
  last_credential_refresh: string | null;
  last_error: string | null;
  credential_metadata: any;
}

// ─── ZATCA status config ──────────────────────────────────────────────────────
const ZATCA_STATUS_CONFIG: Record<ZatcaStatus, { label: string; icon: React.ReactNode; color: string }> = {
  connected:    { label: "متصل",              icon: <CheckCircle2 size={14} />, color: "bg-accent/10 text-accent border-accent/20" },
  pending:      { label: "قيد المعالجة",      icon: <Clock size={14} />,        color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  expired:      { label: "منتهي الصلاحية",   icon: <AlertTriangle size={14} />, color: "bg-destructive/10 text-destructive border-destructive/20" },
  error:        { label: "خطأ",               icon: <XCircle size={14} />,      color: "bg-destructive/10 text-destructive border-destructive/20" },
  disconnected: { label: "غير متصل",          icon: <Wifi size={14} />,         color: "bg-muted text-muted-foreground border-border" },
};

// ─── Default brand config ─────────────────────────────────────────────────────
const DEFAULT_BRAND: BrandingConfig = {
  primary_color: "#0f4c81",
  secondary_color: "#1a9b8a",
  font_family: "IBM Plex Sans Arabic",
  invoice_footer_text: "",
  email_signature: "",
  website_url: "",
  support_phone: "",
};

// ─── Component ────────────────────────────────────────────────────────────────
const CompanySettings = () => {
  const { tenantId } = useAuth();
  const { branding, updateBranding, saving: brandingSaving } = useBranding();

  const [loading, setLoading]               = useState(true);
  const [uploading, setUploading]           = useState(false);
  const [refreshingZatca, setRefreshingZatca] = useState(false);
  const [showConflict, setShowConflict]     = useState(false);

  const [companyData, setCompanyData] = useState<CompanyData>({
    name: "", name_en: "", email: "", phone: "", cr_number: "",
    vat_number: "", address_street: "", address_city: "", address_zip: "",
    building_number: "", address_district: "", additional_number: "",
    logo_url: "", industry: "",
  });
  const [originalVatNumber, setOriginalVatNumber] = useState("");

  const [zatcaSettings, setZatcaSettings] = useState<ZatcaSettingsData>({
    zatca_status: "disconnected",
    last_credential_refresh: null,
    last_error: null,
    credential_metadata: {},
  });

  // ── CAS for branding config (tenant_settings) ──────────────────────────────
  const [initialBrand, setInitialBrand]       = useState<BrandingConfig>(DEFAULT_BRAND);
  const [initialVersion, setInitialVersion]   = useState(1);
  const [brandLoaded, setBrandLoaded]         = useState(false);

  const cas = useSmartSaveSettingsCAS<BrandingConfig>({
    tenantId,
    initialConfig: initialBrand,
    initialVersion,
    debounceMs: 1400,
  });

  // Show conflict modal when status hits "conflict"
  useEffect(() => {
    if (cas.status === "conflict") setShowConflict(true);
  }, [cas.status]);

  // ── Load company + branding ────────────────────────────────────────────────
  const fetchCompany = useCallback(async () => {
    if (!tenantId) return;
    const [tenantRes, settingsRes, zatcaRes] = await Promise.all([
      supabase
        .from("tenants")
        .select("name, name_en, email, phone, cr_number, vat_number, address_street, address_city, address_zip, logo_url, industry, building_number, address_district, additional_number")
        .eq("id", tenantId)
        .single(),
      (supabase.from("tenant_settings" as any)
        .select("branding_config, version")
        .eq("tenant_id", tenantId)
        .maybeSingle() as any),
      (supabase.from("zatca_settings" as any)
        .select("zatca_status, last_credential_refresh, last_error, credential_metadata")
        .eq("tenant_id", tenantId)
        .maybeSingle() as any),
    ]);

    if (tenantRes.data) {
      const t = tenantRes.data as any;
      const d: CompanyData = {
        name: t.name || "", name_en: t.name_en || "",
        email: t.email || "", phone: t.phone || "",
        cr_number: t.cr_number || "", vat_number: t.vat_number || "",
        address_street: t.address_street || "", address_city: t.address_city || "",
        address_zip: t.address_zip || "", building_number: t.building_number || "",
        address_district: t.address_district || "", additional_number: t.additional_number || "",
        logo_url: t.logo_url || "", industry: t.industry || "",
      };
      setCompanyData(d);
      setOriginalVatNumber(t.vat_number || "");
    }
    if (tenantRes.error) toast.error("خطأ في تحميل بيانات الشركة");

    const sRow = settingsRes.data as any;
    const loadedConfig: BrandingConfig = {
      ...DEFAULT_BRAND,
      ...(sRow?.branding_config || {}),
    };
    const loadedVersion: number = sRow?.version ?? 1;
    setInitialBrand(loadedConfig);
    setInitialVersion(loadedVersion);
    setBrandLoaded(true);

    if (zatcaRes.data) {
      const z = zatcaRes.data as any;
      setZatcaSettings({
        zatca_status: z.zatca_status || "disconnected",
        last_credential_refresh: z.last_credential_refresh,
        last_error: z.last_error,
        credential_metadata: z.credential_metadata || {},
      });
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchCompany(); }, [fetchCompany]);

  // Sync branding context → CAS draft on first load
  useEffect(() => {
    if (!brandLoaded) return;
    // handled by initialConfig in hook
  }, [brandLoaded]);

  // Sync branding context → draft for colors already applied
  useEffect(() => {
    if (!brandLoaded) return;
    // When branding context updates (e.g. logo upload), reflect in CAS draft
  }, [branding, brandLoaded]);

  // ── ZATCA realtime ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase
      .channel(`zatca-status-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "zatca_settings", filter: `tenant_id=eq.${tenantId}` },
        (payload: any) => {
          const n = payload.new;
          if (n) setZatcaSettings({ zatca_status: n.zatca_status || "disconnected", last_credential_refresh: n.last_credential_refresh, last_error: n.last_error, credential_metadata: n.credential_metadata || {} });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId]);

  // ── Save company data (tenants table) ─────────────────────────────────────
  const handleSaveCompany = useCallback(async () => {
    if (!tenantId) return;
    const { error } = await supabase.from("tenants").update({
      name: companyData.name, name_en: companyData.name_en || null,
      email: companyData.email || null, phone: companyData.phone || null,
      cr_number: companyData.cr_number || null, vat_number: companyData.vat_number || null,
      address_street: companyData.address_street || null, address_city: companyData.address_city || null,
      address_zip: companyData.address_zip || null, building_number: companyData.building_number || null,
      address_district: companyData.address_district || null, additional_number: companyData.additional_number || null,
      industry: companyData.industry || null,
    }).eq("id", tenantId);

    if (error) toast.error("فشل حفظ البيانات: " + error.message);
    else {
      toast.success("تم حفظ بيانات الشركة");
      if (companyData.vat_number !== originalVatNumber && companyData.vat_number) {
        await triggerZatcaRegeneration();
        setOriginalVatNumber(companyData.vat_number);
      }
    }
  }, [tenantId, companyData, originalVatNumber]);

  const triggerZatcaRegeneration = useCallback(async () => {
    if (!tenantId || !companyData.vat_number) return;
    setRefreshingZatca(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("regenerate-zatca-credentials", {
        body: { tenantId, vatNumber: companyData.vat_number },
      });
      if (error) throw error;
      if (result?.status) setZatcaSettings(prev => ({ ...prev, zatca_status: result.status, last_error: result.error }));
      toast.success("تم تحديث حالة ZATCA");
    } catch (err: any) {
      toast.error("فشل تحديث ZATCA: " + (err.message || "خطأ"));
    }
    setRefreshingZatca(false);
  }, [tenantId, companyData.vat_number]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    if (!file.type.startsWith("image/")) { toast.error("يرجى اختيار ملف صورة"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("حجم الصورة يجب أن يكون أقل من 2 ميجابايت"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${tenantId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from("tenant-stamps").upload(filePath, file, { upsert: true });
    if (uploadError) { toast.error("فشل رفع الشعار: " + uploadError.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("tenant-stamps").getPublicUrl(filePath);
    const logoUrl = urlData.publicUrl;
    const { error: updateError } = await supabase.from("tenants").update({ logo_url: logoUrl }).eq("id", tenantId);
    setUploading(false);
    if (updateError) toast.error("فشل تحديث رابط الشعار");
    else { setCompanyData(prev => ({ ...prev, logo_url: logoUrl })); updateBranding({ logoUrl }); toast.success("تم رفع الشعار بنجاح"); }
  };

  const updateCompany = (field: keyof CompanyData, value: string) =>
    setCompanyData(prev => ({ ...prev, [field]: value }));

  const updateBrand = (field: keyof BrandingConfig, value: string) => {
    cas.setField(field, value);
    // Keep branding context in sync for live preview
    const keyMap: Partial<Record<keyof BrandingConfig, string>> = {
      primary_color: "primaryColor",
      secondary_color: "secondaryColor",
      font_family: "font",
      invoice_footer_text: "invoiceFooterText",
      email_signature: "emailSignature",
      website_url: "websiteUrl",
      support_phone: "supportPhone",
    };
    const contextKey = keyMap[field];
    if (contextKey) updateBranding({ [contextKey]: value } as any);
  };

  const zatcaStatusConfig = ZATCA_STATUS_CONFIG[zatcaSettings.zatca_status] || ZATCA_STATUS_CONFIG.disconnected;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <div className="relative">
          <div className="h-14 w-14 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
          <Building2 size={18} className="absolute inset-0 m-auto text-accent" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">جاري تحميل إعدادات الشركة...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6" dir="rtl">

      {/* ── Remote change banner ── */}
      <AnimatePresence>
        {cas.remoteBanner && !showConflict && (
          <RemoteChangeBanner
            banner={cas.remoteBanner}
            onReview={() => { cas.reviewRemoteChanges(); setShowConflict(true); }}
            onDiscard={cas.discardDraft}
            onDismiss={cas.dismissBanner}
          />
        )}
      </AnimatePresence>

      {/* ── Conflict modal ── */}
      {showConflict && (
        <ConflictResolutionModal
          conflicts={cas.conflicts}
          onResolve={cas.resolveConflict}
          onSaveResolved={async () => { setShowConflict(false); await cas.resolveAndSave(); }}
          onClose={() => setShowConflict(false)}
        />
      )}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">إعدادات الشركة</h1>
            <div className="mt-0.5 h-5">
              <SaveStatusBadge status={cas.status} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {cas.isDirty && (
            <Button
              variant="outline"
              onClick={cas.saveNow}
              disabled={cas.status === "saving"}
              className="gap-2 rounded-xl"
            >
              {cas.status === "saving" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              حفظ الإعدادات الآن
            </Button>
          )}
          <Button onClick={handleSaveCompany} className="gap-2 rounded-xl">
            <Save size={14} /> حفظ بيانات الشركة
          </Button>
        </div>
      </div>

      {/* ── ZATCA Status ── */}
      <Card className="border-2" style={{ borderColor: zatcaSettings.zatca_status === "connected" ? "hsl(var(--accent))" : zatcaSettings.zatca_status === "error" || zatcaSettings.zatca_status === "expired" ? "hsl(var(--destructive))" : undefined }}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> حالة الامتثال الضريبي (ZATCA)</div>
            <div className="flex items-center gap-2">
              <Badge className={`gap-1.5 ${zatcaStatusConfig.color}`}>
                {zatcaStatusConfig.icon} {zatcaStatusConfig.label}
              </Badge>
              <Button variant="ghost" size="sm" onClick={triggerZatcaRegeneration}
                disabled={refreshingZatca || !companyData.vat_number} className="h-8 w-8 p-0 rounded-lg">
                {refreshingZatca ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "الحالة", content: <div className="flex items-center gap-1.5">{zatcaStatusConfig.icon}<span className="text-sm font-semibold text-foreground">{zatcaStatusConfig.label}</span></div> },
              { label: "آخر تحديث", content: <p className="text-sm font-semibold text-foreground">{zatcaSettings.last_credential_refresh ? new Date(zatcaSettings.last_credential_refresh).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</p> },
              { label: "الشهادات", content: <p className="text-sm font-semibold text-foreground">{zatcaSettings.credential_metadata?.certificates_count ?? 0} شهادة</p> },
            ].map(({ label, content }) => (
              <div key={label} className="rounded-lg border border-border p-3 bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                {content}
              </div>
            ))}
          </div>
          {zatcaSettings.last_error && (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{zatcaSettings.last_error}</p>
            </div>
          )}
          {companyData.vat_number !== originalVatNumber && companyData.vat_number && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 flex items-start gap-2">
              <Clock size={14} className="text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-800">تم تغيير الرقم الضريبي — سيتم تحديث بيانات ZATCA تلقائياً عند حفظ البيانات</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Logo ── */}
      <Card>
        <CardHeader><CardTitle className="text-lg">شعار الشركة</CardTitle></CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="h-24 w-24 shrink-0 rounded-xl border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
            {companyData.logo_url ? (
              <img src={companyData.logo_url} alt="شعار الشركة" className="h-full w-full object-contain" />
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

      {/* ── Branding / Visual Identity ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> الهوية البصرية</div>
            <SaveStatusBadge status={cas.status} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>اللون الأساسي</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={cas.draft.primary_color} onChange={e => updateBrand("primary_color", e.target.value)} className="h-10 w-14 rounded-lg border border-border cursor-pointer" />
                <Input value={cas.draft.primary_color} onChange={e => updateBrand("primary_color", e.target.value)} className="font-mono text-sm" dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>اللون الثانوي</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={cas.draft.secondary_color} onChange={e => updateBrand("secondary_color", e.target.value)} className="h-10 w-14 rounded-lg border border-border cursor-pointer" />
                <Input value={cas.draft.secondary_color} onChange={e => updateBrand("secondary_color", e.target.value)} className="font-mono text-sm" dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>الخط</Label>
              <Select value={cas.draft.font_family} onValueChange={v => updateBrand("font_family", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ARABIC_SAFE_FONTS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Live Preview */}
          <div className="rounded-xl border border-border p-4 space-y-2">
            <p className="text-xs text-muted-foreground mb-2">معاينة مباشرة</p>
            <div className="rounded-lg overflow-hidden" style={{ fontFamily: `'${cas.draft.font_family}', sans-serif` }}>
              <div className="p-4" style={{ background: cas.draft.primary_color, color: "#fff" }}>
                <div className="flex items-center gap-3">
                  {companyData.logo_url && (
                    <div className="h-10 w-10 rounded-lg bg-white/15 p-1 shrink-0">
                      <img src={companyData.logo_url} alt="" className="h-full w-full object-contain" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold">{companyData.name || "اسم الشركة"}</p>
                    <p className="text-xs opacity-70">{companyData.name_en || "Company Name"}</p>
                  </div>
                </div>
              </div>
              <div className="p-3 border-t" style={{ borderColor: cas.draft.secondary_color }}>
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: cas.draft.secondary_color, color: "#fff" }}>
                  نموذج ألوان العلامة التجارية
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Extended Branding Fields ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> بيانات الفواتير والتواصل
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />نص ذيل الفاتورة</Label>
            <Textarea value={cas.draft.invoice_footer_text} onChange={e => updateBrand("invoice_footer_text", e.target.value)} placeholder="مثال: شكراً لتعاملكم معنا — يرجى السداد خلال 30 يوماً" rows={2} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />توقيع البريد الإلكتروني</Label>
            <Textarea value={cas.draft.email_signature} onChange={e => updateBrand("email_signature", e.target.value)} placeholder="مثال: مع أطيب التحيات — فريق شركة التقنية المتقدمة" rows={2} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />رابط الموقع الإلكتروني</Label>
            <Input value={cas.draft.website_url} onChange={e => updateBrand("website_url", e.target.value)} placeholder="https://www.example.com" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />هاتف الدعم الفني</Label>
            <Input value={cas.draft.support_phone} onChange={e => updateBrand("support_phone", e.target.value)} placeholder="+966 xx xxx xxxx" dir="ltr" />
          </div>
        </CardContent>
      </Card>

      {/* ── Basic Info ── */}
      <Card>
        <CardHeader><CardTitle className="text-lg">البيانات الأساسية</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>اسم الشركة (عربي) *</Label>
            <Input value={companyData.name} onChange={e => updateCompany("name", e.target.value)} placeholder="مثال: شركة النجاح للتقنية" />
          </div>
          <div className="space-y-2">
            <Label>اسم الشركة (إنجليزي)</Label>
            <Input value={companyData.name_en} onChange={e => updateCompany("name_en", e.target.value)} placeholder="e.g. Success Tech Co." dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input type="email" value={companyData.email} onChange={e => updateCompany("email", e.target.value)} placeholder="info@company.sa" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>رقم الهاتف</Label>
            <Input value={companyData.phone} onChange={e => updateCompany("phone", e.target.value)} placeholder="+966 5x xxx xxxx" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>القطاع</Label>
            <Input value={companyData.industry} onChange={e => updateCompany("industry", e.target.value)} placeholder="مثال: تقنية المعلومات" />
          </div>
        </CardContent>
      </Card>

      {/* ── Legal / Tax ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> البيانات النظامية والضريبية
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>رقم السجل التجاري *</Label>
            <Input value={companyData.cr_number} onChange={e => updateCompany("cr_number", e.target.value)} placeholder="10xxxxxxxx" dir="ltr" />
            <p className="text-[10px] text-muted-foreground">مطلوب لإصدار فواتير ZATCA</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              الرقم الضريبي (VAT) *
              {companyData.vat_number !== originalVatNumber && companyData.vat_number && (
                <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200">تم التعديل</Badge>
              )}
            </Label>
            <Input value={companyData.vat_number} onChange={e => updateCompany("vat_number", e.target.value)} placeholder="3xxxxxxxxxxxxxxx" dir="ltr" />
            <p className="text-[10px] text-muted-foreground">15 رقماً يبدأ بـ 3 — تغيير الرقم يُعيد فحص ZATCA تلقائياً</p>
          </div>
        </CardContent>
      </Card>

      {/* ── National Address ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">العنوان الوطني</CardTitle>
          <p className="text-xs text-muted-foreground">مطلوب للامتثال لمتطلبات ZATCA Phase 2</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>الشارع</Label>
            <Input value={companyData.address_street} onChange={e => updateCompany("address_street", e.target.value)} placeholder="مثال: شارع الملك فهد" />
          </div>
          <div className="space-y-2">
            <Label>رقم المبنى</Label>
            <Input value={companyData.building_number} onChange={e => updateCompany("building_number", e.target.value)} placeholder="1234" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>الحي</Label>
            <Input value={companyData.address_district} onChange={e => updateCompany("address_district", e.target.value)} placeholder="مثال: حي العليا" />
          </div>
          <div className="space-y-2">
            <Label>المدينة</Label>
            <Input value={companyData.address_city} onChange={e => updateCompany("address_city", e.target.value)} placeholder="مثال: الرياض" />
          </div>
          <div className="space-y-2">
            <Label>الرمز البريدي</Label>
            <Input value={companyData.address_zip} onChange={e => updateCompany("address_zip", e.target.value)} placeholder="12345" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>الرقم الإضافي</Label>
            <Input value={companyData.additional_number} onChange={e => updateCompany("additional_number", e.target.value)} placeholder="6789" dir="ltr" />
          </div>
        </CardContent>
      </Card>

      <FinanceControlPanel />
      <EmailPreferencesPanel />
      <SecuritySettingsPanel />
    </div>
  );
};

export default CompanySettings;
