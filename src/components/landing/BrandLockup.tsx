import { cn } from "@/lib/utils";

interface BrandLockupProps {
  variant?: "light" | "dark";
  showSubtitle?: boolean;
  className?: string;
}

const BrandLockup = ({ variant = "dark", className }: BrandLockupProps) => {
  const isLight = variant === "light";

  return (
    <div
      className={cn("flex items-center gap-2.5 shrink-0 group", className)}
      aria-label="Numaxio"
    >
      {/* Geometric N monogram — refined two-stroke + diagonal */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-7 md:h-8 w-auto shrink-0 transition-transform duration-300 group-hover:scale-[1.03]"
        aria-hidden="true"
        style={{
          animation: "brand-idle 8s ease-in-out infinite, brand-draw 0.7s ease-out both",
        }}
      >
        <defs>
          <linearGradient id="n-stroke" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2EC4B6" />
            <stop offset="1" stopColor="#1F9D8B" />
          </linearGradient>
        </defs>
        <path
          d="M7 26V6.5L25 25.5V6"
          stroke="url(#n-stroke)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 68,
            strokeDashoffset: 0,
          }}
        />
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
