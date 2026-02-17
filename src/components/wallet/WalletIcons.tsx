import { useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet, PlusCircle, ArrowDownToLine, Activity,
  ShieldCheck, Lock, Snowflake,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Core animated icon wrapper ──
// Handles: hover (scale 1.05, rotate ±3deg, 120ms)
//          click (bounce scale 0.96→1, ripple)
//          No infinite loops. Static when idle.

interface MicroIconProps {
  icon: LucideIcon;
  size?: number;
  className?: string;
  onClick?: () => void;
  /** Rotation direction on hover: 1 = clockwise, -1 = counter-clockwise */
  rotateDir?: 1 | -1;
  /** Whether to show ripple on click */
  ripple?: boolean;
}

const MicroIcon = ({
  icon: Icon,
  size = 18,
  className = "",
  onClick,
  rotateDir = 1,
  ripple = false,
}: MicroIconProps) => {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (ripple) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();
      setRipples(prev => [...prev, { id, x, y }]);
      setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 400);
    }
    onClick?.();
  };

  return (
    <motion.div
      className={`inline-flex items-center justify-center relative overflow-hidden rounded-md ${onClick ? "cursor-pointer" : ""}`}
      whileHover={{ scale: 1.05, rotate: 3 * rotateDir }}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      transition={{ type: "tween", duration: 0.12 }}
      onClick={handleTap}
    >
      <Icon size={size} className={className} strokeWidth={1.75} />
      {/* Ripple layers */}
      {ripples.map(r => (
        <span
          key={r.id}
          className="absolute rounded-full bg-current opacity-10 animate-[wallet-ripple_0.4s_ease-out_forwards]"
          style={{ left: r.x - 6, top: r.y - 6, width: 12, height: 12 }}
        />
      ))}
    </motion.div>
  );
};

// ── Pre-configured wallet icons ──

/** الرصيد */
export const WalletBalanceIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <MicroIcon icon={Wallet} size={size} className={className} rotateDir={-1} />
);

/** إضافة رصيد */
export const WalletTopupIcon = ({ size = 18, className = "", onClick }: { size?: number; className?: string; onClick?: () => void }) => (
  <MicroIcon icon={PlusCircle} size={size} className={className} onClick={onClick} ripple rotateDir={1} />
);

/** سحب */
export const WalletWithdrawIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <MicroIcon icon={ArrowDownToLine} size={size} className={className} rotateDir={-1} />
);

/** سجل العمليات */
export const WalletActivityIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <MicroIcon icon={Activity} size={size} className={className} rotateDir={1} />
);

/** حالة المحفظة (نشطة) */
export const WalletShieldIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <MicroIcon icon={ShieldCheck} size={size} className={className} rotateDir={1} />
);

/** تجميد - Lock */
export const WalletLockIcon = ({ size = 18, className = "", onClick }: { size?: number; className?: string; onClick?: () => void }) => (
  <MicroIcon icon={Lock} size={size} className={className} onClick={onClick} ripple rotateDir={-1} />
);

/** تجميد - Snowflake */
export const WalletFreezeIcon = ({ size = 18, className = "", onClick }: { size?: number; className?: string; onClick?: () => void }) => (
  <MicroIcon icon={Snowflake} size={size} className={className} onClick={onClick} ripple rotateDir={1} />
);

// Re-export the generic wrapper for custom usage
export { MicroIcon };
export default MicroIcon;
