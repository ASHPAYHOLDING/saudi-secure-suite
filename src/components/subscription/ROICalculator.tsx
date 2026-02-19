import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingUp, Clock, DollarSign, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

const ROICalculator = () => {
  const [teamSize, setTeamSize] = useState(5);
  const [invoicesPerMonth, setInvoicesPerMonth] = useState(100);
  const [hoursOnAccounting, setHoursOnAccounting] = useState(20);

  const roi = useMemo(() => {
    // Average Saudi market rates
    const avgHourlyCost = 75; // SAR per hour for accounting work
    const manualInvoiceTime = 15; // minutes per invoice manually
    const automatedInvoiceTime = 2; // minutes per invoice with system
    const errorRate = 0.05; // 5% error rate manually
    const errorCostPerInvoice = 50; // SAR cost per error

    // Time saved
    const manualHours = (invoicesPerMonth * manualInvoiceTime) / 60;
    const automatedHours = (invoicesPerMonth * automatedInvoiceTime) / 60;
    const hoursSaved = Math.round(manualHours - automatedHours);

    // Money saved from time
    const timeSavings = hoursSaved * avgHourlyCost;

    // Money saved from errors
    const errorSavings = Math.round(invoicesPerMonth * errorRate * errorCostPerInvoice);

    // Productivity gain per team member
    const productivityGain = Math.round((hoursSaved / (teamSize * hoursOnAccounting)) * 100);

    // Monthly ROI
    const monthlyROI = timeSavings + errorSavings;
    const yearlyROI = monthlyROI * 12;

    return {
      hoursSaved,
      timeSavings,
      errorSavings,
      monthlyROI,
      yearlyROI,
      productivityGain: Math.min(productivityGain, 95),
    };
  }, [teamSize, invoicesPerMonth, hoursOnAccounting]);

  return (
    <Card className="rounded-2xl border-accent/10 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-l from-accent via-accent/60 to-accent/30" />
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator size={18} className="text-accent" />
          حاسبة العائد على الاستثمار (ROI)
        </CardTitle>
        <CardDescription>اكتشف كم ستوفر من الوقت والمال مع نيوماكسيو</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Users size={14} className="text-accent" />
                حجم الفريق
              </label>
              <Badge variant="outline" className="text-xs tabular-nums">{teamSize}</Badge>
            </div>
            <Slider
              value={[teamSize]}
              onValueChange={([v]) => setTeamSize(v)}
              min={1}
              max={50}
              step={1}
              className="[&>span>span]:bg-accent"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <DollarSign size={14} className="text-accent" />
                فواتير / شهر
              </label>
              <Badge variant="outline" className="text-xs tabular-nums">{invoicesPerMonth}</Badge>
            </div>
            <Slider
              value={[invoicesPerMonth]}
              onValueChange={([v]) => setInvoicesPerMonth(v)}
              min={10}
              max={1000}
              step={10}
              className="[&>span>span]:bg-accent"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Clock size={14} className="text-accent" />
                ساعات محاسبة / شهر
              </label>
              <Badge variant="outline" className="text-xs tabular-nums">{hoursOnAccounting}</Badge>
            </div>
            <Slider
              value={[hoursOnAccounting]}
              onValueChange={([v]) => setHoursOnAccounting(v)}
              min={5}
              max={160}
              step={5}
              className="[&>span>span]:bg-accent"
            />
          </div>
        </div>

        {/* Results */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "ساعات موفّرة / شهر", value: `${roi.hoursSaved}`, suffix: "ساعة", icon: Clock, color: "text-accent" },
            { label: "توفير شهري", value: roi.monthlyROI.toLocaleString("ar-SA"), suffix: "ر.س", icon: DollarSign, color: "text-emerald-600" },
            { label: "توفير سنوي", value: roi.yearlyROI.toLocaleString("ar-SA"), suffix: "ر.س", icon: TrendingUp, color: "text-primary" },
            { label: "زيادة الإنتاجية", value: `${roi.productivityGain}`, suffix: "%", icon: TrendingUp, color: "text-amber-600" },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="rounded-xl bg-muted/30 border border-border/30 p-4 text-center space-y-1"
            >
              <stat.icon size={18} className={`mx-auto ${stat.color}`} />
              <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                {stat.value}
                <span className="text-xs font-normal text-muted-foreground mr-1">{stat.suffix}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="rounded-xl bg-accent/5 border border-accent/10 p-4 text-center">
          <p className="text-sm text-foreground">
            💡 بناءً على حجم أعمالك، نيوماكسيو يوفر لك ما يقارب{" "}
            <span className="font-bold text-accent">{roi.yearlyROI.toLocaleString("ar-SA")} ر.س سنوياً</span>
            {" "}و <span className="font-bold text-accent">{roi.hoursSaved * 12} ساعة عمل</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ROICalculator;
