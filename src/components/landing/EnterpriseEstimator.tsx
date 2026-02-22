import { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Users, Building2, Headset } from "lucide-react";

const toArabicDigits = (num: number): string => {
  const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return num
    .toLocaleString("en-US")
    .replace(/\d/g, (d) => arabicNumerals[parseInt(d)]);
};

const EnterpriseEstimator = () => {
  const [users, setUsers] = useState(25);
  const [entities, setEntities] = useState(3);
  const [onboarding, setOnboarding] = useState(true);

  const estimatedPrice = useMemo(() => {
    let price = 1999;
    if (users > 25) price += ((users - 25) / 5) * 60;
    price += (entities - 1) * 250;
    if (onboarding) price += 600;
    price = Math.round(price / 10) * 10;
    if (price > 14990) price = 14990;
    return price;
  }, [users, entities, onboarding]);

  const showContactForMore = useMemo(() => {
    let raw = 1999;
    if (users > 25) raw += ((users - 25) / 5) * 60;
    raw += (entities - 1) * 250;
    if (onboarding) raw += 600;
    return raw > 14990;
  }, [users, entities, onboarding]);

  return (
    <div className="space-y-4">
      {/* Slider 1: Users */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-foreground">
            <Users size={13} className="text-accent" />
            عدد المستخدمين
          </Label>
          <span className="text-xs sm:text-sm font-bold text-accent tabular-nums">
            {toArabicDigits(users)}
          </span>
        </div>
        <Slider
          min={5}
          max={200}
          step={5}
          value={[users]}
          onValueChange={([v]) => setUsers(v)}
          className="w-full"
          aria-label="عدد المستخدمين"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>٥</span>
          <span>٢٠٠</span>
        </div>
      </div>

      {/* Slider 2: Entities */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-foreground">
            <Building2 size={13} className="text-accent" />
            عدد الكيانات
          </Label>
          <span className="text-xs sm:text-sm font-bold text-accent tabular-nums">
            {toArabicDigits(entities)}
          </span>
        </div>
        <Slider
          min={1}
          max={20}
          step={1}
          value={[entities]}
          onValueChange={([v]) => setEntities(v)}
          className="w-full"
          aria-label="عدد الكيانات"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>١</span>
          <span>٢٠</span>
        </div>
      </div>

      {/* Toggle: Onboarding */}
      <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
        <Label
          htmlFor="onboarding-toggle"
          className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-foreground cursor-pointer"
        >
          <Headset size={13} className="text-accent" />
          دعم مخصص + Onboarding
        </Label>
        <Switch
          id="onboarding-toggle"
          checked={onboarding}
          onCheckedChange={setOnboarding}
          aria-label="دعم مخصص و Onboarding"
        />
      </div>

      {/* Output */}
      <div className="rounded-xl bg-accent/5 border border-accent/15 p-3 sm:p-4 text-center space-y-1.5">
        <p className="text-[11px] sm:text-xs font-semibold text-accent">
          سعر تقديري
        </p>
        <p className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground tabular-nums">
          ≈ {toArabicDigits(estimatedPrice)} ر.س
          <span className="text-xs sm:text-sm font-medium text-muted-foreground me-1">
            {" "}/ شهرياً
          </span>
        </p>
        {showContactForMore && (
          <p className="text-[10px] sm:text-[11px] text-accent font-medium">
            للاحتياجات الأكبر، اطلب عرض سعر مخصص
          </p>
        )}
        <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed pt-1">
          هذا تقدير مبدئي. السعر النهائي يعتمد على المتطلبات وحجم البيانات والتكاملات.
        </p>
      </div>
    </div>
  );
};

export default EnterpriseEstimator;
