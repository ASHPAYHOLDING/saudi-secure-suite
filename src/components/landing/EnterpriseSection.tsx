import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, GitBranch, ShieldCheck, KeyRound, Search, BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: BookOpen, title: "شجرة حسابات متقدمة", desc: "هيكل محاسبي مرن متعدد المستويات" },
  { icon: Building2, title: "هيكل شركات متعدد", desc: "كيانات قانونية وفروع مستقلة" },
  { icon: GitBranch, title: "موافقات متعددة المستويات", desc: "سلاسل اعتماد مخصصة بالأدوار" },
  { icon: KeyRound, title: "SSO ومصادقة مؤسسية", desc: "تسجيل دخول موحد مع 2FA إلزامي" },
  { icon: Search, title: "ذكاء التدقيق", desc: "كشف الأنماط المشبوهة تلقائياً" },
  { icon: ShieldCheck, title: "درجة الامتثال", desc: "مؤشر جاهزية مؤسسية شامل" },
];

const EnterpriseSection = () => {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden" dir="rtl">
      {/* Dark premium background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(220,30%,8%)] via-[hsl(220,35%,12%)] to-[hsl(220,30%,8%)]" />
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.3'%3E%3Cpath d='M0 0h40v40H0z'/%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="max-w-6xl relative mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <div className="mb-16 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-5 py-2"
          >
            <Building2 size={14} className="text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">Enterprise Mode</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-5 text-3xl font-bold text-white md:text-5xl"
          >
            جاهز للنمو؟{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-200">
              فعّل الوضع المؤسسي.
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-2xl text-lg text-white/70"
          >
            أدوات حوكمة وتحكم مالي على مستوى المؤسسات الكبرى
          </motion.p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto mb-14">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-6 transition-all hover:border-amber-500/20 hover:bg-white/[0.05]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 mb-4">
                <f.icon size={18} className="text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-white/60">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <Link to="/auth">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Button size="lg" className="bg-gradient-to-r from-amber-500 to-amber-400 text-black font-bold px-10 py-7 text-base shadow-[0_8px_32px_-4px_hsl(45,90%,50%/0.3)]">
                فعّل الوضع المؤسسي
                <ArrowLeft className="ms-2 h-5 w-5 rtl:scale-x-[-1]" />
              </Button>
            </motion.div>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default EnterpriseSection;
