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
      className={cn("flex items-center gap-2.5 shrink-0 whitespace-nowrap", className)}
      aria-label="Numaxio - Saudi ERP"
    >
      {/* Icon */}
      <div className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
        <img
          src={numaxioLogo}
          alt="Numaxio"
          className="h-full w-full object-contain"
          draggable={false}
        />
      </div>

      {/* Wordmark + subtitle stacked */}
      <div className="flex flex-col justify-center leading-none min-w-0">
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
              "hidden sm:block text-[10px] sm:text-xs leading-none mt-0.5 opacity-60",
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
