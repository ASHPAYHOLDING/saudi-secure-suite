import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Banknote } from "lucide-react";

interface Props {
  payslips: any[];
  loading: boolean;
}

const MONTHS_AR = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "bg-muted text-muted-foreground" },
  approved: { label: "معتمد", cls: "bg-info/10 text-info" },
  paid: { label: "مدفوع", cls: "bg-success/10 text-success" },
};

const fmt = (n: number | null) => (n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2 });

const EssPayslipTab = ({ payslips, loading }: Props) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 mb-2">
      <Banknote size={18} className="text-primary" />
      <h3 className="text-base font-bold text-foreground">كشوف الرواتب</h3>
    </div>

    {loading ? (
      <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
    ) : payslips.length === 0 ? (
      <p className="text-center text-muted-foreground py-8">لا توجد كشوف رواتب</p>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {payslips.map((p: any) => {
          const st = STATUS_MAP[p.status] || { label: p.status, cls: "bg-muted text-muted-foreground" };
          return (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    {MONTHS_AR[p.period_month]} {p.period_year}
                  </CardTitle>
                  <Badge className={st.cls}>{st.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="الراتب الأساسي" value={fmt(p.basic_salary)} />
                <Row label="بدل السكن" value={fmt(p.housing_allowance)} />
                <Row label="بدل النقل" value={fmt(p.transport_allowance)} />
                <Row label="بدلات أخرى" value={fmt(p.other_allowances)} />
                <div className="border-t border-border/50 my-1.5" />
                <Row label="الاستقطاعات" value={fmt(p.deductions)} negative />
                <Row label="GOSI (موظف)" value={fmt(p.gosi_employee)} negative />
                <div className="border-t border-border my-1.5" />
                <div className="flex justify-between items-center font-bold">
                  <span className="text-foreground">صافي الراتب</span>
                  <span className="text-primary text-base">{fmt(p.net_salary)} ر.س</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    )}
  </div>
);

const Row = ({ label, value, negative }: { label: string; value: string; negative?: boolean }) => (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className={negative ? "text-destructive" : "text-foreground"}>{negative ? `-${value}` : value}</span>
  </div>
);

export default EssPayslipTab;
