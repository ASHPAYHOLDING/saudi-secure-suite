import { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Eye, Code, Save, Plus, Trash2, FileText, Copy, Variable,
  ArrowRight, Printer, ChevronLeft, LayoutTemplate,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useDocumentTemplates, useSaveTemplate, useDeleteTemplate, type DocumentTemplate } from "@/hooks/useDocumentTemplates";
import {
  getVariablesForType, groupVariables, DOCUMENT_TYPE_LABELS, CATEGORY_LABELS,
  type DocumentTemplateType, type TemplateVariable,
} from "@/lib/document-template-variables";
import { printDocument, INVOICE_PRINT_STYLES } from "@/lib/pdf-utils";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_INVOICE_HTML = `<div style="padding: 24px; font-family: 'IBM Plex Sans Arabic', sans-serif; direction: rtl;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
    <div>
      <h1 style="font-size: 28px; font-weight: 700; color: #1a1f36;">فاتورة ضريبية</h1>
      <p style="color: #6b7280; margin-top: 4px;">Tax Invoice</p>
    </div>
    <div style="text-align: left;">
      {{company_logo}}
    </div>
  </div>
  <div style="display: flex; justify-content: space-between; margin-bottom: 20px; gap: 24px;">
    <div style="flex: 1; background: #f9fafb; padding: 16px; border-radius: 8px;">
      <h3 style="font-weight: 600; margin-bottom: 8px; color: #1a1f36;">بيانات المنشأة</h3>
      <p>{{company_name}}</p>
      <p>الرقم الضريبي: {{company_vat}}</p>
      <p>{{company_address}}</p>
    </div>
    <div style="flex: 1; background: #f9fafb; padding: 16px; border-radius: 8px;">
      <h3 style="font-weight: 600; margin-bottom: 8px; color: #1a1f36;">بيانات العميل</h3>
      <p>{{customer_name}}</p>
      <p>الرقم الضريبي: {{customer_vat}}</p>
      <p>{{customer_address}}</p>
    </div>
  </div>
  <div style="display: flex; gap: 16px; margin-bottom: 20px;">
    <div><strong>رقم الفاتورة:</strong> {{invoice_number}}</div>
    <div><strong>التاريخ:</strong> {{invoice_date}}</div>
    <div><strong>تاريخ الاستحقاق:</strong> {{due_date}}</div>
  </div>
  {{items_table}}
  <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
    <div style="width: 280px;">
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
        <span>المجموع الفرعي</span><span>{{subtotal}} {{currency}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
        <span>ضريبة القيمة المضافة (15%)</span><span>{{vat_amount}} {{currency}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 12px 0; font-weight: 700; font-size: 18px; color: #1a1f36;">
        <span>الإجمالي</span><span>{{total}} {{currency}}</span>
      </div>
    </div>
  </div>
  <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div>{{qr_code}}</div>
    <div>{{digital_stamp}}</div>
  </div>
  <div style="margin-top: 16px; text-align: center; color: #9ca3af; font-size: 11px;">
    {{notes}}
  </div>
</div>`;

const DEFAULT_CSS = `/* Custom styles */
table { width: 100%; border-collapse: collapse; }
th { background: #1a1f36; color: white; padding: 10px 14px; text-align: right; font-size: 12px; }
td { padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
`;

const DocumentTemplateEditor = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  const [selectedType, setSelectedType] = useState<DocumentTemplateType>("invoice");
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [editorMode, setEditorMode] = useState<"visual" | "code" | "preview">("code");
  const [htmlContent, setHtmlContent] = useState(DEFAULT_INVOICE_HTML);
  const [cssContent, setCssContent] = useState(DEFAULT_CSS);
  const [templateName, setTemplateName] = useState("");
  const [templateNameEn, setTemplateNameEn] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const { data: templates = [], isLoading } = useDocumentTemplates(selectedType);
  const saveTemplate = useSaveTemplate();
  const deleteTemplate = useDeleteTemplate();

  const htmlRef = useRef<HTMLTextAreaElement>(null);

  const variables = useMemo(() => getVariablesForType(selectedType), [selectedType]);
  const grouped = useMemo(() => groupVariables(variables), [variables]);

  const handleLoadTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setHtmlContent(template.html_template);
    setCssContent(template.css);
    setTemplateName(template.name);
    setTemplateNameEn(template.name_en || "");
    setIsDefault(template.is_default);
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    setHtmlContent(DEFAULT_INVOICE_HTML);
    setCssContent(DEFAULT_CSS);
    setTemplateName("");
    setTemplateNameEn("");
    setIsDefault(false);
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error(isRTL ? "يرجى إدخال اسم القالب" : "Please enter template name");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) return;

    saveTemplate.mutate({
      id: selectedTemplate?.id,
      tenant_id: profile.tenant_id,
      document_type: selectedType,
      name: templateName,
      name_en: templateNameEn || null,
      html_template: htmlContent,
      css: cssContent,
      variables: variables.map(v => v.key),
      is_default: isDefault,
      created_by: user.id,
    });
  };

  const insertVariable = useCallback((key: string) => {
    if (htmlRef.current) {
      const ta = htmlRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = htmlContent.substring(0, start) + key + htmlContent.substring(end);
      setHtmlContent(newVal);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + key.length;
        ta.focus();
      }, 0);
    } else {
      setHtmlContent(prev => prev + key);
    }
    toast.success(isRTL ? `تم إدراج ${key}` : `Inserted ${key}`);
  }, [htmlContent, isRTL]);

  const getPreviewHtml = useCallback(() => {
    let html = htmlContent;
    variables.forEach(v => {
      html = html.split(v.key).join(v.sampleValue);
    });
    return `<style>${cssContent}</style>${html}`;
  }, [htmlContent, cssContent, variables]);

  const handlePrint = () => {
    const container = document.createElement("div");
    container.innerHTML = getPreviewHtml();
    printDocument(container, {
      title: templateName || "Document Preview",
      extraStyles: INVOICE_PRINT_STYLES + "\n" + cssContent,
    });
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <LayoutTemplate className="h-6 w-6 text-primary" />
            {isRTL ? "محرك المستندات" : "Document Engine"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? "تصميم وإدارة قوالب المستندات" : "Design and manage document templates"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            {isRTL ? "طباعة" : "Print"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveTemplate.isPending}>
            <Save className="h-4 w-4" />
            {isRTL ? "حفظ القالب" : "Save Template"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: Template List + Variables */}
        <div className="space-y-4">
          {/* Document Type Selector */}
          <Card className="border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">{isRTL ? "نوع المستند" : "Document Type"}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Select value={selectedType} onValueChange={(v) => { setSelectedType(v as DocumentTemplateType); handleNewTemplate(); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {isRTL ? val.ar : val.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Templates List */}
          <Card className="border-border">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">{isRTL ? "القوالب" : "Templates"}</CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewTemplate}>
                <Plus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {isLoading ? (
                <p className="text-xs text-muted-foreground">{isRTL ? "جاري التحميل..." : "Loading..."}</p>
              ) : templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">{isRTL ? "لا توجد قوالب" : "No templates yet"}</p>
              ) : templates.map((t) => (
                <div
                  key={t.id}
                  className={`rounded-md border p-2 cursor-pointer transition-colors text-sm ${selectedTemplate?.id === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                  onClick={() => handleLoadTemplate(t)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{t.name}</span>
                    {t.is_default && <Badge variant="secondary" className="text-[10px]">{isRTL ? "افتراضي" : "Default"}</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t.name_en}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Variables Panel */}
          <Card className="border-border max-h-[400px] overflow-y-auto">
            <CardHeader className="py-3 px-4 sticky top-0 bg-card z-10">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Variable className="h-4 w-4" />
                {isRTL ? "المتغيرات" : "Variables"}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {Object.entries(grouped).map(([cat, vars]) => (
                <div key={cat}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                    {isRTL ? CATEGORY_LABELS[cat]?.ar : CATEGORY_LABELS[cat]?.en || cat}
                  </p>
                  <div className="space-y-0.5">
                    {vars.map((v) => (
                      <button
                        key={v.key}
                        onClick={() => insertVariable(v.key)}
                        className="w-full text-start px-2 py-1 rounded text-xs hover:bg-muted/70 transition-colors flex items-center justify-between group"
                      >
                        <span className="truncate">{isRTL ? v.labelAr : v.labelEn}</span>
                        <span className="text-[10px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                          {v.key}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Editor Area */}
        <div className="lg:col-span-3 space-y-4">
          {/* Template Meta */}
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">{isRTL ? "اسم القالب (عربي)" : "Template Name (AR)"}</Label>
                  <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder={isRTL ? "فاتورة رسمية" : "Official Invoice"} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">{isRTL ? "اسم القالب (إنجليزي)" : "Template Name (EN)"}</Label>
                  <Input value={templateNameEn} onChange={(e) => setTemplateNameEn(e.target.value)} placeholder="Official Invoice" className="mt-1" />
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={isDefault} onCheckedChange={setIsDefault} id="is-default" />
                    <Label htmlFor="is-default" className="text-xs">{isRTL ? "قالب افتراضي" : "Default Template"}</Label>
                  </div>
                  {selectedTemplate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => { deleteTemplate.mutate(selectedTemplate.id); handleNewTemplate(); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Editor Tabs */}
          <Card className="border-border">
            <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as any)}>
              <CardHeader className="py-2 px-4">
                <div className="flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="code" className="text-xs gap-1.5">
                      <Code className="h-3.5 w-3.5" />
                      HTML
                    </TabsTrigger>
                    <TabsTrigger value="visual" className="text-xs gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      CSS
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="text-xs gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      {isRTL ? "معاينة" : "Preview"}
                    </TabsTrigger>
                  </TabsList>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <TabsContent value="code" className="m-0">
                  <Textarea
                    ref={htmlRef}
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    className="min-h-[500px] font-mono text-xs rounded-none border-0 resize-none focus-visible:ring-0"
                    dir="ltr"
                    style={{ tabSize: 2 }}
                    placeholder="<div>HTML template here...</div>"
                  />
                </TabsContent>

                <TabsContent value="visual" className="m-0">
                  <Textarea
                    value={cssContent}
                    onChange={(e) => setCssContent(e.target.value)}
                    className="min-h-[500px] font-mono text-xs rounded-none border-0 resize-none focus-visible:ring-0"
                    dir="ltr"
                    style={{ tabSize: 2 }}
                    placeholder="/* CSS styles */"
                  />
                </TabsContent>

                <TabsContent value="preview" className="m-0">
                  <div className="bg-white min-h-[500px] p-0">
                    <div
                      className="mx-auto bg-white shadow-sm"
                      style={{ maxWidth: "210mm", minHeight: "297mm" }}
                      dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                    />
                  </div>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DocumentTemplateEditor;
