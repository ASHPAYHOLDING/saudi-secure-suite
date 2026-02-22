import { memo, useRef } from "react";
import { motion, useInView } from "framer-motion";

interface ComplianceItem {
  label: string;
  description: string;
  icon: React.ReactNode;
}

const ZatcaIcon = () => (
  <svg viewBox="0 0 120 120" className="h-10 md:h-12 w-auto" aria-hidden="true">
    <rect x="10" y="30" width="100" height="60" rx="8" fill="none" stroke="hsl(168 76% 42%)" strokeWidth="3" />
    <path d="M30 50h60M30 65h40M30 80h50" stroke="hsl(168 76% 42%)" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="90" cy="75" r="12" fill="hsl(168 76% 42%)" opacity="0.15" />
    <path d="M86 75l3 3 6-6" stroke="hsl(168 76% 42%)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MocIcon = () => (
  <svg viewBox="0 0 120 120" className="h-10 md:h-12 w-auto" aria-hidden="true">
    <path d="M60 15L20 40v5h80v-5L60 15z" fill="none" stroke="hsl(168 76% 42%)" strokeWidth="3" strokeLinejoin="round" />
    <rect x="30" y="50" width="12" height="35" rx="2" fill="hsl(168 76% 42%)" opacity="0.2" stroke="hsl(168 76% 42%)" strokeWidth="2" />
    <rect x="54" y="50" width="12" height="35" rx="2" fill="hsl(168 76% 42%)" opacity="0.2" stroke="hsl(168 76% 42%)" strokeWidth="2" />
    <rect x="78" y="50" width="12" height="35" rx="2" fill="hsl(168 76% 42%)" opacity="0.2" stroke="hsl(168 76% 42%)" strokeWidth="2" />
    <rect x="18" y="88" width="84" height="8" rx="3" fill="none" stroke="hsl(168 76% 42%)" strokeWidth="2.5" />
  </svg>
);

const MaroofIcon = () => (
  <svg viewBox="0 0 120 120" className="h-10 md:h-12 w-auto" aria-hidden="true">
    <circle cx="60" cy="55" r="30" fill="none" stroke="hsl(168 76% 42%)" strokeWidth="3" />
    <path d="M48 55l8 8 16-16" stroke="hsl(168 76% 42%)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M60 88v15M45 100h30" stroke="hsl(168 76% 42%)" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const RegulationsIcon = () => (
  <svg viewBox="0 0 120 120" className="h-10 md:h-12 w-auto" aria-hidden="true">
    <rect x="25" y="15" width="55" height="75" rx="5" fill="none" stroke="hsl(168 76% 42%)" strokeWidth="3" />
    <path d="M38 35h30M38 48h25M38 61h20" stroke="hsl(168 76% 42%)" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="82" cy="78" r="20" fill="hsl(220 30% 10%)" stroke="hsl(168 76% 42%)" strokeWidth="3" />
    <path d="M76 78l4 4 8-8" stroke="hsl(168 76% 42%)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const items: ComplianceItem[] = [
  {
    label: "ZATCA Phase 2",
    description: "متوافق مع متطلبات ZATCA Phase 2",
    icon: <ZatcaIcon />,
  },
  {
    label: "وزارة التجارة",
    description: "مسجّل كشركة سعودية",
    icon: <MocIcon />,
  },
  {
    label: "معروف",
    description: "حساب معروف موثّق",
    icon: <MaroofIcon />,
  },
  {
    label: "الأنظمة التجارية",
    description: "يعمل وفق الأنظمة التجارية السعودية",
    icon: <RegulationsIcon />,
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: "easeOut" as const },
  }),
};

const ComplianceTrustSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div ref={ref} className="mt-14 mb-2">
      {/* Title */}
      <motion.h3
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="text-center text-sm md:text-base font-bold mb-8"
        style={{ color: "hsl(210 20% 90%)" }}
      >
        ملتزم بالأنظمة السعودية الرسمية
      </motion.h3>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            custom={i}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            variants={cardVariants}
            className="group flex flex-col items-center text-center rounded-xl border border-white/10 bg-white/[0.04] p-6 transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_8px_30px_-12px_hsl(168_76%_42%/0.15)] hover:border-accent/25"
          >
            <div className="mb-4 transition-transform duration-300 group-hover:scale-105">
              {item.icon}
            </div>
            <span
              className="text-xs font-bold tracking-wide mb-1.5"
              style={{ color: "hsl(168 76% 52%)" }}
            >
              {item.label}
            </span>
            <span
              className="text-[11px] leading-relaxed"
              style={{ color: "hsl(210 20% 75%)" }}
            >
              {item.description}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default memo(ComplianceTrustSection);
