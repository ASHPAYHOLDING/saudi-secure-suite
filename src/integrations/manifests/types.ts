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

export interface SupportIssueType {
  value: string;
  label: string;
}

export interface IntegrationManifest {
  providerId: string;
  name: string;
  nameEn: string;
  category: string; // payment | pos | ecommerce | hr | accounting | ocr | other
  logoPath?: string;
  color?: string;
  fields: ManifestField[];
  webhookPath?: string; // مسار الـ webhook الخاص بالمزود
  docsSections: DocSection[];
  supportIssueTypes: SupportIssueType[];
  /** هل يدعم هذا المزود اختبار الاتصال عبر edge function provider-test؟ */
  supportsConnectionTest?: boolean;
}
