import { cn } from "@/lib/utils";
import { useTheme } from "@/theme/ThemeProvider";

interface RamadanGlowProps {
  enabled?: boolean;
  className?: string;
  /** "top" = أعلى الصفحة, "hero" = يغطي منطقة واسعة */
  variant?: "top" | "hero" | "subtle";
}

/**
 * RamadanGlow — توهج رمضاني خفيف
 * يظهر فقط عند تفعيل ثيم رمضان، قابل للتعطيل بـ prop
 */
export function RamadanGlow({ enabled = true, className, variant = "top" }: RamadanGlowProps) {
  const { seasonalTheme, mode } = useTheme();

  if (!enabled || seasonalTheme !== "ramadan") return null;

  const isDark = mode === "dark";

  if (variant === "top") {
    return (
      <div
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden", className)}
      >
        {/* Gold glow — يمين */}
        <div
          className="absolute -top-20 end-0 h-64 w-64 rounded-full md:h-96 md:w-96"
          style={{
            background: `radial-gradient(ellipse, hsl(var(--ramadan-gold) / ${isDark ? "0.14" : "0.08"}) 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />
        {/* Emerald glow — يسار */}
        <div
          className="absolute -top-16 start-0 h-56 w-56 rounded-full md:h-80 md:w-80"
          style={{
            background: `radial-gradient(ellipse, hsl(var(--ramadan-emerald) / ${isDark ? "0.1" : "0.06"}) 0%, transparent 70%)`,
            filter: "blur(50px)",
          }}
        />
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 60% 40% at 80% 20%, hsl(var(--ramadan-gold) / ${isDark ? "0.12" : "0.07"}) 0%, transparent 60%),
              radial-gradient(ellipse 50% 40% at 20% 70%, hsl(var(--ramadan-emerald) / ${isDark ? "0.1" : "0.05"}) 0%, transparent 60%)
            `,
          }}
        />
      </div>
    );
  }

  // subtle
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-x-0 top-0 z-0 h-px", className)}
      style={{
        background: `linear-gradient(90deg, transparent, hsl(var(--ramadan-gold) / ${isDark ? "0.5" : "0.3"}), hsl(var(--ramadan-emerald) / ${isDark ? "0.4" : "0.25"}), transparent)`,
      }}
    />
  );
}
