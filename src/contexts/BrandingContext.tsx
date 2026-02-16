import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  primaryColor: string;
  secondaryColor: string;
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
  saving: boolean;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  updateBranding: () => {},
  saving: false,
});

export const useBranding = () => useContext(BrandingContext);

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
  const { tenantId } = useAuth();
  const [branding, setBranding] = useState<TenantBranding>(DEFAULT_BRANDING);
  const [saving, setSaving] = useState(false);

  // Load branding from database
  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const { data } = await supabase
        .from("tenants")
        .select("name, logo_url, brand_primary_color, brand_secondary_color, brand_font")
        .eq("id", tenantId)
        .single();
      if (data) {
        setBranding({
          companyName: data.name || DEFAULT_BRANDING.companyName,
          logoUrl: data.logo_url,
          primaryColor: data.brand_primary_color || DEFAULT_BRANDING.primaryColor,
          secondaryColor: data.brand_secondary_color || DEFAULT_BRANDING.secondaryColor,
          font: data.brand_font || DEFAULT_BRANDING.font,
        });
      }
    };
    load();
  }, [tenantId]);

  const updateBranding = useCallback(
    async (partial: Partial<TenantBranding>) => {
      setBranding((prev) => ({ ...prev, ...partial }));

      if (!tenantId) return;
      setSaving(true);
      const updates: Record<string, any> = {};
      if (partial.primaryColor !== undefined) updates.brand_primary_color = partial.primaryColor;
      if (partial.secondaryColor !== undefined) updates.brand_secondary_color = partial.secondaryColor;
      if (partial.font !== undefined) updates.brand_font = partial.font;
      if (partial.logoUrl !== undefined) updates.logo_url = partial.logoUrl;
      if (partial.companyName !== undefined) updates.name = partial.companyName;

      if (Object.keys(updates).length > 0) {
        await supabase.from("tenants").update(updates).eq("id", tenantId);
      }
      setSaving(false);
    },
    [tenantId]
  );

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
    <BrandingContext.Provider value={{ branding, updateBranding, saving }}>
      {children}
    </BrandingContext.Provider>
  );
};
