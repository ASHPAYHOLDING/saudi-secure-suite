import numaxioLogo from "@/assets/numaxio-logo.png";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

interface BrandLockupProps {
  variant?: "light" | "dark";
  showSubtitle?: boolean;
  className?: string;
}

const BrandLockup = ({ variant = "dark", showSubtitle = true, className }: BrandLockupProps) => {
  const { currentLang } = useLanguage();
  const isLight = variant === "light";

  return (
    <div
      className={cn("flex items-center gap-2 shrink-0", className)}
      aria-label="Numaxio - Saudi ERP"
    >
      {/* Icon */}
      <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 shrink-0">
        <img
          src={numaxioLogo}
          alt="Numaxio"
          className="h-full w-full object-contain"
          draggable={false}
        />
      </div>

      {/* Wordmark */}
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "text-base sm:text-lg font-semibold tracking-tight",
            isLight ? "text-white" : "text-foreground"
          )}
        >
          NUMAXIO
        </span>
        {showSubtitle && (
          <span
            className={cn(
              "hidden sm:block text-[10px] sm:text-xs font-medium opacity-60",
              isLight ? "text-white" : "text-muted-foreground"
            )}
          >
            {currentLang === "ar" ? "ERP سعودي" : "Saudi ERP"}
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandLockup;
