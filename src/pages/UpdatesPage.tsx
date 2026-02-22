import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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
  Settings,
  Receipt,
  ClipboardCheck,
  Workflow,
  Lock,
  Globe,
  Landmark,
  CalendarClock,
} from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Update {
  date: string;
  time: string;
  title: string;
  description: string;
  icon: React.ElementType;
  tag: string;
}

const UPDATES: Update[] = [
  // ── الدفعة ١ ──
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٩:٠٠ ص",
    title: "نظام الفوترة الإلكترونية",
    description: "إطلاق نظام الفوترة الإلكترونية المتوافق مع متطلبات ZATCA المرحلة الأولى والثانية، مع دعم QR Code وإصدار الفواتير الضريبية المبسطة والتفصيلية.",
    icon: FileText,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٩:٣٠ ص",
    title: "نظام إدارة العملاء والموردين",
    description: "نظام شامل لإدارة بيانات العملاء والموردين مع سجل كامل للمعاملات، وربط تلقائي بالفواتير والمدفوعات وإدارة حدود الائتمان.",
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
    description: "لوحة تحليلات متقدمة توفر تقارير مالية لحظية تشمل الأرباح والخسائر، الميزانية العمومية، التدفق النقدي، وتحليل الإيرادات حسب الفترة.",
    icon: BarChart3,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "١١:٠٠ ص",
    title: "نظام الحوكمة والصلاحيات",
    description: "نظام متطور للتحكم في صلاحيات المستخدمين بناءً على الأدوار، مع سجل مراجعة كامل لكل عملية ونظام موافقات متعدد المستويات.",
    icon: Shield,
    tag: "نظام جديد",
  },
  // ── الدفعة ٢ ──
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "١١:٣٠ ص",
    title: "نظام الذكاء المحاسبي (AI)",
    description: "محرك ذكاء اصطناعي محاسبي يقدم تصنيف تلقائي للقيود، اقتراحات ذكية للحسابات، وتحليل تنبؤي للتدفقات النقدية المستقبلية.",
    icon: Brain,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "١٢:٠٠ م",
    title: "نظام بوابات الدفع",
    description: "تكامل مع بوابات الدفع الرئيسية في المملكة العربية السعودية لتحصيل المدفوعات إلكترونياً مع تسوية تلقائية وإشعارات فورية.",
    icon: CreditCard,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "١٢:٣٠ م",
    title: "نظام الهيكل المؤسسي",
    description: "دعم الهياكل المؤسسية المعقدة متعددة الكيانات والفروع، مع شجرة حسابات موحدة وتقارير مجمّعة على مستوى المجموعة.",
    icon: Building2,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠١:٠٠ م",
    title: "نظام إدارة العقود",
    description: "إدارة دورة حياة العقود بالكامل من الإنشاء والتوقيع الإلكتروني وحتى التجديد التلقائي، مع تنبيهات قبل انتهاء الصلاحية.",
    icon: ClipboardCheck,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠١:٣٠ م",
    title: "نظام سير العمل والموافقات",
    description: "محرك سير عمل مرن يتيح تصميم مسارات موافقات مخصصة للفواتير والمصروفات وأوامر الشراء حسب المبلغ والقسم.",
    icon: Workflow,
    tag: "نظام جديد",
  },
  // ── الدفعة ٣ ──
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٢:٠٠ م",
    title: "نظام الإقرار الضريبي",
    description: "إعداد الإقرارات الضريبية آلياً وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك، مع حساب تلقائي لضريبة القيمة المضافة.",
    icon: Receipt,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٢:٣٠ م",
    title: "نظام الأمان والتشفير",
    description: "طبقات أمان متعددة تشمل تشفير SSL، مصادقة ثنائية، إدارة جلسات نشطة، وسجل أمني شامل لكل عمليات الدخول.",
    icon: Lock,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٣:٠٠ م",
    title: "نظام API والتكاملات",
    description: "واجهة برمجة تطبيقات RESTful كاملة تتيح التكامل مع الأنظمة الخارجية، مع توثيق شامل ومفاتيح وصول آمنة وحدود استخدام مرنة.",
    icon: Globe,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٣:٣٠ م",
    title: "نظام الميزانيات والتخطيط المالي",
    description: "تخطيط مالي متقدم يشمل إعداد الميزانيات السنوية والشهرية، مقارنة الفعلي بالمخطط، وتنبيهات تجاوز الميزانية.",
    icon: Landmark,
    tag: "نظام جديد",
  },
  {
    date: "٢١ فبراير ٢٠٢٦",
    time: "٠٤:٠٠ م",
    title: "نظام الفترات المحاسبية",
    description: "إدارة الفترات المحاسبية مع إمكانية فتح وإغلاق الفترات، ومنع التعديل على القيود في الفترات المغلقة لضمان سلامة البيانات.",
    icon: CalendarClock,
    tag: "نظام جديد",
  },
];

const ITEMS_PER_PAGE = 5;

const UpdatesPage = () => {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const visibleUpdates = UPDATES.slice(0, visibleCount);
  const hasMore = visibleCount < UPDATES.length;

  // Group visible updates into chunks of 5
  const sections: Update[][] = [];
  for (let i = 0; i < visibleUpdates.length; i += ITEMS_PER_PAGE) {
    sections.push(visibleUpdates.slice(i, i + ITEMS_PER_PAGE));
  }

  return (
    <>
      <Helmet>
        <title>التحديثات | نيوماكسيو</title>
        <meta name="description" content="تابع آخر تحديثات وأنظمة منصة نيوماكسيو المحاسبية" />
      </Helmet>

      <Navbar />

      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative py-20 sm:py-28 md:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent" />
          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2">
                <Bell size={14} className="text-accent" />
                <span className="text-xs sm:text-sm font-semibold text-accent">سجل التحديثات</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
                تحديثات المنصة
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
                تابع كل ما هو جديد في نيوماكسيو — أنظمة جديدة، تحسينات أداء، وإصلاحات.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Updates Sections */}
        <section className="pb-20 sm:pb-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            {sections.map((section, si) => (
              <div key={si} className="mb-10 last:mb-0">
                {/* Section divider */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    {section[0]?.date}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="space-y-4">
                  {section.map((update, i) => {
                    const Icon = update.icon;
                    const globalIndex = si * ITEMS_PER_PAGE + i;
                    return (
                      <motion.div
                        key={globalIndex}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.35, delay: i * 0.05 }}
                        className="group rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card hover:border-accent/30 hover:shadow-elevated transition-all duration-300"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 group-hover:bg-accent/15 transition-colors">
                            <Icon size={20} className="text-accent" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Meta row */}
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                                {update.time}
                              </span>
                              <span className="h-1 w-1 rounded-full bg-border" />
                              <span className="text-[11px] font-medium text-muted-foreground">
                                {update.date}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent">
                                {update.tag}
                              </span>
                            </div>
                            <h3 className="text-base sm:text-lg font-bold text-foreground mb-1.5">
                              {update.title}
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {update.description}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="text-center mt-8">
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((c) => c + ITEMS_PER_PAGE)}
                  className="min-h-[44px] px-8 text-sm font-semibold gap-2"
                >
                  <Zap size={14} className="text-accent" />
                  عرض المزيد ({UPDATES.length - visibleCount} تحديث متبقي)
                </Button>
              </div>
            )}

            {/* Footer note */}
            {!hasMore && (
              <div className="mt-12 text-center">
                <p className="text-xs text-muted-foreground mb-4">تم عرض جميع التحديثات</p>
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

export default UpdatesPage;
