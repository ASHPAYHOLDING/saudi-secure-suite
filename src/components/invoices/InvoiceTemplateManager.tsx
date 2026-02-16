import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Plus, Trash2, Star, Check, Eye, GripVertical,
  EyeOff, Loader2, Save, Palette, Type, Columns3, Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  InvoiceTemplate, ColumnConfig, PRESET_TEMPLATES, AVAILABLE_FONTS, defaultColumns
} from "@/lib/invoice-template-types";

interface Props {
  onBack: () => void;
}

const InvoiceTemplateManager = ({ onBack }: Props) => {
  const { tenantId, user } = useAuth();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<InvoiceTemplate> | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("invoice_templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at");
    if (data) setTemplates(data as unknown as InvoiceTemplate[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  useEffect(() => {
    if (selectedId && templates.length) {
      const t = templates.find(t => t.id === selectedId);
      if (t) setEditData({ ...t, columns_config: [...(t.columns_config as ColumnConfig[])] });
    }
  }, [selectedId, templates]);

  const createFromPreset = async (presetIndex: number) => {
    if (!tenantId || !user) return;
    const preset = PRESET_TEMPLATES[presetIndex];
    setSaving(true);
    const { data, error } = await supabase
      .from("invoice_templates")
      .insert({
        tenant_id: tenantId,
        created_by: user.id,
        name: preset.name,
        layout_style: preset.layout_style,
        primary_color: preset.primary_color,
        secondary_color: preset.secondary_color,
        header_text_color: preset.header_text_color,
        font_family: preset.font_family,
        columns_config: preset.columns_config as unknown as any,
        show_logo: preset.show_logo,
        show_stamp: preset.show_stamp,
        show_qr_code: preset.show_qr_code,
        show_notes: preset.show_notes,
        footer_text: preset.footer_text,
        is_default: templates.length === 0,
      })
      .select()
      .single();

    if (error) {
      toast.error("خطأ في إنشاء القالب");
    } else if (data) {
      toast.success("تم إنشاء القالب بنجاح");
      await fetchTemplates();
      setSelectedId(data.id);
    }
    setSaving(false);
  };

  const saveTemplate = async () => {
    if (!editData || !selectedId) return;
    setSaving(true);
    const { error } = await supabase
      .from("invoice_templates")
      .update({
        name: editData.name,
        layout_style: editData.layout_style,
        primary_color: editData.primary_color,
        secondary_color: editData.secondary_color,
        header_text_color: editData.header_text_color,
        font_family: editData.font_family,
        columns_config: editData.columns_config as unknown as any,
        show_logo: editData.show_logo,
        show_stamp: editData.show_stamp,
        show_qr_code: editData.show_qr_code,
        show_notes: editData.show_notes,
        footer_text: editData.footer_text,
      })
      .eq("id", selectedId);

    if (error) toast.error("خطأ في الحفظ");
    else {
      toast.success("تم حفظ القالب");
      await fetchTemplates();
    }
    setSaving(false);
  };

  const setAsDefault = async (id: string) => {
    // First unset current default
    await supabase
      .from("invoice_templates")
      .update({ is_default: false })
      .eq("tenant_id", tenantId!)
      .eq("is_default", true);
    // Set new default
    await supabase
      .from("invoice_templates")
      .update({ is_default: true })
      .eq("id", id);
    toast.success("تم تعيين القالب الافتراضي");
    await fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    const t = templates.find(t => t.id === id);
    if (t?.is_default) { toast.error("لا يمكن حذف القالب الافتراضي"); return; }
    await supabase.from("invoice_templates").delete().eq("id", id);
    toast.success("تم حذف القالب");
    if (selectedId === id) { setSelectedId(null); setEditData(null); }
    await fetchTemplates();
  };

  const updateColumn = (key: string, field: keyof ColumnConfig, value: any) => {
    if (!editData) return;
    setEditData({
      ...editData,
      columns_config: (editData.columns_config as ColumnConfig[]).map(c =>
        c.key === key ? { ...c, [field]: value } : c
      ),
    });
  };

  const moveColumn = (key: string, direction: 'up' | 'down') => {
    if (!editData) return;
    const cols = [...(editData.columns_config as ColumnConfig[])].sort((a, b) => a.order - b.order);
    const idx = cols.findIndex(c => c.key === key);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === cols.length - 1)) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const tempOrder = cols[idx].order;
    cols[idx].order = cols[swapIdx].order;
    cols[swapIdx].order = tempOrder;
    setEditData({ ...editData, columns_config: cols });
  };

  if (loading) {
    return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  return (
    <div dir="rtl" className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowRight size={18} /> العودة
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">قوالب الفواتير</h1>
            <p className="text-sm text-muted-foreground mt-0.5">تخصيص تصميم وأعمدة الفواتير</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates List */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <h3 className="text-sm font-bold text-foreground mb-3">القوالب المحفوظة</h3>
            <div className="space-y-2">
              {templates.map(t => (
                <motion.button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full rounded-lg border p-3 text-right transition-all ${
                    selectedId === t.id
                      ? 'border-accent bg-accent/5 shadow-sm'
                      : 'border-border hover:border-accent/30 hover:bg-secondary/20'
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full" style={{ background: t.primary_color }} />
                      <span className="text-sm font-medium text-foreground">{t.name}</span>
                      {t.is_default && (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          افتراضي
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!t.is_default && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setAsDefault(t.id); }}
                          className="p-1 text-muted-foreground hover:text-accent"
                          title="تعيين كافتراضي"
                        >
                          <Star size={14} />
                        </button>
                      )}
                      {!t.is_default && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{t.font_family} • {t.layout_style}</p>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Preset Templates */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <h3 className="text-sm font-bold text-foreground mb-3">إنشاء من قالب جاهز</h3>
            <div className="grid grid-cols-1 gap-2">
              {PRESET_TEMPLATES.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => createFromPreset(i)}
                  disabled={saving}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 text-right hover:border-accent/30 hover:bg-secondary/20 transition-all"
                >
                  <div className="flex gap-1">
                    <div className="h-6 w-6 rounded-md" style={{ background: preset.primary_color }} />
                    <div className="h-6 w-3 rounded-md" style={{ background: preset.secondary_color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{preset.name}</p>
                    <p className="text-[10px] text-muted-foreground">{preset.font_family}</p>
                  </div>
                  <Plus size={16} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {editData ? (
            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div className="flex items-center gap-2">
                  <Settings2 size={18} className="text-accent" />
                  <h3 className="text-sm font-bold text-foreground">تعديل: {editData.name}</h3>
                </div>
                <Button onClick={saveTemplate} disabled={saving} size="sm" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  حفظ التغييرات
                </Button>
              </div>

              <Tabs defaultValue="style" dir="rtl" className="p-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="style" className="gap-1.5 text-xs"><Palette size={14} />الألوان</TabsTrigger>
                  <TabsTrigger value="font" className="gap-1.5 text-xs"><Type size={14} />الخط</TabsTrigger>
                  <TabsTrigger value="columns" className="gap-1.5 text-xs"><Columns3 size={14} />الأعمدة</TabsTrigger>
                </TabsList>

                {/* Colors Tab */}
                <TabsContent value="style" className="space-y-4 mt-4">
                  <div>
                    <Label className="text-xs">اسم القالب</Label>
                    <Input
                      value={editData.name || ''}
                      onChange={e => setEditData({ ...editData, name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">اللون الرئيسي</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={editData.primary_color || '#1a1f36'}
                          onChange={e => setEditData({ ...editData, primary_color: e.target.value })}
                          className="h-10 w-12 rounded-md border border-input cursor-pointer"
                        />
                        <Input
                          value={editData.primary_color || ''}
                          onChange={e => setEditData({ ...editData, primary_color: e.target.value })}
                          className="font-english text-xs"
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">اللون الثانوي</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={editData.secondary_color || '#1a9b8a'}
                          onChange={e => setEditData({ ...editData, secondary_color: e.target.value })}
                          className="h-10 w-12 rounded-md border border-input cursor-pointer"
                        />
                        <Input
                          value={editData.secondary_color || ''}
                          onChange={e => setEditData({ ...editData, secondary_color: e.target.value })}
                          className="font-english text-xs"
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">لون نص الرأس</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={editData.header_text_color || '#ffffff'}
                          onChange={e => setEditData({ ...editData, header_text_color: e.target.value })}
                          className="h-10 w-12 rounded-md border border-input cursor-pointer"
                        />
                        <Input
                          value={editData.header_text_color || ''}
                          onChange={e => setEditData({ ...editData, header_text_color: e.target.value })}
                          className="font-english text-xs"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">عرض الشعار</Label>
                      <Switch checked={editData.show_logo} onCheckedChange={v => setEditData({ ...editData, show_logo: v })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">عرض الختم</Label>
                      <Switch checked={editData.show_stamp} onCheckedChange={v => setEditData({ ...editData, show_stamp: v })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">عرض رمز QR</Label>
                      <Switch checked={editData.show_qr_code} onCheckedChange={v => setEditData({ ...editData, show_qr_code: v })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">عرض الملاحظات</Label>
                      <Switch checked={editData.show_notes} onCheckedChange={v => setEditData({ ...editData, show_notes: v })} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">نص تذييل مخصص</Label>
                    <Textarea
                      value={editData.footer_text || ''}
                      onChange={e => setEditData({ ...editData, footer_text: e.target.value || null })}
                      placeholder="اتركه فارغاً للتذييل الافتراضي..."
                      className="mt-1 text-xs"
                      rows={2}
                    />
                  </div>
                </TabsContent>

                {/* Font Tab */}
                <TabsContent value="font" className="space-y-4 mt-4">
                  <div>
                    <Label className="text-xs">نوع الخط</Label>
                    <Select value={editData.font_family || 'IBM Plex Sans Arabic'} onValueChange={v => setEditData({ ...editData, font_family: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_FONTS.map(f => (
                          <SelectItem key={f} value={f}>
                            <span style={{ fontFamily: f }}>{f}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Font Preview */}
                  <div className="rounded-lg border border-border p-4" style={{ fontFamily: editData.font_family || 'IBM Plex Sans Arabic' }}>
                    <p className="text-lg font-bold mb-1">معاينة الخط العربي</p>
                    <p className="text-sm text-muted-foreground">هذا نص تجريبي لعرض شكل الخط المختار في الفاتورة</p>
                    <p className="text-xs text-muted-foreground mt-2 font-english" dir="ltr">Font Preview: {editData.font_family}</p>
                  </div>
                </TabsContent>

                {/* Columns Tab */}
                <TabsContent value="columns" className="space-y-3 mt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    قم بتعديل أسماء الأعمدة، إظهارها/إخفائها، وترتيبها. الأعمدة الإلزامية للامتثال مع ZATCA لا يمكن إخفاؤها.
                  </p>
                  {[...(editData.columns_config as ColumnConfig[])].sort((a, b) => a.order - b.order).map((col) => {
                    // ZATCA required columns
                    const isRequired = ['description', 'quantity', 'unit_price', 'vat_rate', 'line_total'].includes(col.key);
                    return (
                      <div key={col.key} className="flex items-center gap-3 rounded-lg border border-border p-3 bg-secondary/10">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveColumn(col.key, 'up')}
                            className="text-muted-foreground hover:text-foreground p-0.5"
                          >
                            <GripVertical size={10} className="rotate-180" />
                          </button>
                          <button
                            onClick={() => moveColumn(col.key, 'down')}
                            className="text-muted-foreground hover:text-foreground p-0.5"
                          >
                            <GripVertical size={10} />
                          </button>
                        </div>
                        <Input
                          value={col.label}
                          onChange={e => updateColumn(col.key, 'label', e.target.value)}
                          className="flex-1 text-xs h-9"
                        />
                        <span className="text-[10px] text-muted-foreground font-english w-20 text-center">{col.key}</span>
                        {isRequired ? (
                          <div className="flex items-center gap-1 text-[10px] text-accent w-16 justify-center">
                            <Check size={12} /> مطلوب
                          </div>
                        ) : (
                          <button
                            onClick={() => updateColumn(col.key, 'visible', !col.visible)}
                            className={`p-1.5 rounded-md transition-colors w-16 flex items-center justify-center gap-1 text-[10px] ${
                              col.visible ? 'text-foreground bg-secondary' : 'text-muted-foreground bg-muted'
                            }`}
                          >
                            {col.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                            {col.visible ? 'ظاهر' : 'مخفي'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-secondary/10 p-16">
              <div className="text-center">
                <Palette size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">اختر قالباً للتعديل أو أنشئ واحداً جديداً من القوالب الجاهزة</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceTemplateManager;
