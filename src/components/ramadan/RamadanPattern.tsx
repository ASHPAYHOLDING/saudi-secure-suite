import { cn } from "@/lib/utils";
import { useTheme } from "@/theme/ThemeProvider";

interface RamadanPatternProps {
  enabled?: boolean;
  className?: string;
  /** opacity 0–1 — default يختلف حسب light/dark */
  opacity?: number;
}

/**
 * RamadanPattern — خلفية باترن هندسي إسلامي
 * SVG نظيف، opacity منخفض جداً، يختفي تلقائياً في الشاشات الصغيرة (اختياري)
 */
export function RamadanPattern({ enabled = true, className, opacity }: RamadanPatternProps) {
  const { seasonalTheme, mode } = useTheme();

  if (!enabled || seasonalTheme !== "ramadan") return null;

  const isDark = mode === "dark";
  const defaultOpacity = isDark ? 0.07 : 0.04;
  const finalOpacity = opacity ?? defaultOpacity;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-0",
        className
      )}
      style={{
        // في الشاشات الصغيرة نخفّف عبر media query — هنا نضع القيمة الكاملة
        opacity: finalOpacity,
      }}
    >
      <div
        className="absolute inset-0 sm:opacity-100 opacity-50"
        style={{
          backgroundImage: `url('/themes/ramadan/pattern.svg')`,
          backgroundRepeat: "repeat",
          backgroundSize: "120px 120px",
          filter: isDark
            ? "invert(0.8) sepia(0.3) hue-rotate(20deg)"
            : "sepia(0.5) hue-rotate(200deg)",
          maskImage: "radial-gradient(ellipse 90% 90% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 90% at 50% 50%, black 30%, transparent 100%)",
        }}
      />
    </div>
  );
}
