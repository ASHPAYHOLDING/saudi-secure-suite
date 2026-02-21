/**
 * Region-Aware Database Client Abstraction
 * 
 * Provides a layer of indirection for future multi-region routing.
 * Currently all regions point to the same Supabase instance,
 * but the abstraction allows region-specific routing when scaling.
 */

import { supabase } from "@/integrations/supabase/client";

export type TenantRegion = "ksa" | "gcc" | "eu";

/** Region metadata for display and routing */
export const REGION_CONFIG: Record<TenantRegion, {
  label: string;
  labelEn: string;
  flag: string;
  endpoint: string; // Future: region-specific endpoint
  color: string;
}> = {
  ksa: {
    label: "المملكة العربية السعودية",
    labelEn: "Saudi Arabia (KSA)",
    flag: "🇸🇦",
    endpoint: "primary", // All currently route to primary
    color: "hsl(142, 76%, 36%)",
  },
  gcc: {
    label: "دول الخليج",
    labelEn: "Gulf (GCC)",
    flag: "🌍",
    endpoint: "primary",
    color: "hsl(217, 91%, 60%)",
  },
  eu: {
    label: "أوروبا",
    labelEn: "Europe (EU)",
    flag: "🇪🇺",
    endpoint: "primary",
    color: "hsl(262, 83%, 58%)",
  },
};

/**
 * Get the Supabase client for a given region.
 * Currently returns the default client for all regions.
 * When multi-region is deployed, this will route to region-specific instances.
 */
export function getRegionClient(_region: TenantRegion = "ksa") {
  // Future: switch on region to return region-specific createClient()
  // For now, all regions use the same instance
  return supabase;
}

/**
 * Get the region label for display
 */
export function getRegionLabel(region: TenantRegion, locale: "ar" | "en" = "ar"): string {
  const config = REGION_CONFIG[region];
  return locale === "ar" ? config.label : config.labelEn;
}

/**
 * Ensure a query is tenant-scoped (helper for consistency checks)
 */
export function assertTenantScoped(tenantId: string | null | undefined): asserts tenantId is string {
  if (!tenantId) {
    throw new Error("Tenant ID is required for all data queries. This is a multi-tenant system.");
  }
}
