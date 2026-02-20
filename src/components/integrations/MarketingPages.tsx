/**
 * صفحات تكاملات التسويق — محتوى خاص ومستقل لكل مزود
 * ممنوع إعادة استخدام محتوى أي مزود آخر
 */
import MarketingIntegrationPage from "./MarketingIntegrationPage";
import { metaPixelCapiContent } from "./content/meta-pixel-capi";
import { xPixelContent } from "./content/x-pixel";
import { xCatalogContent } from "./content/x-catalog";
import { gtmContent } from "./content/gtm";
import { googleAdsContent } from "./content/google-ads";
import { metaCatalogContent } from "./content/meta-catalog";
import { facebookCapiContent } from "./content/facebook-capi";

export const MetaPixelCapiPage = () => <MarketingIntegrationPage content={metaPixelCapiContent} />;
export const FacebookCapiPage = () => <MarketingIntegrationPage content={facebookCapiContent} />;
export const XPixelPage = () => <MarketingIntegrationPage content={xPixelContent} />;
export const XCatalogPage = () => <MarketingIntegrationPage content={xCatalogContent} />;
export const GTMPage = () => <MarketingIntegrationPage content={gtmContent} />;
export const GoogleAdsPage = () => <MarketingIntegrationPage content={googleAdsContent} />;
export const MetaCatalogPage = () => <MarketingIntegrationPage content={metaCatalogContent} />;
