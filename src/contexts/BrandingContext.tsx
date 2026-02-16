import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export const ARABIC_SAFE_FONTS = [
  { value: "IBM Plex Sans Arabic", label: "IBM Plex Sans Arabic", import: "IBM+Plex+Sans+Arabic" },
  { value: "Noto Sans Arabic", label: "Noto Sans Arabic", import: "Noto+Sans+Arabic" },
  { value: "Tajawal", label: "تجوال (Tajawal)", import: "Tajawal" },
  { value: "Cairo", label: "القاهرة (Cairo)", import: "Cairo" },
  { value: "Almarai", label: "المراعي (Almarai)", import: "Almarai" },
  { value: "Changa", label: "Changa", import: "Changa" },
  { value: "El Messiri", label: "المسيري (El Messiri)", import: "El+Messiri" },
  { value: "Readex Pro", label: "Readex Pro", import: "Readex+Pro" },
] as const;

export interface TenantBranding {
  logoUrl: string | null;
  primaryColor: string;  // hex
  secondaryColor: string; // hex
  font: string;
  companyName: string;
}

const DEFAULT_BRANDING: TenantBranding = {
  logoUrl: null,
  primaryColor: "#0f4c81",
  secondaryColor: "#1a9b8a",
  font: "IBM Plex Sans Arabic",
  companyName: "شركة التقنية المتقدمة",
};

interface BrandingContextValue {
  branding: TenantBranding;
  updateBranding: (partial: Partial<TenantBranding>) => void;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  updateBranding: () => {},
});

export const useBranding = () => useContext(BrandingContext);

/** Convert hex to HSL string (e.g. "220 30% 14%") */
const hexToHsl = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

export const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const [branding, setBranding] = useState<TenantBranding>(() => {
    const saved = localStorage.getItem("tenant_branding");
    return saved ? { ...DEFAULT_BRANDING, ...JSON.parse(saved) } : DEFAULT_BRANDING;
  });

  const updateBranding = (partial: Partial<TenantBranding>) => {
    setBranding((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem("tenant_branding", JSON.stringify(next));
      return next;
    });
  };

  // Load Google Font dynamically
  useEffect(() => {
    const fontInfo = ARABIC_SAFE_FONTS.find((f) => f.value === branding.font);
    if (fontInfo) {
      const id = `brand-font-${fontInfo.import}`;
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${fontInfo.import}:wght@300;400;500;600;700&display=swap`;
        document.head.appendChild(link);
      }
    }
  }, [branding.font]);

  // Apply CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", hexToHsl(branding.primaryColor));
    root.style.setProperty("--brand-secondary", hexToHsl(branding.secondaryColor));
    root.style.setProperty("--brand-primary-hex", branding.primaryColor);
    root.style.setProperty("--brand-secondary-hex", branding.secondaryColor);
    root.style.setProperty("--brand-font", `'${branding.font}', sans-serif`);
  }, [branding.primaryColor, branding.secondaryColor, branding.font]);

  return (
    <BrandingContext.Provider value={{ branding, updateBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};
