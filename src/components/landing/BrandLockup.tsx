import numaxioIcon from "@/assets/numaxio-icon.png";
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
      className={cn("flex items-center gap-3 shrink-0", className)}
      aria-label="Numaxio - Saudi Enterprise ERP"
    >
      {/* Monogram icon — no box, no padding */}
      <img
        src={numaxioIcon}
        alt="Numaxio"
        className="h-9 md:h-10 w-auto shrink-0 object-contain"
        draggable={false}
      />

      {/* Wordmark + sub-label stacked */}
      <div className="flex flex-col justify-center leading-none">
        <span
          className={cn(
            "text-lg md:text-xl font-semibold tracking-[0.08em]",
            isLight ? "text-white" : "text-foreground"
          )}
        >
          NUMAXIO
        </span>
        {showSubtitle && (
          <span
            className={cn(
              "hidden sm:block text-[11px] leading-none mt-0.5 opacity-60",
              isLight ? "text-white" : "text-muted-foreground"
            )}
          >
            {currentLang === "ar" ? "نظام ERP سعودي للمؤسسات" : "Saudi Enterprise ERP"}
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandLockup;
