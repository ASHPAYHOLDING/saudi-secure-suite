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
  sm: { outer: 130, fontSize: 9 },
  md: { outer: 170, fontSize: 11 },
  lg: { outer: 210, fontSize: 13 },
};

const CertifiedApprovalStamp = ({
  approverName = "نيوماكسيو",
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
      initial={{ scale: 0, rotate: -30, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.2 }}
      className="flex flex-col items-center gap-2"
    >
      <div
        className="relative flex items-center justify-center select-none pointer-events-none"
        style={{ width: s.outer, height: s.outer }}
      >
        {/* Outer decorative rings */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: "3px double hsl(160 50% 35%)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            inset: 6,
            border: "1.5px solid hsl(160 50% 35%)",
            opacity: 0.7,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            inset: 12,
            border: "1px solid hsl(160 50% 35% / 0.3)",
          }}
        />

        {/* Top text */}
        <div
          className="absolute text-center font-bold"
          style={{
            top: s.outer * 0.08,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: s.fontSize - 1,
            color: "hsl(160 50% 30%)",
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
          }}
        >
          ★ معتمد رسمياً ★
        </div>

        {/* Center content */}
        <div className="flex flex-col items-center justify-center text-center" style={{ padding: s.outer * 0.15, paddingTop: s.outer * 0.28 }}>
          <ShieldCheck
            className="text-[hsl(160_50%_35%)]"
            style={{ width: s.fontSize * 2, height: s.fontSize * 2 }}
          />
          <p
            className="font-bold leading-tight mt-1"
            style={{ fontSize: s.fontSize + 2, color: "hsl(160 50% 28%)" }}
          >
            {approverName}
          </p>
          <p
            style={{ fontSize: s.fontSize - 1, color: "hsl(160 50% 35% / 0.75)", marginTop: 2 }}
          >
            {approverTitle}
          </p>
          <div
            className="my-1.5"
            style={{ width: "60%", height: 1, background: "hsl(160 50% 35% / 0.25)" }}
          />
          <p
            className="font-mono"
            style={{ fontSize: s.fontSize - 2.5, color: "hsl(160 50% 35% / 0.6)" }}
          >
            {formattedDate}
          </p>
          {contractNumber && (
            <p
              className="font-mono"
              style={{ fontSize: s.fontSize - 3, color: "hsl(160 50% 35% / 0.5)", marginTop: 1 }}
            >
              {contractNumber}
            </p>
          )}
        </div>

        {/* Bottom text */}
        <div
          className="absolute text-center"
          style={{
            bottom: s.outer * 0.07,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: s.fontSize - 2.5,
            color: "hsl(160 50% 35% / 0.6)",
            whiteSpace: "nowrap",
            letterSpacing: "0.03em",
          }}
        >
          OFFICIALLY CERTIFIED
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground text-center">
        ختم إلكتروني معتمد — نظام التعاملات الإلكترونية م/18
      </p>
    </motion.div>
  );
};

export default CertifiedApprovalStamp;
