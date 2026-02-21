/**
 * AdminIntegrationDocs — Platform admin CRUD editor for integration_docs
 * JSON editor + live preview for each provider's documentation.
 */

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import IntegrationDocs from "@/components/integrations/IntegrationDocs";
import {
  Plus, Save, Trash2, Search, FileText,
  Eye, Code, RefreshCw, ChevronLeft,
} from "lucide-react";

interface DocRow {
  id: string;
  provider_key: string;
  title: string;
  title_en: string | null;
  short_description: string;
  short_description_en: string | null;
  setup_steps: any;
  faq: any;
  troubleshooting: any;
  security_notes: any;
  screenshots: any;
  updated_at: string;
}

const EMPTY_DOC: Omit<DocRow, "id" | "updated_at"> = {
  provider_key: "",
  title: "",
  title_en: "",
  short_description: "",
  short_description_en: "",
  setup_steps: [],
  faq: [],
  troubleshooting: [],
  security_notes: [],
  screenshots: [],
};

const AdminIntegrationDocs = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"editor" | "preview">("editor");
  const [formData, setFormData] = useState<any>(null);
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  // Fetch all docs
  const { data: docs, isLoading } = useQuery({
    queryKey: ["admin-integration-docs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_docs")
        .select("*")
        .order("provider_key");
      if (error) throw error;
      return data as DocRow[];
    },
  });

  const filteredDocs = useMemo(() => {
    if (!docs) return [];
    if (!search.trim()) return docs;
    const q = search.toLowerCase();
    return docs.filter(
      (d) =>
        d.provider_key.includes(q) ||
        d.title.includes(q) ||
        d.title_en?.toLowerCase().includes(q)
    );
  }, [docs, search]);

  const selectedDoc = useMemo(
    () => docs?.find((d) => d.id === selectedId) ?? null,
    [docs, selectedId]
  );

  useEffect(() => {
    if (selectedDoc) {
      setFormData({
        provider_key: selectedDoc.provider_key,
        title: selectedDoc.title,
        title_en: selectedDoc.title_en || "",
        short_description: selectedDoc.short_description,
        short_description_en: selectedDoc.short_description_en || "",
        setup_steps: JSON.stringify(selectedDoc.setup_steps, null, 2),
        faq: JSON.stringify(selectedDoc.faq, null, 2),
        troubleshooting: JSON.stringify(selectedDoc.troubleshooting, null, 2),
        security_notes: JSON.stringify(selectedDoc.security_notes, null, 2),
      });
      setJsonErrors({});
    }
  }, [selectedDoc]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const jsonFields: Record<string, any> = {};
      const jsonKeys = ["setup_steps", "faq", "troubleshooting", "security_notes"];
      const errors: Record<string, string> = {};

      for (const key of jsonKeys) {
        try {
          jsonFields[key] = JSON.parse(data[key]);
        } catch {
          errors[key] = "JSON غير صالح";
        }
      }

      if (Object.keys(errors).length > 0) {
        setJsonErrors(errors);
        throw new Error("Invalid JSON in one or more fields");
      }

      const payload = {
        provider_key: data.provider_key,
        title: data.title,
        title_en: data.title_en || null,
        short_description: data.short_description,
        short_description_en: data.short_description_en || null,
        ...jsonFields,
      };

      if (selectedId) {
        const { error } = await supabase
          .from("integration_docs")
          .update(payload)
          .eq("id", selectedId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("integration_docs")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم الحفظ بنجاح");
      queryClient.invalidateQueries({ queryKey: ["admin-integration-docs"] });
      queryClient.invalidateQueries({ queryKey: ["integration-docs"] });
    },
    onError: (err: Error) => {
      if (!err.message.includes("Invalid JSON")) {
        toast.error("خطأ: " + err.message);
      }
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("integration_docs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      setSelectedId(null);
      setFormData(null);
      queryClient.invalidateQueries({ queryKey: ["admin-integration-docs"] });
    },
    onError: (err: Error) => toast.error("خطأ: " + err.message),
  });

  const handleNew = () => {
    setSelectedId(null);
    setFormData({
      ...EMPTY_DOC,
      setup_steps: "[]",
      faq: "[]",
      troubleshooting: "[]",
      security_notes: "[]",
    });
    setJsonErrors({});
    setEditMode("editor");
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    if (jsonErrors[field]) {
      setJsonErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">إدارة توثيق التكاملات</h1>
          <p className="text-sm text-muted-foreground">
            {docs?.length ?? 0} مزود موثّق
          </p>
        </div>
        <Button onClick={handleNew} className="gap-1.5">
          <Plus size={14} /> إضافة مزود
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── List Panel ── */}
        <div className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="بحث بالمزود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pe-9 h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))
            ) : filteredDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                لا توجد نتائج
              </p>
            ) : (
              filteredDocs.map((doc) => (
                <button
                  key={doc.id}
                  className={`w-full text-start p-3 rounded-lg border transition-colors ${
                    selectedId === doc.id
                      ? "border-accent bg-accent/5"
                      : "border-border/30 hover:bg-muted/30"
                  }`}
                  onClick={() => {
                    setSelectedId(doc.id);
                    setEditMode("editor");
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {doc.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {doc.provider_key}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {doc.short_description}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Editor Panel ── */}
        <div className="lg:col-span-8">
          {!formData ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <FileText size={40} className="text-muted-foreground/30" />
              <p className="text-muted-foreground">اختر مزوداً من القائمة أو أضف مزوداً جديداً</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={editMode === "editor" ? "default" : "outline"}
                    className="gap-1.5 text-xs"
                    onClick={() => setEditMode("editor")}
                  >
                    <Code size={13} /> محرر
                  </Button>
                  <Button
                    size="sm"
                    variant={editMode === "preview" ? "default" : "outline"}
                    className="gap-1.5 text-xs"
                    onClick={() => setEditMode("preview")}
                  >
                    <Eye size={13} /> معاينة
                  </Button>
                </div>
                <div className="flex gap-2">
                  {selectedId && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5 text-xs"
                      onClick={() => {
                        if (confirm("هل أنت متأكد من الحذف؟")) {
                          deleteMutation.mutate(selectedId);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 size={13} /> حذف
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => saveMutation.mutate(formData)}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Save size={13} />
                    )}
                    حفظ
                  </Button>
                </div>
              </div>

              {editMode === "preview" ? (
                <Card className="border-border/30">
                  <CardContent className="p-6">
                    <IntegrationDocs providerKey={formData.provider_key} />
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Basic fields */}
                  <Card className="border-border/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">البيانات الأساسية</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">مفتاح المزود *</label>
                          <Input
                            value={formData.provider_key}
                            onChange={(e) => handleFieldChange("provider_key", e.target.value)}
                            placeholder="shopify"
                            className="h-9 text-sm font-mono"
                            dir="ltr"
                            disabled={!!selectedId}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">العنوان (عربي) *</label>
                          <Input
                            value={formData.title}
                            onChange={(e) => handleFieldChange("title", e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">العنوان (إنجليزي)</label>
                          <Input
                            value={formData.title_en}
                            onChange={(e) => handleFieldChange("title_en", e.target.value)}
                            className="h-9 text-sm"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">وصف مختصر (عربي)</label>
                          <Input
                            value={formData.short_description}
                            onChange={(e) => handleFieldChange("short_description", e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* JSON fields */}
                  {[
                    { key: "setup_steps", label: "خطوات الإعداد (JSON)" },
                    { key: "faq", label: "الأسئلة الشائعة (JSON)" },
                    { key: "troubleshooting", label: "استكشاف الأخطاء (JSON)" },
                    { key: "security_notes", label: "ملاحظات أمنية (JSON)" },
                  ].map(({ key, label }) => (
                    <Card key={key} className="border-border/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          {label}
                          {jsonErrors[key] && (
                            <Badge variant="destructive" className="text-[10px]">
                              {jsonErrors[key]}
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <textarea
                          value={formData[key]}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          className={`w-full h-40 font-mono text-xs p-3 rounded-lg border bg-muted/30 resize-y focus:outline-none focus:ring-2 focus:ring-accent/30 ${
                            jsonErrors[key] ? "border-destructive" : "border-border/40"
                          }`}
                          dir="ltr"
                          spellCheck={false}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminIntegrationDocs;
