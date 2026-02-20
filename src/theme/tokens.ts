/**
 * Theme Token Definitions
 * كل التوكنز المرجعية للثيمات (Default + Ramadan) × (Light + Dark)
 */

// ─── Ramadan Date Config ─────────────────────────────────────
// عدّل هذه القيم لتحديد نطاق رمضان
export const RAMADAN_CONFIG = {
  ramadanStart: "2026-02-18",
  ramadanEnd:   "2026-03-20",
} as const;

/** يتحقق إذا كان التاريخ الحالي ضمن نطاق رمضان */
export function isCurrentlyRamadan(): boolean {
  const now  = new Date();
  const start = new Date(RAMADAN_CONFIG.ramadanStart);
  const end   = new Date(RAMADAN_CONFIG.ramadanEnd);
  end.setHours(23, 59, 59, 999);
  return now >= start && now <= end;
}

export type ThemeMode = "light" | "dark";
export type SeasonalTheme = "default" | "ramadan";


export interface ThemeTokens {
  // Base
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;

  // Brand
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;

  // Semantic
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  info: string;
  infoForeground: string;

  // UI
  border: string;
  input: string;
  ring: string;
  radius: string;

  // Sidebar
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;

  // Gradients
  gradientHero: string;
  gradientAccent: string;
  gradientCard: string;

  // Shadows
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowAccent: string;

  // Ramadan-specific (undefined in default theme)
  ramadanPattern?: string;
  ramadanGold?: string;
  ramadanEmerald?: string;
}

// ─── Default Light ───────────────────────────────────────────
const defaultLight: ThemeTokens = {
  background: "210 20% 98%",
  foreground: "220 25% 10%",
  card: "0 0% 100%",
  cardForeground: "220 25% 10%",
  popover: "0 0% 100%",
  popoverForeground: "220 25% 10%",
  primary: "220 30% 14%",
  primaryForeground: "210 20% 98%",
  secondary: "210 15% 95%",
  secondaryForeground: "220 25% 14%",
  muted: "210 12% 93%",
  mutedForeground: "215 12% 50%",
  accent: "172 66% 36%",
  accentForeground: "0 0% 100%",
  destructive: "0 72% 51%",
  destructiveForeground: "0 0% 100%",
  success: "152 60% 40%",
  successForeground: "0 0% 100%",
  warning: "38 92% 50%",
  warningForeground: "0 0% 100%",
  info: "205 80% 50%",
  infoForeground: "0 0% 100%",
  border: "214 18% 90%",
  input: "214 18% 88%",
  ring: "172 66% 36%",
  radius: "0.625rem",
  sidebarBackground: "220 30% 12%",
  sidebarForeground: "210 20% 85%",
  sidebarPrimary: "172 66% 44%",
  sidebarPrimaryForeground: "0 0% 100%",
  sidebarAccent: "220 25% 18%",
  sidebarAccentForeground: "210 20% 90%",
  sidebarBorder: "220 20% 20%",
  sidebarRing: "172 66% 44%",
  gradientHero: "linear-gradient(135deg, hsl(220 30% 12%) 0%, hsl(220 35% 22%) 50%, hsl(172 50% 25%) 100%)",
  gradientAccent: "linear-gradient(135deg, hsl(172 66% 36%) 0%, hsl(172 66% 48%) 100%)",
  gradientCard: "linear-gradient(145deg, hsl(0 0% 100%) 0%, hsl(210 20% 97%) 100%)",
  shadowSm: "0 1px 3px 0 hsl(220 25% 10% / 0.04)",
  shadowMd: "0 4px 16px -2px hsl(220 25% 10% / 0.06)",
  shadowLg: "0 12px 40px -8px hsl(220 25% 10% / 0.1)",
  shadowAccent: "0 4px 20px -4px hsl(172 66% 36% / 0.3)",
};

// ─── Default Dark ────────────────────────────────────────────
const defaultDark: ThemeTokens = {
  background: "220 30% 6%",
  foreground: "210 20% 95%",
  card: "220 28% 10%",
  cardForeground: "210 20% 95%",
  popover: "220 28% 10%",
  popoverForeground: "210 20% 95%",
  primary: "210 20% 95%",
  primaryForeground: "220 30% 10%",
  secondary: "220 25% 15%",
  secondaryForeground: "210 20% 90%",
  muted: "220 20% 16%",
  mutedForeground: "215 15% 60%",
  accent: "172 66% 44%",
  accentForeground: "0 0% 100%",
  destructive: "0 62% 40%",
  destructiveForeground: "0 0% 100%",
  success: "152 55% 45%",
  successForeground: "0 0% 100%",
  warning: "38 85% 55%",
  warningForeground: "0 0% 0%",
  info: "205 75% 55%",
  infoForeground: "0 0% 100%",
  border: "220 20% 18%",
  input: "220 20% 18%",
  ring: "172 66% 44%",
  radius: "0.625rem",
  sidebarBackground: "220 35% 6%",
  sidebarForeground: "210 20% 85%",
  sidebarPrimary: "172 66% 44%",
  sidebarPrimaryForeground: "0 0% 100%",
  sidebarAccent: "220 25% 12%",
  sidebarAccentForeground: "210 20% 90%",
  sidebarBorder: "220 20% 14%",
  sidebarRing: "172 66% 44%",
  gradientHero: "linear-gradient(135deg, hsl(220 35% 5%) 0%, hsl(220 30% 12%) 50%, hsl(172 50% 18%) 100%)",
  gradientAccent: "linear-gradient(135deg, hsl(172 66% 40%) 0%, hsl(172 66% 52%) 100%)",
  gradientCard: "linear-gradient(145deg, hsl(220 28% 10%) 0%, hsl(220 25% 13%) 100%)",
  shadowSm: "0 1px 3px 0 hsl(0 0% 0% / 0.2)",
  shadowMd: "0 4px 16px -2px hsl(0 0% 0% / 0.3)",
  shadowLg: "0 12px 40px -8px hsl(0 0% 0% / 0.4)",
  shadowAccent: "0 4px 20px -4px hsl(172 66% 44% / 0.35)",
};

// ─── Ramadan Light ───────────────────────────────────────────
// Emerald #047857 + Gold #D97706 + Night Blue #1E1B4B
const ramadanLight: ThemeTokens = {
  background: "240 25% 97%",           // خلفية بيضاء مع لمسة زرقاء خفيفة
  foreground: "240 45% 12%",           // نص داكن غامق
  card: "0 0% 100%",
  cardForeground: "240 45% 12%",
  popover: "0 0% 100%",
  popoverForeground: "240 45% 12%",
  primary: "240 45% 18%",              // Night Blue العميق
  primaryForeground: "45 95% 95%",     // ذهبي فاتح
  secondary: "240 20% 94%",
  secondaryForeground: "240 45% 20%",
  muted: "240 15% 92%",
  mutedForeground: "240 15% 48%",
  accent: "160 84% 39%",               // Emerald الزمردي
  accentForeground: "0 0% 100%",
  destructive: "0 72% 51%",
  destructiveForeground: "0 0% 100%",
  success: "160 84% 39%",              // Emerald
  successForeground: "0 0% 100%",
  warning: "38 92% 50%",               // Gold
  warningForeground: "0 0% 100%",
  info: "205 80% 50%",
  infoForeground: "0 0% 100%",
  border: "240 18% 88%",
  input: "240 18% 86%",
  ring: "38 85% 45%",                  // حلقة ذهبية
  radius: "0.75rem",                   // زوايا أكثر نعومة في رمضان
  sidebarBackground: "240 45% 12%",    // Night Blue للشريط الجانبي
  sidebarForeground: "45 60% 88%",     // ذهبي فاتح
  sidebarPrimary: "38 85% 52%",        // Gold
  sidebarPrimaryForeground: "240 45% 10%",
  sidebarAccent: "240 40% 18%",
  sidebarAccentForeground: "45 60% 90%",
  sidebarBorder: "240 35% 22%",
  sidebarRing: "38 85% 52%",
  gradientHero: "linear-gradient(135deg, hsl(240 45% 12%) 0%, hsl(240 50% 22%) 40%, hsl(160 60% 22%) 100%)",
  gradientAccent: "linear-gradient(135deg, hsl(38 85% 45%) 0%, hsl(45 90% 60%) 100%)",
  gradientCard: "linear-gradient(145deg, hsl(0 0% 100%) 0%, hsl(240 25% 97%) 50%, hsl(160 20% 97%) 100%)",
  shadowSm: "0 1px 3px 0 hsl(240 45% 12% / 0.06)",
  shadowMd: "0 4px 16px -2px hsl(240 45% 12% / 0.08)",
  shadowLg: "0 12px 40px -8px hsl(240 45% 12% / 0.12)",
  shadowAccent: "0 4px 20px -4px hsl(38 85% 45% / 0.35)",
  ramadanGold: "38 85% 52%",
  ramadanEmerald: "160 84% 39%",
  ramadanPattern: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231E1B4B' fill-opacity='0.025'%3E%3Cpath d='M30 0l8.66 15H21.34L30 0zm0 60l-8.66-15h17.32L30 60zM0 30l15-8.66v17.32L0 30zm60 0l-15 8.66V21.34L60 30z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
};

// ─── Ramadan Dark ────────────────────────────────────────────
const ramadanDark: ThemeTokens = {
  background: "240 40% 5%",            // أعمق من Dark الافتراضي — ليلة رمضانية
  foreground: "45 60% 92%",            // نص ذهبي دافئ
  card: "240 38% 9%",
  cardForeground: "45 60% 92%",
  popover: "240 38% 9%",
  popoverForeground: "45 60% 92%",
  primary: "45 90% 68%",               // ذهبي واضح في الداكن
  primaryForeground: "240 45% 8%",
  secondary: "240 30% 14%",
  secondaryForeground: "45 50% 80%",
  muted: "240 25% 14%",
  mutedForeground: "240 20% 60%",
  accent: "160 70% 48%",               // Emerald مضيء
  accentForeground: "0 0% 100%",
  destructive: "0 62% 42%",
  destructiveForeground: "0 0% 100%",
  success: "160 70% 48%",
  successForeground: "0 0% 100%",
  warning: "38 85% 58%",
  warningForeground: "0 0% 0%",
  info: "205 75% 55%",
  infoForeground: "0 0% 100%",
  border: "240 25% 18%",
  input: "240 25% 18%",
  ring: "45 90% 60%",
  radius: "0.75rem",
  sidebarBackground: "240 45% 4%",
  sidebarForeground: "45 60% 82%",
  sidebarPrimary: "45 90% 62%",
  sidebarPrimaryForeground: "240 45% 6%",
  sidebarAccent: "240 38% 10%",
  sidebarAccentForeground: "45 55% 85%",
  sidebarBorder: "240 30% 16%",
  sidebarRing: "45 90% 62%",
  gradientHero: "linear-gradient(135deg, hsl(240 45% 4%) 0%, hsl(240 40% 10%) 40%, hsl(160 40% 10%) 100%)",
  gradientAccent: "linear-gradient(135deg, hsl(38 85% 48%) 0%, hsl(45 90% 62%) 100%)",
  gradientCard: "linear-gradient(145deg, hsl(240 38% 9%) 0%, hsl(240 35% 12%) 100%)",
  shadowSm: "0 1px 3px 0 hsl(0 0% 0% / 0.25)",
  shadowMd: "0 4px 16px -2px hsl(0 0% 0% / 0.4)",
  shadowLg: "0 12px 40px -8px hsl(0 0% 0% / 0.55)",
  shadowAccent: "0 4px 24px -4px hsl(38 85% 50% / 0.4)",
  ramadanGold: "45 90% 62%",
  ramadanEmerald: "160 70% 48%",
  ramadanPattern: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23D97706' fill-opacity='0.04'%3E%3Cpath d='M30 0l8.66 15H21.34L30 0zm0 60l-8.66-15h17.32L30 60zM0 30l15-8.66v17.32L0 30zm60 0l-15 8.66V21.34L60 30z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
};

export const THEME_TOKENS: Record<SeasonalTheme, Record<ThemeMode, ThemeTokens>> = {
  default: {
    light: defaultLight,
    dark: defaultDark,
  },
  ramadan: {
    light: ramadanLight,
    dark: ramadanDark,
  },
};
