// index.ts — تجميع كل manifests وتصديرها كـ registry
import { tapManifest } from "./tap";
import { stripeManifest } from "./stripe";
import { geideaManifest } from "./geidea";
import { moyasarManifest } from "./moyasar";
import { hyperpayManifest } from "./hyperpay";
import { foodicsManifest } from "./foodics";
import { shopifyManifest } from "./shopify";
import { paytabsManifest } from "./paytabs";
import { myfatoorahManifest } from "./myfatoorah";
import { telrManifest } from "./telr";
import { paypalManifest } from "./paypal";
import { tabbyManifest } from "./tabby";
import { tamaraManifest } from "./tamara";
import { madfuManifest } from "./madfu";
import { emkanManifest } from "./emkan";
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
  paytabs: paytabsManifest,
  myfatoorah: myfatoorahManifest,
  telr: telrManifest,
  paypal: paypalManifest,
  tabby: tabbyManifest,
  tamara: tamaraManifest,
  madfu: madfuManifest,
  emkan: emkanManifest,
};

/**
 * getManifest — البحث عن manifest مزود معين بدون أي fallback.
 * إذا لم يُوجد المزود تُعاد null وتُعرض صفحة NotFound.
 */
export function getManifest(providerId: string): IntegrationManifest | null {
  if (!providerId) return null;
  return MANIFESTS[providerId.toLowerCase()] ?? null;
}

// ربط مفاتيح النظام الداخلي (key في قاعدة البيانات) بالـ providerId
export const KEY_TO_PROVIDER: Record<string, string> = {
  pay_tap: "tap",
  pay_stripe: "stripe",
  pay_geidea: "geidea",
  pay_moyasar: "moyasar",
  pay_hyperpay: "hyperpay",
  pay_paytabs: "paytabs",
  pay_myfatoorah: "myfatoorah",
  pay_telr: "telr",
  pay_paypal: "paypal",
  pay_tabby: "tabby",
  pay_tamara: "tamara",
  pay_madfu: "madfu",
  pay_emkan: "emkan",
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

// جميع المزودين كقائمة مرتبة للعرض
export function getAllManifests(): IntegrationManifest[] {
  return Object.values(MANIFESTS);
}

// فلترة حسب category
export function getManifestsByCategory(category: string): IntegrationManifest[] {
  return Object.values(MANIFESTS).filter((m) => m.category === category);
}
