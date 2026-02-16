import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Building2, Save, Upload, Loader2 } from "lucide-react";

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
  logo_url: string;
  industry: string;
}

const CompanySettings = () => {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [data, setData] = useState<CompanyData>({
    name: "",
    name_en: "",
    email: "",
    phone: "",
    cr_number: "",
    vat_number: "",
    address_street: "",
    address_city: "",
    address_zip: "",
    logo_url: "",
    industry: "",
  });

  useEffect(() => {
    if (tenantId) fetchCompany();
  }, [tenantId]);

  const fetchCompany = async () => {
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("name, name_en, email, phone, cr_number, vat_number, address_street, address_city, address_zip, logo_url, industry")
      .eq("id", tenantId!)
      .single();

    if (error) {
      toast.error("خطأ في تحميل بيانات الشركة");
    } else if (tenant) {
      setData({
        name: tenant.name || "",
        name_en: tenant.name_en || "",
        email: tenant.email || "",
        phone: tenant.phone || "",
        cr_number: tenant.cr_number || "",
        vat_number: tenant.vat_number || "",
        address_street: tenant.address_street || "",
        address_city: tenant.address_city || "",
        address_zip: tenant.address_zip || "",
        logo_url: tenant.logo_url || "",
        industry: tenant.industry || "",
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
        name: data.name,
        name_en: data.name_en || null,
        email: data.email || null,
        phone: data.phone || null,
        cr_number: data.cr_number || null,
        vat_number: data.vat_number || null,
        address_street: data.address_street || null,
        address_city: data.address_city || null,
        address_zip: data.address_zip || null,
        industry: data.industry || null,
      })
      .eq("id", tenantId);

    setSaving(false);
    if (error) {
      toast.error("فشل حفظ البيانات: " + error.message);
    } else {
      toast.success("تم حفظ بيانات الشركة بنجاح");
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("يرجى اختيار ملف صورة");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 2 ميجابايت");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${tenantId}/logo.${ext}`;

    // Check if bucket exists, use tenant-stamps bucket for now
    const { error: uploadError } = await supabase.storage
      .from("tenant-stamps")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("فشل رفع الشعار: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("tenant-stamps")
      .getPublicUrl(filePath);

    const logoUrl = urlData.publicUrl;

    const { error: updateError } = await supabase
      .from("tenants")
      .update({ logo_url: logoUrl })
      .eq("id", tenantId);

    setUploading(false);
    if (updateError) {
      toast.error("فشل تحديث رابط الشعار");
    } else {
      setData((prev) => ({ ...prev, logo_url: logoUrl }));
      toast.success("تم رفع الشعار بنجاح");
    }
  };

  const update = (field: keyof CompanyData, value: string) =>
    setData((prev) => ({ ...prev, [field]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">إعدادات الشركة</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
          حفظ التغييرات
        </Button>
      </div>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">شعار الشركة</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
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

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">البيانات الأساسية</CardTitle>
        </CardHeader>
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

      {/* Legal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">البيانات النظامية</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>رقم السجل التجاري</Label>
            <Input value={data.cr_number} onChange={(e) => update("cr_number", e.target.value)} placeholder="10xxxxxxxx" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>الرقم الضريبي (VAT)</Label>
            <Input value={data.vat_number} onChange={(e) => update("vat_number", e.target.value)} placeholder="3xxxxxxxxxxxxxxx" dir="ltr" />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">العنوان</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>الشارع</Label>
            <Input value={data.address_street} onChange={(e) => update("address_street", e.target.value)} placeholder="مثال: شارع الملك فهد" />
          </div>
          <div className="space-y-2">
            <Label>المدينة</Label>
            <Input value={data.address_city} onChange={(e) => update("address_city", e.target.value)} placeholder="مثال: الرياض" />
          </div>
          <div className="space-y-2">
            <Label>الرمز البريدي</Label>
            <Input value={data.address_zip} onChange={(e) => update("address_zip", e.target.value)} placeholder="12345" dir="ltr" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanySettings;
