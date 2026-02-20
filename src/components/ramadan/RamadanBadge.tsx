import { cn } from "@/lib/utils";
import { useTheme } from "@/theme/ThemeProvider";

interface RamadanBadgeProps {
  enabled?: boolean;
  text?: string;
  className?: string;
  /** size: sm | md */
  size?: "sm" | "md";
}

/**
 * RamadanBadge — بادج رمضاني أنيق
 * هلال + نص + نجمة، ذهبي بحدود ناعمة
 */
export function RamadanBadge({
  enabled = true,
  text = "رمضان كريم",
  className,
  size = "sm",
}: RamadanBadgeProps) {
  const { seasonalTheme, mode } = useTheme();

  if (!enabled || seasonalTheme !== "ramadan") return null;

  const isDark = mode === "dark";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-arabic font-medium",
        // Light: خلفية ذهبية شفافة جداً | Dark: أوضح قليلاً
        isDark
          ? "border-[hsl(var(--ramadan-gold)/0.4)] bg-[hsl(var(--ramadan-gold)/0.12)] text-[hsl(var(--ramadan-gold))]"
          : "border-[hsl(var(--ramadan-gold)/0.3)] bg-[hsl(var(--ramadan-gold)/0.07)] text-[hsl(var(--ramadan-gold))]",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
        // Hover effect خفيف
        "transition-all duration-200 hover:bg-[hsl(var(--ramadan-gold)/0.15)]",
        className
      )}
      role="status"
      aria-label={text}
    >
      {/* هلال */}
      <svg
        width={size === "sm" ? 11 : 14}
        height={size === "sm" ? 11 : 14}
        viewBox="0 0 80 80"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M52 16C43.5 16 36.5 22.4 36.5 30.5C36.5 38.6 43.5 45 52 45C55.2 45 58.2 44.1 60.7 42.5C57.5 48.5 51 52.5 43.5 52.5C32.7 52.5 24 43.8 24 33C24 22.2 32.7 13.5 43.5 13.5C46.5 13.5 49.4 14.2 52 15.4V16Z"/>
      </svg>

      <span>{text}</span>

      {/* نجمة */}
      <svg
        width={size === "sm" ? 8 : 10}
        height={size === "sm" ? 8 : 10}
        viewBox="0 0 24 24"
        fill="currentColor"
        opacity={0.7}
        aria-hidden="true"
      >
        <path d="M12 2L13.8 8.2H20.4L15 11.8L16.8 18L12 14.4L7.2 18L9 11.8L3.6 8.2H10.2L12 2Z"/>
      </svg>
    </div>
  );
}
