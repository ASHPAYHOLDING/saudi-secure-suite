import { motion } from "framer-motion";
import { TrendingUp, PieChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from "recharts";

interface ChartsSectionProps {
  monthlyData: { month: string; revenue: number; expenses: number }[];
  invoiceDistribution: { name: string; value: number; color: string }[];
  sar: string;
}

const ChartsSection = ({ monthlyData, invoiceDistribution, sar }: ChartsSectionProps) => {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Revenue Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="lg:col-span-2"
      >
        <Card className="border-border/60 h-full">
          <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-5">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" /> الإيرادات والمصروفات
              <Badge variant="secondary" className="text-[10px] ms-auto">آخر ٦ أشهر</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-4 pb-4">
            <div className="h-[200px] sm:h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12, direction: "rtl" }}
                    formatter={(value: number) => [value.toLocaleString("ar-SA") + " " + sar, ""]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" fill="url(#revGrad)" strokeWidth={2} name="الإيرادات" />
                  <Area type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" fill="url(#expGrad)" strokeWidth={2} name="المصروفات" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Invoice Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-border/60 h-full">
          <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-5">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4 text-accent" /> توزيع الفواتير
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4">
            {invoiceDistribution.length > 0 ? (
              <>
                <div className="h-[140px] sm:h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={invoiceDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {invoiceDistribution.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, ""]} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 justify-center mt-2">
                  {invoiceDistribution.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-[11px] text-muted-foreground">{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[180px] text-muted-foreground">
                <PieChart className="w-10 h-10 opacity-30 mb-2" />
                <p className="text-xs">لا توجد فواتير بعد</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ChartsSection;
