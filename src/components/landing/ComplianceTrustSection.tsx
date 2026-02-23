import { memo } from "react";
import { useTranslation } from "react-i18next";

/* ── Minimal SVG icons for integrations ── */
const ZatcaIcon = () => (
  <svg viewBox="0 0 80 80" className="h-8 w-auto" aria-hidden="true">
    <rect x="8" y="20" width="64" height="40" rx="6" fill="none" stroke="currentColor" strokeWidth="2.5" />
    <path d="M22 34h36M22 44h24M22 54h28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="58" cy="50" r="8" fill="currentColor" opacity="0.12" />
    <path d="M55 50l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const VatIcon = () => (
  <svg viewBox="0 0 80 80" className="h-8 w-auto" aria-hidden="true">
    <rect x="12" y="18" width="56" height="44" rx="5" fill="none" stroke="currentColor" strokeWidth="2.5" />
    <text x="40" y="46" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="700" fontFamily="system-ui">VAT</text>
  </svg>
);

const CloudIcon = () => (
  <svg viewBox="0 0 80 80" className="h-8 w-auto" aria-hidden="true">
    <path d="M20 52a14 14 0 0 1 2-27.8A18 18 0 0 1 56 28a12 12 0 0 1 4 23.3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M32 48l8 8 8-8M40 56V38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 80 80" className="h-8 w-auto" aria-hidden="true">
    <path d="M40 12L14 26v18c0 16 11 28 26 32 15-4 26-16 26-32V26L40 12z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M30 42l7 7 13-13" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface IntegrationItem {
  icon: React.ReactNode;
  label: string;
  desc: string;
}

const ComplianceTrustSection = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith("ar");

  const items: IntegrationItem[] = [
    {
      icon: <ZatcaIcon />,
      label: "ZATCA Phase 2",
      desc: isRTL ? "متوافق مع الفوترة الإلكترونية" : "E-invoicing compatible",
    },
    {
      icon: <VatIcon />,
      label: isRTL ? "ضريبة القيمة المضافة" : "VAT Returns",
      desc: isRTL ? "يدعم الإقرار الضريبي" : "Supports tax filing",
    },
    {
      icon: <CloudIcon />,
      label: isRTL ? "استضافة سعودية" : "Saudi Hosting",
      desc: isRTL ? "بيانات داخل المملكة" : "Data hosted in KSA",
    },
    {
      icon: <ShieldIcon />,
      label: isRTL ? "تشفير AES-256" : "AES-256 Encryption",
      desc: isRTL ? "حماية متقدمة للبيانات" : "Advanced data protection",
    },
  ];

  return (
    <div className="mt-10 pt-8 border-t" style={{ borderColor: "hsl(220 20% 18%)" }}>
      <h3
        className="text-center text-xs font-semibold uppercase tracking-wider mb-6"
        style={{ color: "hsl(210 20% 55%)" }}
      >
        {t("landing.footer.integrationsTitle")}
      </h3>

      <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 lg:gap-10">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2.5 text-[hsl(210_20%_60%)] transition-colors hover:text-accent"
          >
            {item.icon}
            <div className="min-w-0">
              <span className="block text-xs font-semibold leading-tight" style={{ color: "inherit" }}>
                {item.label}
              </span>
              <span className="block text-[10px] leading-tight" style={{ color: "hsl(210 20% 50%)" }}>
                {item.desc}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default memo(ComplianceTrustSection);
