import { useLanguage } from "@/hooks/useLanguage";
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
      className={cn("flex items-center gap-3 shrink-0", className)}
      aria-label="Numaxio"
    >
      {/* Geometric hollow N monogram */}
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-9 md:h-10 w-auto shrink-0 animate-[float_6s_ease-in-out_infinite]"
        aria-hidden="true"
      >
        <path
          d="M8 32V8L32 32V8"
          stroke="#2EC4B6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Wordmark */}
      <span
        className={cn(
          "text-xl md:text-2xl font-semibold tracking-[0.12em] leading-none",
          isLight ? "text-white" : "text-foreground"
        )}
      >
        NUMAXIO
      </span>
    </div>
  );
};

export default BrandLockup;
