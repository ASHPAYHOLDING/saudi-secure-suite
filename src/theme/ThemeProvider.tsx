import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ThemeMode, SeasonalTheme, THEME_TOKENS, ThemeTokens } from "./tokens";

// ─── Types ──────────────────────────────────────────────────
interface ThemeContextValue {
  mode: ThemeMode;
  seasonalTheme: SeasonalTheme;
  setMode: (mode: ThemeMode) => void;
  setSeasonalTheme: (theme: SeasonalTheme) => void;
  toggleMode: () => void;
  tokens: ThemeTokens;
}

// ─── Context ─────────────────────────────────────────────────
const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Helpers ─────────────────────────────────────────────────
const LS_MODE_KEY = "numaxio-theme-mode";
const LS_SEASONAL_KEY = "numaxio-theme-seasonal";

function applyTokens(tokens: ThemeTokens, mode: ThemeMode, seasonal: SeasonalTheme) {
  const root = document.documentElement;

  // data attributes
  root.setAttribute("data-mode", mode);
  root.setAttribute("data-theme", seasonal);

  // dark class (for Tailwind .dark: utilities)
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Apply all CSS variables
  const vars: Record<string, string> = {
    "--background": tokens.background,
    "--foreground": tokens.foreground,
    "--card": tokens.card,
    "--card-foreground": tokens.cardForeground,
    "--popover": tokens.popover,
    "--popover-foreground": tokens.popoverForeground,
    "--primary": tokens.primary,
    "--primary-foreground": tokens.primaryForeground,
    "--secondary": tokens.secondary,
    "--secondary-foreground": tokens.secondaryForeground,
    "--muted": tokens.muted,
    "--muted-foreground": tokens.mutedForeground,
    "--accent": tokens.accent,
    "--accent-foreground": tokens.accentForeground,
    "--destructive": tokens.destructive,
    "--destructive-foreground": tokens.destructiveForeground,
    "--success": tokens.success,
    "--success-foreground": tokens.successForeground,
    "--warning": tokens.warning,
    "--warning-foreground": tokens.warningForeground,
    "--info": tokens.info,
    "--info-foreground": tokens.infoForeground,
    "--border": tokens.border,
    "--input": tokens.input,
    "--ring": tokens.ring,
    "--radius": tokens.radius,
    "--sidebar-background": tokens.sidebarBackground,
    "--sidebar-foreground": tokens.sidebarForeground,
    "--sidebar-primary": tokens.sidebarPrimary,
    "--sidebar-primary-foreground": tokens.sidebarPrimaryForeground,
    "--sidebar-accent": tokens.sidebarAccent,
    "--sidebar-accent-foreground": tokens.sidebarAccentForeground,
    "--sidebar-border": tokens.sidebarBorder,
    "--sidebar-ring": tokens.sidebarRing,
    "--gradient-hero": tokens.gradientHero,
    "--gradient-accent": tokens.gradientAccent,
    "--gradient-card": tokens.gradientCard,
    "--shadow-sm": tokens.shadowSm,
    "--shadow-md": tokens.shadowMd,
    "--shadow-lg": tokens.shadowLg,
    "--shadow-accent": tokens.shadowAccent,
  };

  // Ramadan-specific extras
  if (tokens.ramadanGold) vars["--ramadan-gold"] = tokens.ramadanGold;
  if (tokens.ramadanEmerald) vars["--ramadan-emerald"] = tokens.ramadanEmerald;
  if (tokens.ramadanPattern) vars["--ramadan-pattern"] = tokens.ramadanPattern;

  // Batch-set all variables for performance
  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
  }
}

// ─── Provider ────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(LS_MODE_KEY) as ThemeMode | null;
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [seasonalTheme, setSeasonalState] = useState<SeasonalTheme>(() => {
    const saved = localStorage.getItem(LS_SEASONAL_KEY) as SeasonalTheme | null;
    return saved === "ramadan" ? "ramadan" : "default";
  });

  // Apply tokens whenever mode or seasonal changes
  useEffect(() => {
    const tokens = THEME_TOKENS[seasonalTheme][mode];
    applyTokens(tokens, mode, seasonalTheme);
  }, [mode, seasonalTheme]);

  const setMode = useCallback((m: ThemeMode) => {
    localStorage.setItem(LS_MODE_KEY, m);
    setModeState(m);
  }, []);

  const setSeasonalTheme = useCallback((t: SeasonalTheme) => {
    localStorage.setItem(LS_SEASONAL_KEY, t);
    setSeasonalState(t);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "light" ? "dark" : "light");
  }, [mode, setMode]);

  const tokens = THEME_TOKENS[seasonalTheme][mode];

  return (
    <ThemeContext.Provider value={{ mode, seasonalTheme, setMode, setSeasonalTheme, toggleMode, tokens }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
