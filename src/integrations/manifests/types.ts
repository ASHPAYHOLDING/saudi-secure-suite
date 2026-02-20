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
  fields: ManifestField[];
  webhookPath?: string;
  docsSections: DocSection[];
  troubleshootingItems?: TroubleshootingItem[];
  supportIssueTypes: SupportIssueType[];
  supportsConnectionTest?: boolean;
}
