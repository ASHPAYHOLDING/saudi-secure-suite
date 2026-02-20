import { cn } from "@/lib/utils";
import { useTheme } from "@/theme/ThemeProvider";

interface RamadanDividerProps {
  enabled?: boolean;
  className?: string;
  /** "full" = يمتد بالكامل, "centered" = مُتمركز */
  variant?: "full" | "centered";
}

/**
 * RamadanDivider — فاصل زخرفي إسلامي أنيق
 * يستخدم SVG inline لهلال + نجمتين
 */
export function RamadanDivider({ enabled = true, className, variant = "centered" }: RamadanDividerProps) {
  const { seasonalTheme, mode } = useTheme();

  if (!enabled || seasonalTheme !== "ramadan") return null;

  const isDark = mode === "dark";
  const goldColor = `hsl(var(--ramadan-gold))`;
  const emeraldColor = `hsl(var(--ramadan-emerald))`;
  const lineOpacity = isDark ? "0.2" : "0.12";

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2",
        variant === "centered" && "justify-center",
        className
      )}
      aria-hidden="true"
    >
      {/* خط — يسار (نهاية في RTL) */}
      <div
        className="flex-1 h-px max-w-32"
        style={{
          background: `linear-gradient(to left, transparent, hsl(var(--ramadan-gold) / ${lineOpacity}))`,
        }}
      />

      {/* نجمة صغيرة */}
      <svg width="10" height="10" viewBox="0 0 24 24" fill={goldColor} opacity={isDark ? 0.6 : 0.45}>
        <path d="M12 2L13.8 8.2H20.4L15 11.8L16.8 18L12 14.4L7.2 18L9 11.8L3.6 8.2H10.2L12 2Z"/>
      </svg>

      {/* هلال مركزي */}
      <svg width="22" height="22" viewBox="0 0 80 80" fill={goldColor} opacity={isDark ? 0.75 : 0.55}>
        <path d="M52 16C43.5 16 36.5 22.4 36.5 30.5C36.5 38.6 43.5 45 52 45C55.2 45 58.2 44.1 60.7 42.5C57.5 48.5 51 52.5 43.5 52.5C32.7 52.5 24 43.8 24 33C24 22.2 32.7 13.5 43.5 13.5C46.5 13.5 49.4 14.2 52 15.4V16Z"/>
      </svg>

      {/* نجمة يمين */}
      <svg width="10" height="10" viewBox="0 0 24 24" fill={emeraldColor} opacity={isDark ? 0.55 : 0.4}>
        <path d="M12 2L13.8 8.2H20.4L15 11.8L16.8 18L12 14.4L7.2 18L9 11.8L3.6 8.2H10.2L12 2Z"/>
      </svg>

      {/* خط — يمين (بداية في RTL) */}
      <div
        className="flex-1 h-px max-w-32"
        style={{
          background: `linear-gradient(to right, transparent, hsl(var(--ramadan-emerald) / ${lineOpacity}))`,
        }}
      />
    </div>
  );
}
