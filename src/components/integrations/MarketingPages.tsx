/**
 * صفحات تكاملات التسويق — Meta Pixel+CAPI, X Pixel, GTM, Google Ads, Meta Catalog
 * كل صفحة تستخدم MarketingIntegrationPage مع محتوى خاص بها
 */
import MarketingIntegrationPage from "./MarketingIntegrationPage";
import { metaPixelCapiContent } from "./content/meta-pixel-capi";
import { xPixelContent } from "./content/x-pixel";
import { gtmContent } from "./content/gtm";
import { googleAdsContent } from "./content/google-ads";
import { metaCatalogContent } from "./content/meta-catalog";

export const MetaPixelCapiPage = () => <MarketingIntegrationPage content={metaPixelCapiContent} />;
export const XPixelPage = () => <MarketingIntegrationPage content={xPixelContent} />;
export const GTMPage = () => <MarketingIntegrationPage content={gtmContent} />;
export const GoogleAdsPage = () => <MarketingIntegrationPage content={googleAdsContent} />;
export const MetaCatalogPage = () => <MarketingIntegrationPage content={metaCatalogContent} />;
