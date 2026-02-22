import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { useState, useMemo, useRef } from "react";
import {
  ArrowRight,
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
  Rocket,
  MessageSquare,
  Database,
  RefreshCw,
  Gauge,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
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

const TAG_CONFIG: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  "نظام جديد": { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400", border: "border-emerald-500/20" },
  "تحسين": { bg: "bg-sky-500/10", text: "text-sky-400", dot: "bg-sky-400", border: "border-sky-500/20" },
  "إصلاح": { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400", border: "border-amber-500/20" },
  "أداء": { bg: "bg-violet-500/10", text: "text-violet-400", dot: "bg-violet-400", border: "border-violet-500/20" },
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

/* ─── Floating Orbs Background ─── */
const FloatingOrbs = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <motion.div
      animate={{ x: [0, 80, 0], y: [0, -60, 0], scale: [1, 1.2, 1] }}
      transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-20 end-[10%] w-[400px] h-[400px] rounded-full bg-emerald-500/[0.04] blur-[100px]"
    />
    <motion.div
      animate={{ x: [0, -60, 0], y: [0, 80, 0], scale: [1.1, 0.9, 1.1] }}
      transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-[50%] start-[5%] w-[350px] h-[350px] rounded-full bg-sky-500/[0.03] blur-[100px]"
    />
    <motion.div
      animate={{ x: [0, 40, 0], y: [0, -40, 0] }}
      transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      className="absolute bottom-20 end-[30%] w-[300px] h-[300px] rounded-full bg-violet-500/[0.03] blur-[100px]"
    />
  </div>
);

/* ─── Component ─── */
const UpdatesPage = () => {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [activeTag, setActiveTag] = useState<string>("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

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

      <main className="min-h-screen bg-[hsl(220,20%,4%)] text-white" dir="rtl">
        {/* ─── Hero ─── */}
        <section ref={heroRef} className="relative pt-24 pb-16 sm:pt-32 sm:pb-20 md:pt-40 md:pb-24 overflow-hidden">
          <FloatingOrbs />
          
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(hsl(160,60%,50%) 1px, transparent 1px), linear-gradient(90deg, hsl(160,60%,50%) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }} />

          <motion.div style={{ opacity: heroOpacity, scale: heroScale }} className="relative mx-auto max-w-5xl px-4 sm:px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-5 py-2.5 backdrop-blur-sm"
              >
                <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
                  <Sparkles size={14} className="text-emerald-400" />
                </motion.div>
                <span className="text-xs sm:text-sm font-semibold text-emerald-400 tracking-wide">
                  سجل التحديثات
                </span>
              </motion.div>

              {/* Title */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-center mx-auto mb-6 leading-[1.15] tracking-tight">
                <span className="text-white">ما الجديد في </span>
                <span className="bg-gradient-to-l from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                  نيوماكسيو
                </span>
                <span className="text-white">؟</span>
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
                نعمل باستمرار على تطوير المنصة. هنا تجد كل التحديثات والأنظمة الجديدة.
              </p>
            </motion.div>

            {/* Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-12 sm:mt-16 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-2xl mx-auto"
            >
              <StatCard value={stats.total} label="تحديث" color="emerald" />
              <StatCard value={stats.systems} label="نظام جديد" color="teal" />
              <StatCard value={stats.improvements} label="تحسين" color="sky" />
              <StatCard value={stats.perf} label="أداء" color="violet" />
            </motion.div>
          </motion.div>

          {/* Bottom fade */}
          <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[hsl(220,20%,4%)] to-transparent" />
        </section>

        {/* ─── Sticky Filters ─── */}
        <section className="sticky top-16 z-30 border-b border-white/[0.06] bg-[hsl(220,20%,4%)]/80 backdrop-blur-2xl">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3.5 sm:py-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(ITEMS_PER_PAGE); }}
                  placeholder="ابحث في التحديثات..."
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] ps-10 pe-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-emerald-500/40 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all min-h-[44px]"
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
                      className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium transition-all min-h-[36px] ${
                        isActive
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                          : "bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-white border border-white/[0.06]"
                      }`}
                    >
                      {tag}
                      <span className={`ms-1.5 text-[10px] ${isActive ? "text-emerald-100" : "text-neutral-600"}`}>
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
        <section className="relative py-12 sm:py-16">
          <FloatingOrbs />
          <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
            {filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 sm:p-16 text-center"
              >
                <Search size={40} className="mx-auto text-neutral-600 mb-5" />
                <h3 className="text-lg font-bold text-white mb-2">لا توجد نتائج</h3>
                <p className="text-sm text-neutral-500">حاول تغيير كلمة البحث أو الفلتر.</p>
              </motion.div>
            ) : (
              sections.map((section, si) => (
                <div key={si} className="mb-14 last:mb-0">
                  {/* Section Date Header */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-4 mb-8"
                  >
                    <div className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
                    <div className="flex items-center gap-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] px-5 py-2 backdrop-blur-sm">
                      <CalendarClock size={13} className="text-emerald-400" />
                      <span className="text-xs font-semibold text-neutral-300 whitespace-nowrap">
                        {section[0]?.date}
                      </span>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                  </motion.div>

                  {/* Cards Grid */}
                  <div className="space-y-4">
                    {section.map((update, i) => {
                      const Icon = update.icon;
                      const tagCfg = TAG_CONFIG[update.tag] || TAG_CONFIG["نظام جديد"];
                      return (
                        <motion.div
                          key={si * ITEMS_PER_PAGE + i}
                          initial={{ opacity: 0, y: 24 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, amount: 0.2 }}
                          transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden transition-all duration-500 hover:border-white/[0.12] hover:bg-white/[0.04]">
                            {/* Hover glow */}
                            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-l ${
                              update.tag === "نظام جديد" ? "from-emerald-500/[0.04]" :
                              update.tag === "تحسين" ? "from-sky-500/[0.04]" :
                              update.tag === "أداء" ? "from-violet-500/[0.04]" :
                              "from-amber-500/[0.04]"
                            } to-transparent`} />

                            <div className="relative p-5 sm:p-6">
                              <div className="flex items-start gap-4">
                                {/* Icon */}
                                <motion.div
                                  whileHover={{ scale: 1.1, rotate: -5 }}
                                  transition={{ type: "spring", stiffness: 400 }}
                                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tagCfg.bg} border ${tagCfg.border} transition-colors`}
                                >
                                  <Icon size={20} className={tagCfg.text} />
                                </motion.div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${tagCfg.bg} ${tagCfg.text} border ${tagCfg.border}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${tagCfg.dot}`} />
                                        {update.tag}
                                      </span>
                                    </div>
                                    <span className="text-[11px] font-medium text-neutral-600 tabular-nums shrink-0 tracking-wider">
                                      {update.time}
                                    </span>
                                  </div>

                                  <h3 className="text-base sm:text-lg font-bold text-white mb-1.5 group-hover:text-emerald-300 transition-colors duration-300">
                                    {update.title}
                                  </h3>
                                  <p className="text-sm text-neutral-400 leading-relaxed">
                                    {update.description}
                                  </p>
                                </div>

                                {/* Arrow */}
                                <div className="hidden sm:flex items-center self-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                  <ArrowUpRight size={18} className="text-emerald-400" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            {/* Load more */}
            {hasMore && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center mt-10"
              >
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((c) => c + ITEMS_PER_PAGE)}
                  className="min-h-[48px] px-8 text-sm font-semibold gap-2.5 rounded-xl bg-white/[0.04] border-white/[0.08] text-white hover:bg-white/[0.08] hover:border-white/[0.15] hover:text-white transition-all"
                >
                  <ChevronDown size={14} className="text-emerald-400" />
                  عرض المزيد ({filtered.length - visibleCount} تحديث متبقي)
                </Button>
              </motion.div>
            )}

            {/* All shown */}
            {!hasMore && filtered.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mt-16 text-center"
              >
                <div className="inline-flex items-center gap-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-6 py-2.5 mb-5 backdrop-blur-sm">
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Rocket size={14} className="text-emerald-400" />
                  </motion.div>
                  <span className="text-xs font-semibold text-emerald-400">تم عرض جميع التحديثات</span>
                </div>
                <p className="text-sm text-neutral-500 mb-6">ترقّب المزيد من التحديثات القادمة</p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors group"
                >
                  <ArrowRight size={16} className="transition-transform group-hover:-translate-x-1" />
                  العودة للصفحة الرئيسية
                </Link>
              </motion.div>
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
  color,
}: {
  value: number;
  label: string;
  color: "emerald" | "teal" | "sky" | "violet";
}) => {
  const colorMap = {
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/15 text-emerald-400",
    teal: "from-teal-500/20 to-teal-500/5 border-teal-500/15 text-teal-400",
    sky: "from-sky-500/20 to-sky-500/5 border-sky-500/15 text-sky-400",
    violet: "from-violet-500/20 to-violet-500/5 border-violet-500/15 text-violet-400",
  };
  const c = colorMap[color];
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400 }}
      className={`rounded-2xl border bg-gradient-to-b ${c} backdrop-blur-sm p-4 sm:p-5 text-center cursor-default`}
    >
      <motion.p
        className="text-2xl sm:text-3xl font-bold text-white tabular-nums"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", delay: 0.5 }}
      >
        {value}
      </motion.p>
      <p className={`text-[11px] sm:text-xs font-medium mt-1 ${c.split(" ").find(s => s.startsWith("text-"))}`}>{label}</p>
    </motion.div>
  );
};

export default UpdatesPage;
