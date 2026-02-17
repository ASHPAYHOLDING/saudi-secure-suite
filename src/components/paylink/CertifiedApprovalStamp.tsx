import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

interface CertifiedApprovalStampProps {
  approverName?: string;
  approverTitle?: string;
  approvalDate?: string;
  contractNumber?: string;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: { outer: 120, fontSize: 8 },
  md: { outer: 160, fontSize: 10 },
  lg: { outer: 200, fontSize: 12 },
};

const CertifiedApprovalStamp = ({
  approverName = "مسؤول المنصة",
  approverTitle = "مدير الامتثال",
  approvalDate,
  contractNumber,
  size = "md",
}: CertifiedApprovalStampProps) => {
  const s = sizeConfig[size];
  const formattedDate = approvalDate
    ? new Date(approvalDate).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })
    : new Date().toLocaleDateString("ar-SA");

  return (
    <motion.div
      initial={{ scale: 0, rotate: -45, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.2 }}
      className="flex flex-col items-center gap-2"
    >
      <div
        className="relative flex items-center justify-center select-none pointer-events-none"
        style={{ width: s.outer, height: s.outer }}
      >
        {/* Outer ring */}
        <svg
          viewBox="0 0 200 200"
          className="absolute inset-0 w-full h-full"
          style={{ filter: "drop-shadow(0 2px 8px hsla(160, 60%, 30%, 0.15))" }}
        >
          {/* Outer decorative circle */}
          <circle cx="100" cy="100" r="96" fill="none" stroke="hsl(160 50% 35%)" strokeWidth="3" strokeDasharray="4 2" />
          <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(160 50% 35%)" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="82" fill="none" stroke="hsl(160 50% 35% / 0.4)" strokeWidth="0.8" />

          {/* Top curved text - "معتمد رسمياً" */}
          <defs>
            <path id="topArc" d="M 30,100 A 70,70 0 0,1 170,100" fill="none" />
            <path id="bottomArc" d="M 170,110 A 70,70 0 0,1 30,110" fill="none" />
          </defs>
          <text fill="hsl(160 50% 30%)" fontSize="13" fontWeight="700" fontFamily="IBM Plex Sans Arabic, sans-serif">
            <textPath href="#topArc" startOffset="50%" textAnchor="middle">
              ★ معتمد رسمياً ★
            </textPath>
          </text>
          <text fill="hsl(160 50% 30% / 0.7)" fontSize="10" fontFamily="IBM Plex Sans Arabic, sans-serif">
            <textPath href="#bottomArc" startOffset="50%" textAnchor="middle">
              OFFICIALLY CERTIFIED
            </textPath>
          </text>

          {/* Center shield icon area */}
          <circle cx="100" cy="78" r="14" fill="hsl(160 50% 35% / 0.1)" stroke="hsl(160 50% 35% / 0.3)" strokeWidth="0.8" />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ padding: s.outer * 0.18 }}>
          <ShieldCheck className="text-[hsl(160_50%_35%)]" style={{ width: s.fontSize * 2.2, height: s.fontSize * 2.2, marginBottom: 2 }} />
          <p
            className="font-bold text-center leading-tight"
            style={{ fontSize: s.fontSize + 1, color: "hsl(160 50% 30%)", marginTop: 6 }}
          >
            {approverName}
          </p>
          <p
            className="text-center"
            style={{ fontSize: s.fontSize - 1, color: "hsl(160 50% 35% / 0.7)", marginTop: 1 }}
          >
            {approverTitle}
          </p>
          <div className="w-3/5 my-1" style={{ height: 1, background: "hsl(160 50% 35% / 0.25)" }} />
          <p
            className="text-center font-mono"
            style={{ fontSize: s.fontSize - 2, color: "hsl(160 50% 35% / 0.6)" }}
          >
            {formattedDate}
          </p>
          {contractNumber && (
            <p
              className="text-center font-mono"
              style={{ fontSize: s.fontSize - 2.5, color: "hsl(160 50% 35% / 0.5)", marginTop: 1 }}
            >
              #{contractNumber}
            </p>
          )}
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground text-center">
        ختم إلكتروني معتمد — نظام التعاملات الإلكترونية م/18
      </p>
    </motion.div>
  );
};

export default CertifiedApprovalStamp;
