import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().trim().min(2, "اسم العميل مطلوب (حرفان على الأقل)"),
});

interface Props {
  onValidChange: (valid: boolean) => void;
  onSubmit: (data: Record<string, any>) => Promise<void>;
}

export default function StepFirstInvoice({ onValidChange, onSubmit }: Props) {
  const { tenantId } = useAuth();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isValid = customerName.trim().length >= 2;

  useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = customerSchema.safeParse({ name: customerName });
    if (!result.success) {
      setErrors({ name: result.error.errors[0].message });
      return;
    }
    if (!tenantId) return;

    const { error: custError } = await supabase.from("customers").insert({
      tenant_id: tenantId,
      name: customerName.trim(),
      phone: customerPhone || null,
    });

    if (custError) {
      setErrors({ name: "حدث خطأ أثناء إنشاء العميل" });
      return;
    }

    await onSubmit({ customerName, customerPhone });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center mb-3">
          <UserPlus className="w-7 h-7 text-warning" />
        </div>
        <CardTitle className="text-xl">أول عميل</CardTitle>
        <CardDescription>أضف أول عميل لك — يمكنك إنشاء الفاتورة لاحقاً من لوحة التحكم</CardDescription>
      </CardHeader>
      <CardContent>
        <form data-onboarding-form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="cust-name">اسم العميل *</Label>
            <Input
              id="cust-name"
              value={customerName}
              onChange={(e) => { setCustomerName(e.target.value); setErrors({}); }}
              placeholder="مثال: شركة الأمل"
              maxLength={100}
              required
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cust-phone">رقم الجوال (اختياري)</Label>
            <Input
              id="cust-phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value.replace(/[^\d+\s-]/g, ""))}
              placeholder="05xxxxxxxx"
              maxLength={20}
              dir="ltr"
            />
          </div>

          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-center">
            <FileText className="w-8 h-8 mx-auto text-primary/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              بعد إتمام الإعداد يمكنك إنشاء أول فاتورة مباشرة من
              <span className="text-primary font-medium"> لوحة التحكم</span>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
