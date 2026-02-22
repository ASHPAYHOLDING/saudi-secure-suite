import { cn } from "@/lib/utils";

interface BrandLockupProps {
  variant?: "light" | "dark";
  showSubtitle?: boolean;
  className?: string;
}

/**
 * Numaxio Brand Mark — "Flow of Financial Intelligence"
 * Abstract symbol: three flowing data streams converging into
 * a central intelligence node, representing AI-powered financial systems.
 */
const BrandLockup = ({ variant = "dark", className }: BrandLockupProps) => {
  const isLight = variant === "light";

  return (
    <div
      className={cn("flex items-center gap-2.5 shrink-0 group", className)}
      aria-label="Numaxio"
    >
      {/* Abstract brand mark */}
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-8 md:h-9 w-auto shrink-0 brand-mark"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="nm-grad" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22D3EE" />
            <stop offset="0.5" stopColor="#2EC4B6" />
            <stop offset="1" stopColor="#14B8A6" />
          </linearGradient>
          <filter id="nm-glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#nm-glow)" className="brand-mark-paths">
          {/* Stream 1 — top-left arc flowing into center */}
          <path
            d="M6 10C6 10 12 6 18 12C24 18 18 18 18 18"
            stroke="url(#nm-grad)"
            strokeWidth="2"
            strokeLinecap="round"
            className="brand-stream"
            style={{ strokeDasharray: 32, strokeDashoffset: 32 }}
          />
          {/* Stream 2 — bottom-left flowing up into center */}
          <path
            d="M8 28C8 28 10 20 18 18"
            stroke="url(#nm-grad)"
            strokeWidth="2"
            strokeLinecap="round"
            className="brand-stream"
            style={{ strokeDasharray: 20, strokeDashoffset: 20 }}
          />
          {/* Stream 3 — right side flowing into center */}
          <path
            d="M30 8C30 8 26 16 18 18"
            stroke="url(#nm-grad)"
            strokeWidth="2"
            strokeLinecap="round"
            className="brand-stream"
            style={{ strokeDasharray: 20, strokeDashoffset: 20 }}
          />
          {/* Outflow — center radiating down-right */}
          <path
            d="M18 18C18 18 24 24 30 28"
            stroke="url(#nm-grad)"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.6"
            className="brand-stream"
            style={{ strokeDasharray: 18, strokeDashoffset: 18 }}
          />

          {/* Central node — intelligence core */}
          <circle
            cx="18"
            cy="18"
            r="2.5"
            fill="url(#nm-grad)"
            opacity="0"
            className="brand-node"
          />
          {/* Orbiting data nodes */}
          <circle cx="6" cy="10" r="1.5" fill="url(#nm-grad)" opacity="0" className="brand-node" />
          <circle cx="30" cy="8" r="1.2" fill="url(#nm-grad)" opacity="0" className="brand-node" />
          <circle cx="8" cy="28" r="1.2" fill="url(#nm-grad)" opacity="0" className="brand-node" />
        </g>
      </svg>

      {/* Wordmark */}
      <span
        className={cn(
          "text-lg md:text-xl font-semibold tracking-[0.1em] leading-none select-none",
          isLight ? "text-white" : "text-foreground"
        )}
      >
        NUMAXIO
      </span>
    </div>
  );
};

export default BrandLockup;
