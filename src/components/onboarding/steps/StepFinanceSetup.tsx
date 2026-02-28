import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Banknote } from "lucide-react";

const CURRENCIES = [
  { value: "SAR", label: "ريال سعودي (SAR)" },
  { value: "AED", label: "درهم إماراتي (AED)" },
  { value: "USD", label: "دولار أمريكي (USD)" },
  { value: "EUR", label: "يورو (EUR)" },
  { value: "EGP", label: "جنيه مصري (EGP)" },
  { value: "KWD", label: "دينار كويتي (KWD)" },
  { value: "BHD", label: "دينار بحريني (BHD)" },
  { value: "QAR", label: "ريال قطري (QAR)" },
  { value: "OMR", label: "ريال عماني (OMR)" },
];

const currentYear = new Date().getFullYear();
const FISCAL_YEARS = [currentYear - 1, currentYear, currentYear + 1];

interface Props {
  onValidChange: (valid: boolean) => void;
  onSubmit: (data: Record<string, any>) => Promise<void>;
}

export default function StepFinanceSetup({ onValidChange, onSubmit }: Props) {
  const [currency, setCurrency] = useState("SAR");
  const [fiscalYear, setFiscalYear] = useState(String(currentYear));
  const [taxMethod, setTaxMethod] = useState("inclusive");

  const isValid = currency.length > 0 && fiscalYear.length > 0;

  useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    // Save preferences in step_data (no DB columns for these yet)
    await onSubmit({ currency, fiscalYear, taxMethod });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-3">
          <Banknote className="w-7 h-7 text-accent" />
        </div>
        <CardTitle className="text-xl">الإعدادات المالية</CardTitle>
        <CardDescription>اضبط العملة والسنة المالية وطريقة احتساب الضريبة</CardDescription>
      </CardHeader>
      <CardContent>
        <form data-onboarding-form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>العملة الافتراضية *</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>السنة المالية *</Label>
            <Select value={fiscalYear} onValueChange={setFiscalYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FISCAL_YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>طريقة احتساب الضريبة *</Label>
            <RadioGroup value={taxMethod} onValueChange={setTaxMethod} className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="inclusive" id="tax-inc" />
                <Label htmlFor="tax-inc" className="cursor-pointer flex-1">
                  <span className="font-medium">شاملة الضريبة</span>
                  <p className="text-xs text-muted-foreground mt-0.5">السعر يشمل ضريبة القيمة المضافة 15%</p>
                </Label>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="exclusive" id="tax-exc" />
                <Label htmlFor="tax-exc" className="cursor-pointer flex-1">
                  <span className="font-medium">غير شاملة الضريبة</span>
                  <p className="text-xs text-muted-foreground mt-0.5">تُضاف الضريبة على السعر الأساسي</p>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
