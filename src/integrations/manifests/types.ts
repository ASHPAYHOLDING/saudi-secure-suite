// نوع manifest لكل مزود تكامل

export interface ManifestField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "number";
  placeholder?: string;
  hint?: string;
  required?: boolean;
}

export interface DocSection {
  title: string;
  steps: { title: string; desc: string; tip?: string }[];
  faq: { q: string; a: string }[];
  officialLink?: string;
  officialLinkLabel?: string;
}

export interface TroubleshootingItem {
  problem: string;
  cause: string;
  solution: string;
}

export interface SupportIssueType {
  value: string;
  label: string;
}

export type BadgeType = "local" | "global" | "bnpl" | "wallet" | "pos" | "ecommerce" | "marketing";

export interface IntegrationManifest {
  providerId: string;
  name: string;
  nameEn: string;
  category: string; // payment | pos | ecommerce | bnpl | hr | accounting | ocr | other
  logoPath?: string;
  color?: string;
  /** وصف مختصر للتكامل — جملتان كحد أقصى */
  description?: string;
  /** الفوائد الرئيسية للربط */
  benefits?: string[];
  /** المتطلبات اللازمة قبل التفعيل */
  requirements?: string[];
  /** شارات التصنيف (محلي/عالمي/BNPL/Wallet/POS/Ecommerce) */
  badges?: BadgeType[];
  /** طرق الدفع المدعومة */
  supportedMethods?: string[];
  /** روابط مختصرة لحالات الاستخدام */
  useCases?: string[];
  /** أخطاء شائعة مع حلولها */
  commonErrors?: { code: string; fix: string }[];
  /** رابط التوثيق الرسمي للمزود */
  docsUrl?: string;
  /** Header للتحقق من توقيع Webhook */
  webhookSignatureHeader?: string;
  /** تسمية حقل سر Webhook */
  webhookSecretLabel?: string;
  /** تلميح حقل سر Webhook */
  webhookSecretHint?: string;
  /** integrationKey — مفتاح قاعدة البيانات (مثل pay_tap) */
  integrationKey?: string;

  fields: ManifestField[];
  webhookPath?: string;
  docsSections: DocSection[];
  troubleshootingItems?: TroubleshootingItem[];
  supportIssueTypes: SupportIssueType[];
  supportsConnectionTest?: boolean;

  /** معلومات الدعم */
  support?: {
    email?: string;
    url?: string;
  };

  /** معلومات العلامة التجارية */
  branding?: {
    logoPath?: string;
    colorHint?: string;
  };
}
