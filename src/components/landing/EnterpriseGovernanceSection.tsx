import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, Crown, ShieldCheck, GitBranch, KeyRound, Search, ArrowLeft, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";

const roles = [
  { name: "محاسب", nameEn: "Accountant" },
  { name: "مدير مالي", nameEn: "CFO" },
  { name: "مدقق", nameEn: "Auditor" },
  { name: "أمين صندوق", nameEn: "Cashier" },
];

const features = [
  { icon: GitBranch, title: "موافقات متعددة المستويات", desc: "سلاسل اعتماد مخصصة بالأدوار والمبالغ" },
  { icon: ShieldCheck, title: "سجل تدقيق شامل (Audit Trail)", desc: "كل عملية مسجلة مع تفاصيل كاملة وتاريخ" },
  { icon: KeyRound, title: "عزل بيانات Multi-tenant", desc: "كل منشأة معزولة بالكامل عن الأخرى" },
  { icon: Gauge, title: "Compliance Score", desc: "تقييم فوري لجاهزية الحوكمة والامتثال" },
];

const EnterpriseGovernanceSection = () => {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom right, hsl(220 30% 8%), hsl(220 35% 12%), hsl(220 30% 8%))" }} />
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.3'%3E%3Cpath d='M0 0h40v40H0z'/%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="max-w-6xl relative mx-auto px-4 sm:px-6 z-10">
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
            className="mb-3 font-bold text-white"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
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
            className="mx-auto max-w-xl text-white/70"
            style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
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
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-6 transition-all hover:border-amber-500/20 hover:bg-white/[0.05]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 mb-4">
                <f.icon size={18} className="text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-white/70">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Upgrade Wall */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-6 text-center"
        >
          <p className="text-sm text-amber-300 mb-4">
            الحوكمة المؤسسية متاحة في باقة Enterprise — مصممة للشركات التي تضم 10+ موظفين
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-to-r from-amber-500 to-amber-400 text-black font-bold px-10 min-h-[48px] text-base shadow-[0_8px_32px_-4px_hsl(45,90%,50%/0.3)]">
              فعّل الوضع المؤسسي
              <ArrowLeft className="ms-2 h-5 w-5 rtl-mirror" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default EnterpriseGovernanceSection;
