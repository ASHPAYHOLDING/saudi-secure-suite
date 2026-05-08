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

export interface BrandingConfig {
  [key: string]: unknown;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  invoice_footer_text: string;
  email_signature: string;
  website_url: string;
  support_phone: string;
}

export interface TenantBranding {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  font: string;
  companyName: string;
  invoiceFooterText: string;
  emailSignature: string;
  websiteUrl: string;
  supportPhone: string;
}

const DEFAULT_BRANDING: TenantBranding = {
  logoUrl: null,
  primaryColor: "#0f4c81",
  secondaryColor: "#1a9b8a",
  font: "IBM Plex Sans Arabic",
  companyName: "شركة التقنية المتقدمة",
  invoiceFooterText: "",
  emailSignature: "",
  websiteUrl: "",
  supportPhone: "",
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

const parseBrandingConfig = (config: BrandingConfig | null): Partial<TenantBranding> => {
  if (!config) return {};
  return {
    primaryColor: config.primary_color || undefined,
    secondaryColor: config.secondary_color || undefined,
    font: config.font_family || undefined,
    invoiceFooterText: config.invoice_footer_text || "",
    emailSignature: config.email_signature || "",
    websiteUrl: config.website_url || "",
    supportPhone: config.support_phone || "",
  };
};

export const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useAuth();
  const [branding, setBranding] = useState<TenantBranding>(DEFAULT_BRANDING);
  const [saving, setSaving] = useState(false);

  // Load branding from tenants + tenant_settings
  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const [tenantRes, settingsRes] = await Promise.all([
        supabase
          .from("tenants")
          .select("name, logo_url, brand_primary_color, brand_secondary_color, brand_font")
          .eq("id", tenantId)
          .single(),
        supabase
          .from("tenant_settings" as any)
          .select("branding_config")
          .eq("tenant_id", tenantId)
          .maybeSingle(),
      ]);

      const tenant = tenantRes.data;
      const config = (settingsRes.data as any)?.branding_config as BrandingConfig | null;
      const configOverrides = parseBrandingConfig(config);

      if (tenant) {
        setBranding({
          companyName: tenant.name || DEFAULT_BRANDING.companyName,
          logoUrl: tenant.logo_url,
          primaryColor: configOverrides.primaryColor || tenant.brand_primary_color || DEFAULT_BRANDING.primaryColor,
          secondaryColor: configOverrides.secondaryColor || tenant.brand_secondary_color || DEFAULT_BRANDING.secondaryColor,
          font: configOverrides.font || tenant.brand_font || DEFAULT_BRANDING.font,
          invoiceFooterText: configOverrides.invoiceFooterText || "",
          emailSignature: configOverrides.emailSignature || "",
          websiteUrl: configOverrides.websiteUrl || "",
          supportPhone: configOverrides.supportPhone || "",
        });
      }
    };
    load();
  }, [tenantId]);

  // Realtime subscription on tenant_settings
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`branding-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenant_settings',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: any) => {
          const config = payload.new?.branding_config as BrandingConfig | null;
          const overrides = parseBrandingConfig(config);
          setBranding((prev) => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(overrides).filter(([_, v]) => v !== undefined)
            ),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const updateBranding = useCallback(
    async (partial: Partial<TenantBranding>) => {
      setBranding((prev) => ({ ...prev, ...partial }));

      if (!tenantId) return;
      setSaving(true);

      // Update tenants table for legacy fields
      const tenantUpdates: Record<string, any> = {};
      if (partial.primaryColor !== undefined) tenantUpdates.brand_primary_color = partial.primaryColor;
      if (partial.secondaryColor !== undefined) tenantUpdates.brand_secondary_color = partial.secondaryColor;
      if (partial.font !== undefined) tenantUpdates.brand_font = partial.font;
      if (partial.logoUrl !== undefined) tenantUpdates.logo_url = partial.logoUrl;
      if (partial.companyName !== undefined) tenantUpdates.name = partial.companyName;

      // Build branding_config JSONB
      const configUpdate: Partial<BrandingConfig> = {};
      if (partial.primaryColor !== undefined) configUpdate.primary_color = partial.primaryColor;
      if (partial.secondaryColor !== undefined) configUpdate.secondary_color = partial.secondaryColor;
      if (partial.font !== undefined) configUpdate.font_family = partial.font;
      if (partial.invoiceFooterText !== undefined) configUpdate.invoice_footer_text = partial.invoiceFooterText;
      if (partial.emailSignature !== undefined) configUpdate.email_signature = partial.emailSignature;
      if (partial.websiteUrl !== undefined) configUpdate.website_url = partial.websiteUrl;
      if (partial.supportPhone !== undefined) configUpdate.support_phone = partial.supportPhone;

      if (Object.keys(tenantUpdates).length > 0) {
        await supabase.from("tenants").update(tenantUpdates as any).eq("id", tenantId);
      }

      if (Object.keys(configUpdate).length > 0) {
        // Upsert tenant_settings
        const { data: existing } = await (supabase
          .from("tenant_settings" as any)
          .select("id, branding_config")
          .eq("tenant_id", tenantId)
          .maybeSingle() as any);

        if (existing) {
          const merged = { ...((existing as any).branding_config || {}), ...configUpdate };
          await (supabase
            .from("tenant_settings" as any)
            .update({ branding_config: merged } as any)
            .eq("tenant_id", tenantId) as any);
        } else {
          await (supabase
            .from("tenant_settings" as any)
            .insert({ tenant_id: tenantId, branding_config: configUpdate } as any) as any);
        }
      }

      setSaving(false);
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
