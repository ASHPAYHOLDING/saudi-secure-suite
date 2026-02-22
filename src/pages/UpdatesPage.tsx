import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Bell, Sparkles, Zap, Shield, BarChart3 } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const PLACEHOLDER_UPDATES = [
  {
    date: "قريباً",
    title: "تحديثات قادمة",
    description: "نعمل على تحسينات ومميزات جديدة. تابعنا لمعرفة آخر المستجدات.",
    icon: Sparkles,
    tag: "قادم",
  },
];

const UpdatesPage = () => {
  return (
    <>
      <Helmet>
        <title>التحديثات | نيوماكسيو</title>
        <meta name="description" content="تابع آخر تحديثات ومميزات منصة نيوماكسيو المحاسبية" />
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
                تابع كل ما هو جديد في نيوماكسيو — مميزات جديدة، تحسينات أداء، وإصلاحات.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Timeline */}
        <section className="pb-20 sm:pb-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            {PLACEHOLDER_UPDATES.length > 0 ? (
              <div className="space-y-6">
                {PLACEHOLDER_UPDATES.map((update, i) => {
                  const Icon = update.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                      className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-card"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                          <Icon size={20} className="text-accent" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className="text-xs font-medium text-muted-foreground">{update.date}</span>
                            <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                              {update.tag}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-foreground mb-2">{update.title}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{update.description}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : null}

            {/* Empty state hint */}
            <div className="mt-12 rounded-2xl border border-dashed border-border bg-muted/20 p-8 sm:p-12 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 mb-5">
                <Zap size={24} className="text-accent" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">ترقّب المزيد</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                نعمل باستمرار على تطوير المنصة وإضافة مميزات جديدة تلبي احتياجاتك. سيتم نشر التحديثات هنا أولاً بأول.
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent/80 transition-colors"
              >
                <ArrowRight size={16} />
                العودة للصفحة الرئيسية
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default UpdatesPage;
