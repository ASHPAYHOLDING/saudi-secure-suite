import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const SECTORS = [
  { value: "retail", label: "تجارة تجزئة" },
  { value: "wholesale", label: "تجارة جملة" },
  { value: "services", label: "خدمات" },
  { value: "contracting", label: "مقاولات" },
  { value: "technology", label: "تقنية معلومات" },
  { value: "healthcare", label: "رعاية صحية" },
  { value: "education", label: "تعليم" },
  { value: "food", label: "أغذية ومشروبات" },
  { value: "real_estate", label: "عقارات" },
  { value: "manufacturing", label: "تصنيع" },
  { value: "consulting", label: "استشارات" },
  { value: "other", label: "أخرى" },
];

interface Props {
  onValidChange: (valid: boolean) => void;
  onSubmit: (data: Record<string, any>) => Promise<void>;
}

export default function StepCompanyInfo({ onValidChange, onSubmit }: Props) {
  const { tenantId } = useAuth();
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("tenants")
      .select("name, industry, vat_number, logo_url")
      .eq("id", tenantId)
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.name || "");
          setSector(data.industry || "");
          setVatNumber(data.vat_number || "");
          if (data.logo_url) setLogoPreview(data.logo_url);
        }
      });
  }, [tenantId]);

  const isValid = name.trim().length >= 2 && sector.length > 0;

  useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size <= 2 * 1024 * 1024) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !tenantId) return;

    let logoUrl: string | undefined;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `${tenantId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("tenant-assets")
        .upload(path, logoFile, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("tenant-assets")
          .getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }
    }

    await supabase
      .from("tenants")
      .update({
        name,
        industry: sector,
        vat_number: vatNumber || null,
        ...(logoUrl ? { logo_url: logoUrl } : {}),
      })
      .eq("id", tenantId);

    await onSubmit({ name, sector, vatNumber });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
          <Building2 className="w-7 h-7 text-primary" />
        </div>
        <CardTitle className="text-xl">بيانات الشركة</CardTitle>
        <CardDescription>أدخل المعلومات الأساسية لشركتك</CardDescription>
      </CardHeader>
      <CardContent>
        <form data-onboarding-form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="company-name">اسم الشركة *</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: شركة النور للتجارة"
              maxLength={100}
              required
            />
            {name.length > 0 && name.trim().length < 2 && (
              <p className="text-xs text-destructive">يجب أن يكون الاسم حرفين على الأقل</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>القطاع / النشاط *</Label>
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger>
                <SelectValue placeholder="اختر القطاع" />
              </SelectTrigger>
              <SelectContent>
                {SECTORS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vat-number">الرقم الضريبي (اختياري)</Label>
            <Input
              id="vat-number"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="15 رقم"
              maxLength={15}
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label>شعار الشركة (اختياري)</Label>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <img src={logoPreview} alt="شعار" className="w-16 h-16 rounded-xl object-contain border bg-card" />
              ) : (
                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <label className="cursor-pointer text-sm text-primary hover:underline">
                {logoPreview ? "تغيير الشعار" : "رفع شعار"}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleLogoChange} />
              </label>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
