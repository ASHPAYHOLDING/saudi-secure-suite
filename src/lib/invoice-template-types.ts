export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  order: number;
}

export interface InvoiceTemplate {
  id: string;
  tenant_id: string;
  name: string;
  layout_style: 'classic' | 'modern' | 'minimal' | 'elegant' | 'bold';
  primary_color: string;
  secondary_color: string;
  header_text_color: string;
  font_family: string;
  columns_config: ColumnConfig[];
  show_logo: boolean;
  show_stamp: boolean;
  show_qr_code: boolean;
  show_notes: boolean;
  footer_text: string | null;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const PRESET_TEMPLATES: Omit<InvoiceTemplate, 'id' | 'tenant_id' | 'created_by' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'كلاسيكي',
    layout_style: 'classic',
    primary_color: '#1a1f36',
    secondary_color: '#1a9b8a',
    header_text_color: '#ffffff',
    font_family: 'IBM Plex Sans Arabic',
    columns_config: defaultColumns(),
    show_logo: true,
    show_stamp: true,
    show_qr_code: true,
    show_notes: true,
    footer_text: null,
    is_default: false,
  },
  {
    name: 'عصري',
    layout_style: 'modern',
    primary_color: '#0f172a',
    secondary_color: '#3b82f6',
    header_text_color: '#ffffff',
    font_family: 'Cairo',
    columns_config: defaultColumns(),
    show_logo: true,
    show_stamp: true,
    show_qr_code: true,
    show_notes: true,
    footer_text: null,
    is_default: false,
  },
  {
    name: 'بسيط',
    layout_style: 'minimal',
    primary_color: '#374151',
    secondary_color: '#6b7280',
    header_text_color: '#ffffff',
    font_family: 'Tajawal',
    columns_config: defaultColumns(),
    show_logo: true,
    show_stamp: true,
    show_qr_code: true,
    show_notes: true,
    footer_text: null,
    is_default: false,
  },
  {
    name: 'أنيق',
    layout_style: 'elegant',
    primary_color: '#1e3a5f',
    secondary_color: '#c5973a',
    header_text_color: '#ffffff',
    font_family: 'Amiri',
    columns_config: defaultColumns(),
    show_logo: true,
    show_stamp: true,
    show_qr_code: true,
    show_notes: true,
    footer_text: null,
    is_default: false,
  },
  {
    name: 'جريء',
    layout_style: 'bold',
    primary_color: '#7c3aed',
    secondary_color: '#ec4899',
    header_text_color: '#ffffff',
    font_family: 'Noto Kufi Arabic',
    columns_config: defaultColumns(),
    show_logo: true,
    show_stamp: true,
    show_qr_code: true,
    show_notes: true,
    footer_text: null,
    is_default: false,
  },
];

export function defaultColumns(): ColumnConfig[] {
  return [
    { key: 'index', label: '#', visible: true, order: 0 },
    { key: 'description', label: 'الوصف', visible: true, order: 1 },
    { key: 'quantity', label: 'الكمية', visible: true, order: 2 },
    { key: 'unit', label: 'الوحدة', visible: true, order: 3 },
    { key: 'unit_price', label: 'سعر الوحدة', visible: true, order: 4 },
    { key: 'discount', label: 'الخصم', visible: true, order: 5 },
    { key: 'vat_rate', label: 'الضريبة', visible: true, order: 6 },
    { key: 'line_total', label: 'الإجمالي', visible: true, order: 7 },
  ];
}

export const AVAILABLE_FONTS = [
  'IBM Plex Sans Arabic',
  'Cairo',
  'Tajawal',
  'Amiri',
  'Noto Kufi Arabic',
  'Almarai',
  'Changa',
  'El Messiri',
];
