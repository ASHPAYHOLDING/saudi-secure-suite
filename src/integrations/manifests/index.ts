// index.ts — تجميع كل manifests وتصديرها كـ registry
import { tapManifest } from "./tap";
import { stripeManifest } from "./stripe";
import { geideaManifest } from "./geidea";
import { moyasarManifest } from "./moyasar";
import { hyperpayManifest } from "./hyperpay";
import { foodicsManifest } from "./foodics";
import { shopifyManifest } from "./shopify";
import type { IntegrationManifest } from "./types";

export * from "./types";

// سجل كل المزودين — يمكن الوصول بـ providerId
export const MANIFESTS: Record<string, IntegrationManifest> = {
  tap: tapManifest,
  stripe: stripeManifest,
  geidea: geideaManifest,
  moyasar: moyasarManifest,
  hyperpay: hyperpayManifest,
  foodics: foodicsManifest,
  shopify: shopifyManifest,
};

/**
 * getManifest — البحث عن manifest مزود معين بدون أي fallback.
 * إذا لم يُوجد المزود تُعاد null وتُعرض صفحة NotFound.
 */
export function getManifest(providerId: string): IntegrationManifest | null {
  return MANIFESTS[providerId.toLowerCase()] ?? null;
}

// ربط مفاتيح النظام الداخلي (key في قاعدة البيانات) بالـ providerId
export const KEY_TO_PROVIDER: Record<string, string> = {
  pay_tap: "tap",
  pay_stripe: "stripe",
  pay_geidea: "geidea",
  pay_moyasar: "moyasar",
  pay_hyperpay: "hyperpay",
  pos_foodics: "foodics",
  ecom_shopify: "shopify",
};

/**
 * getManifestByKey — البحث عن manifest عبر مفتاح قاعدة البيانات (مثل pos_foodics)
 */
export function getManifestByKey(integrationKey: string): IntegrationManifest | null {
  const providerId = KEY_TO_PROVIDER[integrationKey];
  if (!providerId) return null;
  return getManifest(providerId);
}

