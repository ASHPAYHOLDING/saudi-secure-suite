import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, Crown, ShieldCheck, GitBranch, KeyRound, Gauge, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const roles = [
  { name: "محاسب", nameEn: "Accountant" },
  { name: "مدير مالي", nameEn: "CFO" },
  { name: "مدقق", nameEn: "Auditor" },
  { name: "أمين صندوق", nameEn: "Cashier" },
];

const features = [
  { icon: GitBranch, title: "موافقات متعددة المستويات", desc: "سلاسل اعتماد مرنة حسب الأدوار والمبالغ — لا شيء يمر بدون إذن" },
  { icon: ShieldCheck, title: "سجل تدقيق شامل", desc: "كل عملية مسجلة بتفاصيلها الكاملة — جاهز لأي تدقيق خارجي" },
  { icon: KeyRound, title: "Multi-Entity + SSO + API Keys", desc: "كل منشأة معزولة بالكامل مع دعم تسجيل دخول موحد ومفاتيح API" },
  { icon: Gauge, title: "درجة الامتثال الفوري", desc: "تقييم لحظي لجاهزية الحوكمة والامتثال في منشأتك" },
];

const EnterpriseGovernanceSection = () => {
  return (
    <section className="py-20 md:py-24 relative overflow-hidden">
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
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-5 py-2"
          >
            <Building2 size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">حوكمة مؤسسية</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 font-bold text-primary-foreground"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            جاهز للنمو{" "}
            <span className="text-gradient">المؤسسي</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-primary-foreground/70"
            style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
          >
            قوالب أدوار جاهزة، موافقات متعددة المستويات، وجاهزية كاملة للتدقيق
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
              className="flex items-center gap-2 rounded-xl border border-primary-foreground/[0.08] bg-primary-foreground/[0.03] px-5 py-3 min-h-[44px]"
            >
              <Crown size={14} className="text-accent" />
              <div>
                <p className="text-sm font-bold text-primary-foreground">{role.name}</p>
                <p className="text-[10px] text-primary-foreground/40 font-english" dir="ltr">{role.nameEn}</p>
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
              className="rounded-2xl border border-primary-foreground/[0.08] bg-primary-foreground/[0.03] backdrop-blur-sm p-6 transition-all hover:border-accent/20 hover:bg-primary-foreground/[0.05]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 mb-4">
                <f.icon size={18} className="text-accent" />
              </div>
              <h3 className="text-base font-bold text-primary-foreground mb-1">{f.title}</h3>
              <p className="text-sm text-primary-foreground/70">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto rounded-2xl border border-accent/20 bg-accent/5 backdrop-blur-sm p-6 text-center"
        >
          <p className="text-sm text-accent mb-4">
            الحوكمة المؤسسية متاحة في باقة المؤسسات — مصممة للشركات التي تتطلع للنمو والتوسع
          </p>
          <Link to="/auth">
            <Button size="lg" className="gradient-accent text-accent-foreground font-bold px-10 min-h-[48px] text-base shadow-accent-glow rounded-xl">
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
