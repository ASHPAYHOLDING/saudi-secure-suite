import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import {
  ArrowRight,
  Bell,
  Zap,
  FileText,
  Users,
  Package,
  BarChart3,
  Shield,
  Brain,
  CreditCard,
  Building2,
  Receipt,
  ClipboardCheck,
  Workflow,
  Lock,
  Globe,
  Landmark,
  CalendarClock,
  ChevronDown,
  Search,
  Filter,
  Rocket,
  MessageSquare,
  Database,
  RefreshCw,
  Gauge,
  History,
} from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";

/* ─── Types ─── */
interface Update {
  date: string;
  time: string;
  title: string;
  description: string;
  icon: React.ElementType;
  tag: "نظام جديد" | "تحسين" | "إصلاح" | "أداء";
}

const TAG_STYLES: Record<string, string> = {
  "نظام جديد": "bg-accent/10 text-accent",
  "تحسين": "bg-blue-500/10 text-blue-500",
  "إصلاح": "bg-amber-500/10 text-amber-500",
  "أداء": "bg-purple-500/10 text-purple-500",
};

/* ─── Data ─── */
const UPDATES: Update[] = [
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٩:٠٠ ص",
    title: "نظام الفوترة الإلكترونية",
    description: "إطلاق نظام الفوترة الإلكترونية المتوافق مع ZATCA المرحلة الأولى والثانية، مع QR Code والفواتير الضريبية المبسطة والتفصيلية.",
    icon: FileText,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٩:٣٠ ص",
    title: "نظام إدارة العملاء والموردين",
    description: "نظام شامل لإدارة بيانات العملاء والموردين مع سجل معاملات كامل، وربط تلقائي بالفواتير والمدفوعات وإدارة حدود الائتمان.",
    icon: Users,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "١٠:٠٠ ص",
    title: "نظام إدارة المخزون",
    description: "إدارة متكاملة للمخزون تشمل تتبع الأصناف والمستودعات المتعددة، مع تنبيهات الحد الأدنى وتقارير حركة المخزون اللحظية.",
    icon: Package,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "١٠:٣٠ ص",
    title: "نظام التقارير والتحليلات",
    description: "لوحة تحليلات متقدمة توفر تقارير مالية لحظية: الأرباح والخسائر، الميزانية العمومية، التدفق النقدي، وتحليل الإيرادات.",
    icon: BarChart3,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "١١:٠٠ ص",
    title: "نظام الحوكمة والصلاحيات",
    description: "تحكم في صلاحيات المستخدمين بناءً على الأدوار، مع سجل مراجعة كامل ونظام موافقات متعدد المستويات.",
    icon: Shield,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "١١:٣٠ ص",
    title: "نظام الذكاء المحاسبي (AI)",
    description: "محرك ذكاء اصطناعي يقدم تصنيف تلقائي للقيود، اقتراحات ذكية للحسابات، وتحليل تنبؤي للتدفقات النقدية.",
    icon: Brain,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "١٢:٠٠ م",
    title: "نظام بوابات الدفع",
    description: "تكامل مع بوابات الدفع الرئيسية في السعودية لتحصيل المدفوعات إلكترونياً مع تسوية تلقائية وإشعارات فورية.",
    icon: CreditCard,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "١٢:٣٠ م",
    title: "نظام الهيكل المؤسسي",
    description: "دعم الهياكل المعقدة متعددة الكيانات والفروع، مع شجرة حسابات موحدة وتقارير مجمّعة على مستوى المجموعة.",
    icon: Building2,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠١:٠٠ م",
    title: "نظام إدارة العقود",
    description: "إدارة دورة حياة العقود من الإنشاء والتوقيع الإلكتروني وحتى التجديد التلقائي، مع تنبيهات الانتهاء.",
    icon: ClipboardCheck,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠١:٣٠ م",
    title: "نظام سير العمل والموافقات",
    description: "محرك سير عمل مرن لتصميم مسارات موافقات مخصصة للفواتير والمصروفات حسب المبلغ والقسم.",
    icon: Workflow,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٢:٠٠ م",
    title: "نظام الإقرار الضريبي",
    description: "إعداد الإقرارات الضريبية آلياً وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك مع حساب تلقائي للقيمة المضافة.",
    icon: Receipt,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٢:٣٠ م",
    title: "نظام الأمان والتشفير",
    description: "طبقات أمان متعددة: تشفير SSL، مصادقة ثنائية، إدارة جلسات نشطة، وسجل أمني شامل.",
    icon: Lock,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٣:٠٠ م",
    title: "نظام API والتكاملات",
    description: "واجهة برمجة RESTful كاملة للتكامل مع الأنظمة الخارجية، مع توثيق شامل ومفاتيح وصول آمنة.",
    icon: Globe,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٣:٣٠ م",
    title: "نظام الميزانيات والتخطيط المالي",
    description: "تخطيط مالي متقدم: ميزانيات سنوية وشهرية، مقارنة الفعلي بالمخطط، وتنبيهات تجاوز الميزانية.",
    icon: Landmark,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٤:٠٠ م",
    title: "نظام الفترات المحاسبية",
    description: "إدارة الفترات المحاسبية مع فتح وإغلاق الفترات ومنع التعديل على القيود المغلقة لضمان سلامة البيانات.",
    icon: CalendarClock,
    tag: "نظام جديد",
  },
  // ── تحسينات وإصلاحات ──
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٤:٣٠ م",
    title: "تحسين أداء تحميل لوحة التحكم",
    description: "تقليل زمن التحميل الأولي للوحة التحكم بنسبة ٤٠٪ من خلال تحسين استعلامات قاعدة البيانات وتقنية التحميل الكسول.",
    icon: Gauge,
    tag: "أداء",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٥:٠٠ م",
    title: "نظام النسخ الاحتياطي التلقائي",
    description: "نسخ احتياطي يومي تلقائي مع إمكانية الاستعادة الفورية وتشفير البيانات أثناء النقل والتخزين.",
    icon: Database,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٥:٣٠ م",
    title: "تحسين تجربة البحث الشامل",
    description: "بحث فوري متقدم يشمل الفواتير، العملاء، المنتجات، والقيود المحاسبية مع اقتراحات ذكية أثناء الكتابة.",
    icon: Search,
    tag: "تحسين",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٦:٠٠ م",
    title: "نظام الإشعارات الذكية",
    description: "إشعارات فورية داخل المنصة وعبر البريد الإلكتروني للأحداث المهمة: فواتير مستحقة، موافقات معلقة، وتنبيهات أمنية.",
    icon: MessageSquare,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٦:٣٠ م",
    title: "تحسين تجربة التصدير والاستيراد",
    description: "دعم تصدير البيانات إلى Excel وPDF مع قوالب احترافية جاهزة، واستيراد البيانات من ملفات CSV وExcel.",
    icon: RefreshCw,
    tag: "تحسين",
  },
];

const ITEMS_PER_PAGE = 5;
const ALL_TAGS = ["الكل", "نظام جديد", "تحسين", "إصلاح", "أداء"] as const;

/* ─── Component ─── */
const UpdatesPage = () => {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [activeTag, setActiveTag] = useState<string>("الكل");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let items = UPDATES;
    if (activeTag !== "الكل") items = items.filter((u) => u.tag === activeTag);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(
        (u) => u.title.toLowerCase().includes(q) || u.description.toLowerCase().includes(q)
      );
    }
    return items;
  }, [activeTag, searchQuery]);

  const visibleUpdates = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const sections: Update[][] = [];
  for (let i = 0; i < visibleUpdates.length; i += ITEMS_PER_PAGE) {
    sections.push(visibleUpdates.slice(i, i + ITEMS_PER_PAGE));
  }

  const stats = useMemo(() => {
    const systems = UPDATES.filter((u) => u.tag === "نظام جديد").length;
    const improvements = UPDATES.filter((u) => u.tag === "تحسين").length;
    const perf = UPDATES.filter((u) => u.tag === "أداء").length;
    return { total: UPDATES.length, systems, improvements, perf };
  }, []);

  return (
    <>
      <Helmet>
        <title>سجل التحديثات | نيوماكسيو</title>
        <meta name="description" content="تابع آخر تحديثات وأنظمة منصة نيوماكسيو المحاسبية" />
      </Helmet>

      <Navbar />

      <main className="min-h-screen bg-background" dir="rtl">
        {/* ─── Hero ─── */}
        <section className="relative py-16 sm:py-24 md:py-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-accent/[0.02] to-transparent" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--accent)) 1px, transparent 0)", backgroundSize: "32px 32px" }} />

          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2 border border-accent/20">
                <History size={14} className="text-accent" />
                <span className="text-xs sm:text-sm font-semibold text-accent">سجل التحديثات</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
                ما الجديد في نيوماكسيو؟
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
                نعمل باستمرار على تطوير المنصة. هنا تجد كل التحديثات والأنظمة الجديدة.
              </p>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-8 sm:mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-xl mx-auto"
            >
              <StatCard value={stats.total} label="تحديث" icon={Rocket} />
              <StatCard value={stats.systems} label="نظام جديد" icon={Zap} />
              <StatCard value={stats.improvements} label="تحسين" icon={RefreshCw} />
              <StatCard value={stats.perf} label="أداء" icon={Gauge} />
            </motion.div>
          </div>
        </section>

        {/* ─── Filters ─── */}
        <section className="sticky top-16 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50 py-3 sm:py-4">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(ITEMS_PER_PAGE); }}
                  placeholder="ابحث في التحديثات..."
                  className="w-full rounded-xl border border-border bg-card ps-10 pe-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 transition-colors min-h-[44px]"
                />
              </div>

              {/* Tags */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                {ALL_TAGS.map((tag) => {
                  const isActive = activeTag === tag;
                  const count = tag === "الكل" ? UPDATES.length : UPDATES.filter((u) => u.tag === tag).length;
                  if (count === 0 && tag !== "الكل") return null;
                  return (
                    <button
                      key={tag}
                      onClick={() => { setActiveTag(tag); setVisibleCount(ITEMS_PER_PAGE); }}
                      className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all min-h-[36px] ${
                        isActive
                          ? "gradient-accent text-accent-foreground shadow-sm"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {tag}
                      <span className={`ms-1 text-[10px] ${isActive ? "opacity-80" : "opacity-50"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Timeline ─── */}
        <section className="py-10 sm:py-14">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 sm:p-14 text-center">
                <Search size={32} className="mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-base font-bold text-foreground mb-2">لا توجد نتائج</h3>
                <p className="text-sm text-muted-foreground">حاول تغيير كلمة البحث أو الفلتر.</p>
              </div>
            ) : (
              sections.map((section, si) => (
                <div key={si} className="mb-10 last:mb-0">
                  {/* Date divider */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
                    <div className="flex items-center gap-2 rounded-full bg-muted/50 border border-border/60 px-4 py-1.5">
                      <CalendarClock size={12} className="text-accent" />
                      <span className="text-[11px] sm:text-xs font-semibold text-foreground whitespace-nowrap">
                        {section[0]?.date}
                      </span>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                  </div>

                  {/* Timeline line + cards */}
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute start-5 sm:start-6 top-0 bottom-0 w-px bg-gradient-to-b from-accent/30 via-border to-transparent" />

                    <div className="space-y-4">
                      {section.map((update, i) => {
                        const Icon = update.icon;
                        const tagStyle = TAG_STYLES[update.tag] || TAG_STYLES["نظام جديد"];
                        return (
                          <motion.div
                            key={si * ITEMS_PER_PAGE + i}
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, amount: 0.3 }}
                            transition={{ duration: 0.35, delay: i * 0.06 }}
                            className="relative ps-12 sm:ps-14"
                          >
                            {/* Dot on timeline */}
                            <div className="absolute start-3 sm:start-4 top-5 sm:top-6 h-4 w-4 rounded-full border-2 border-accent bg-background z-10" />

                            <div className="group rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card hover:border-accent/30 hover:shadow-elevated transition-all duration-300">
                              {/* Top meta */}
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${tagStyle}`}>
                                    {update.tag}
                                  </span>
                                </div>
                                <span className="text-[11px] font-medium text-muted-foreground tabular-nums shrink-0">
                                  {update.time}
                                </span>
                              </div>

                              {/* Content */}
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 group-hover:bg-accent/15 transition-colors">
                                  <Icon size={18} className="text-accent" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm sm:text-base font-bold text-foreground mb-1">
                                    {update.title}
                                  </h3>
                                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                    {update.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Load more */}
            {hasMore && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center mt-8"
              >
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((c) => c + ITEMS_PER_PAGE)}
                  className="min-h-[44px] px-8 text-sm font-semibold gap-2 rounded-xl"
                >
                  <ChevronDown size={14} className="text-accent" />
                  عرض المزيد ({filtered.length - visibleCount} تحديث متبقي)
                </Button>
              </motion.div>
            )}

            {/* All shown */}
            {!hasMore && filtered.length > 0 && (
              <div className="mt-12 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/20 px-5 py-2 mb-4">
                  <Rocket size={14} className="text-accent" />
                  <span className="text-xs font-semibold text-accent">تم عرض جميع التحديثات</span>
                </div>
                <p className="text-xs text-muted-foreground mb-5">ترقّب المزيد من التحديثات القادمة</p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent/80 transition-colors"
                >
                  <ArrowRight size={16} />
                  العودة للصفحة الرئيسية
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

/* ─── Stat Card ─── */
const StatCard = ({
  value,
  label,
  icon: Icon,
}: {
  value: number;
  label: string;
  icon: React.ElementType;
}) => (
  <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-3 sm:p-4 text-center">
    <Icon size={16} className="text-accent mx-auto mb-1.5" />
    <p className="text-lg sm:text-xl font-bold text-foreground tabular-nums">{value}</p>
    <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">{label}</p>
  </div>
);

export default UpdatesPage;
