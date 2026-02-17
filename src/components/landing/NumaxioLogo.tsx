import { motion } from "framer-motion";

interface NumaxioLogoProps {
  className?: string;
  variant?: "light" | "dark" | "auto";
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { icon: 28, text: "text-lg", gap: "gap-2" },
  md: { icon: 34, text: "text-xl", gap: "gap-2.5" },
  lg: { icon: 42, text: "text-2xl", gap: "gap-3" },
};

const NumaxioLogo = ({ className = "", variant = "auto", showText = true, size = "md" }: NumaxioLogoProps) => {
  const s = sizeMap[size];
  
  const textColor = variant === "light" 
    ? "text-white" 
    : variant === "dark" 
    ? "text-foreground" 
    : "text-current";

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      {/* Icon Mark */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shield/Growth shape */}
        <defs>
          <linearGradient id="logoGrad1" x1="0" y1="0" x2="48" y2="48">
            <stop offset="0%" stopColor="hsl(172, 66%, 50%)" />
            <stop offset="100%" stopColor="hsl(172, 66%, 36%)" />
          </linearGradient>
          <linearGradient id="logoGrad2" x1="0" y1="48" x2="48" y2="0">
            <stop offset="0%" stopColor="hsl(220, 70%, 45%)" />
            <stop offset="100%" stopColor="hsl(220, 70%, 55%)" />
          </linearGradient>
        </defs>
        {/* Background rounded square */}
        <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#logoGrad1)" />
        {/* Abstract N letterform / chart bars */}
        <path d="M14 32V22L20 28V18L26 24V16L32 22V12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dot accent */}
        <circle cx="36" cy="14" r="3" fill="white" opacity="0.9" />
        {/* Base line */}
        <line x1="12" y1="36" x2="36" y2="36" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      </svg>

      {/* Wordmark */}
      {showText && (
        <div className={`flex flex-col leading-none`}>
          <span className={`${s.text} font-bold tracking-tight ${textColor}`} style={{ fontFamily: "'Inter', sans-serif" }}>
            NUMAXIO
          </span>
          <span className="text-[9px] tracking-[0.2em] text-accent font-semibold mt-0.5">
            نيوماكسيو
          </span>
        </div>
      )}
    </div>
  );
};

export default NumaxioLogo;
