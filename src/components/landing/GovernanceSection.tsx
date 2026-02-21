import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, Crown, ShieldCheck, GitBranch, KeyRound, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const roles = [
  { name: "محاسب", nameEn: "Accountant", color: "bg-accent/10 text-accent" },
  { name: "مدير مالي", nameEn: "CFO", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { name: "مدقق", nameEn: "Auditor", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { name: "أمين صندوق", nameEn: "Cashier", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
];

const features = [
  { icon: GitBranch, title: "موافقات متعددة المستويات", desc: "سلاسل اعتماد مخصصة بالأدوار والمبالغ" },
  { icon: ShieldCheck, title: "سجلات تدقيق شاملة", desc: "كل عملية مسجلة مع تفاصيل كاملة" },
  { icon: KeyRound, title: "عزل بيانات Multi-tenant", desc: "كل منشأة معزولة بالكامل" },
  { icon: Search, title: "لوحة الذكاء التنفيذي", desc: "رؤية شاملة لأداء المنشأة" },
];

const GovernanceSection = () => {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden" dir="rtl">
      {/* Dark premium background */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom right, hsl(220 30% 8%), hsl(220 35% 12%), hsl(220 30% 8%))" }} />
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.3'%3E%3Cpath d='M0 0h40v40H0z'/%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="container relative mx-auto px-4 z-10">
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-5 py-2"
          >
            <Building2 size={14} className="text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">حوكمة مؤسسية</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 text-3xl font-bold text-white md:text-5xl"
          >
            قوالب أدوار{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-200">
              مؤسسية جاهزة
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-base sm:text-lg text-white/50"
          >
            صلاحيات مسبقة التهيئة لكل دور — فعّل وابدأ فوراً
          </motion.p>
        </div>

        {/* Role templates */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
          {roles.map((role, i) => (
            <motion.div
              key={role.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3"
            >
              <Crown size={14} className="text-amber-400" />
              <div>
                <p className="text-sm font-bold text-white">{role.name}</p>
                <p className="text-[10px] text-white/40 font-english" dir="ltr">{role.nameEn}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Features grid */}
        <div className="grid gap-5 sm:grid-cols-2 max-w-4xl mx-auto mb-12">
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
              <p className="text-sm text-white/40">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <Link to="/auth">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Button size="lg" className="bg-gradient-to-r from-amber-500 to-amber-400 text-black font-bold px-10 py-7 text-base shadow-[0_8px_32px_-4px_hsl(45,90%,50%/0.3)]">
                فعّل الوضع المؤسسي
                <ArrowLeft className="ms-2 h-5 w-5 rtl-mirror" />
              </Button>
            </motion.div>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default GovernanceSection;
