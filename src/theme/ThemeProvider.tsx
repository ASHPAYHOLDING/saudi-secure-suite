import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ThemeMode, SeasonalTheme, THEME_TOKENS, ThemeTokens, isCurrentlyRamadan } from "./tokens";

// ─── Types ──────────────────────────────────────────────────
interface ThemeContextValue {
  mode: ThemeMode;
  seasonalTheme: SeasonalTheme;
  ramadanAutoOn: boolean;
  setMode: (mode: ThemeMode) => void;
  setSeasonalTheme: (theme: SeasonalTheme) => void;
  setRamadanAutoOn: (v: boolean) => void;
  toggleMode: () => void;
  tokens: ThemeTokens;
}

// ─── Context ─────────────────────────────────────────────────
const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Keys ────────────────────────────────────────────────────
const LS_MODE_KEY           = "numaxio-theme-mode";
const LS_SEASONAL_KEY       = "numaxio-theme-seasonal";
const LS_RAMADAN_AUTO_KEY   = "numaxio-ramadan-auto";
const LS_RAMADAN_MANUAL_KEY = "numaxio-ramadan-manual-override"; // "on" | "off" | absent

// ─── Helpers ─────────────────────────────────────────────────
function applyTokens(tokens: ThemeTokens, mode: ThemeMode, seasonal: SeasonalTheme) {
  const root = document.documentElement;
  root.setAttribute("data-mode", mode);
  root.setAttribute("data-theme", seasonal);

  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

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

  if (tokens.ramadanGold)    vars["--ramadan-gold"]    = tokens.ramadanGold;
  if (tokens.ramadanEmerald) vars["--ramadan-emerald"] = tokens.ramadanEmerald;
  if (tokens.ramadanPattern) vars["--ramadan-pattern"] = tokens.ramadanPattern;

  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
  }
}

/**
 * Priority:
 * 1. manual override (user explicitly toggled) → always respected
 * 2. autoOn=true + within Ramadan dates → "ramadan"
 * 3. otherwise → "default"
 */
function resolveSeasonalTheme(autoOn: boolean): SeasonalTheme {
  const manual = localStorage.getItem(LS_RAMADAN_MANUAL_KEY);
  if (manual === "on")  return "ramadan";
  if (manual === "off") return "default";
  if (autoOn && isCurrentlyRamadan()) return "ramadan";
  return "default";
}

// ─── Provider ────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(LS_MODE_KEY) as ThemeMode | null;
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [ramadanAutoOn, setRamadanAutoState] = useState<boolean>(() => {
    const saved = localStorage.getItem(LS_RAMADAN_AUTO_KEY);
    return saved === null ? true : saved === "1"; // default: ON
  });

  const [seasonalTheme, setSeasonalState] = useState<SeasonalTheme>(() => {
    const autoOn = (() => {
      const saved = localStorage.getItem(LS_RAMADAN_AUTO_KEY);
      return saved === null ? true : saved === "1";
    })();
    return resolveSeasonalTheme(autoOn);
  });

  useEffect(() => {
    const tokens = THEME_TOKENS[seasonalTheme][mode];
    applyTokens(tokens, mode, seasonalTheme);
  }, [mode, seasonalTheme]);

  const setMode = useCallback((m: ThemeMode) => {
    localStorage.setItem(LS_MODE_KEY, m);
    setModeState(m);
  }, []);

  /** Manual toggle — clears auto-resolve, respects user choice */
  const setSeasonalTheme = useCallback((t: SeasonalTheme) => {
    localStorage.setItem(LS_RAMADAN_MANUAL_KEY, t === "ramadan" ? "on" : "off");
    localStorage.setItem(LS_SEASONAL_KEY, t);
    setSeasonalState(t);
  }, []);

  /** Toggle auto-detect; when enabled, clears manual override and re-computes */
  const setRamadanAutoOn = useCallback((v: boolean) => {
    localStorage.setItem(LS_RAMADAN_AUTO_KEY, v ? "1" : "0");
    setRamadanAutoState(v);
    if (v) {
      localStorage.removeItem(LS_RAMADAN_MANUAL_KEY);
      const resolved = isCurrentlyRamadan() ? "ramadan" : "default";
      localStorage.setItem(LS_SEASONAL_KEY, resolved);
      setSeasonalState(resolved);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "light" ? "dark" : "light");
  }, [mode, setMode]);

  const tokens = THEME_TOKENS[seasonalTheme][mode];

  return (
    <ThemeContext.Provider value={{
      mode, seasonalTheme, ramadanAutoOn,
      setMode, setSeasonalTheme, setRamadanAutoOn,
      toggleMode, tokens,
    }}>
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
