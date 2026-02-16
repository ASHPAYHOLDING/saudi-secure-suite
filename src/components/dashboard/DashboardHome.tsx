import { motion } from "framer-motion";
import { Users, FileText, TrendingUp, CreditCard, ArrowUpLeft, ArrowDownLeft } from "lucide-react";

const stats = [
  {
    label: "إجمالي المستخدمين",
    value: "1,248",
    change: "+12%",
    up: true,
    icon: Users,
  },
  {
    label: "المعاملات اليوم",
    value: "340",
    change: "+8%",
    up: true,
    icon: FileText,
  },
  {
    label: "الإيرادات الشهرية",
    value: "45,200",
    suffix: "ر.س",
    change: "+22%",
    up: true,
    icon: TrendingUp,
  },
  {
    label: "الفواتير المعلقة",
    value: "18",
    change: "-5%",
    up: false,
    icon: CreditCard,
  },
];

const recentActivity = [
  { user: "سارة العتيبي", action: "أضافت مستخدم جديد", time: "منذ 5 دقائق" },
  { user: "محمد الدوسري", action: "أنشأ فاتورة #1024", time: "منذ 12 دقيقة" },
  { user: "نورة القحطاني", action: "حدّثت إعدادات الشركة", time: "منذ 30 دقيقة" },
  { user: "خالد الشمري", action: "صدّر تقرير شهري", time: "منذ ساعة" },
  { user: "فهد المطيري", action: "أضاف تكامل جديد", time: "منذ ساعتين" },
];

const DashboardHome = () => {
  return (
    <div dir="rtl" className="space-y-8 p-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">مرحباً، أحمد 👋</h1>
        <p className="text-sm text-muted-foreground">إليك نظرة عامة على أداء منصتك اليوم</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="stat-card"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <stat.icon size={20} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium ${stat.up ? "text-success" : "text-destructive"}`}>
                {stat.up ? <ArrowUpLeft size={14} /> : <ArrowDownLeft size={14} />}
                <span className="font-english">{stat.change}</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground font-english">
              {stat.value}
              {stat.suffix && <span className="mr-1 text-sm font-normal text-muted-foreground">{stat.suffix}</span>}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 rounded-xl border border-border bg-card p-6 shadow-card"
        >
          <h3 className="mb-5 text-sm font-semibold text-foreground">آخر النشاطات</h3>
          <div className="space-y-4">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <span className="text-xs font-bold">{item.user[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.user}</p>
                    <p className="text-xs text-muted-foreground">{item.action}</p>
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{item.time}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-border bg-card p-6 shadow-card"
        >
          <h3 className="mb-5 text-sm font-semibold text-foreground">معلومات الحساب</h3>
          <div className="space-y-4">
            {[
              { label: "اسم الشركة", value: "شركة التقنية المتقدمة" },
              { label: "الخطة الحالية", value: "احترافي", accent: true },
              { label: "عدد المستخدمين", value: "12 / 25" },
              { label: "التخزين", value: "23.5 / 50 جيجا" },
              { label: "تاريخ التجديد", value: "15 مارس 2026" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className={`text-sm font-medium ${item.accent ? "text-accent" : "text-foreground"}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardHome;
