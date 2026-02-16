import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Upload, FileText, Loader2, Check, X, Edit3, Plus, Trash2, Save,
  ScanLine, AlertCircle, ImagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  formatCurrency,
  generateInvoiceNumber,
  calculateItemTotals,
  calculateInvoiceTotals,
  type InvoiceItem,
} from "@/lib/invoice-utils";
import { FormLabel } from "@/components/ui/form-tooltip";
import { useEffect } from "react";

interface OcrInvoiceUploadProps {
  onBack: () => void;
  onSaved: (id: string) => void;
}

interface ExtractedInvoice {
  vendor_name?: string;
  vendor_name_en?: string;
  vendor_vat_number?: string;
  vendor_cr_number?: string;
  vendor_address?: string;
  vendor_phone?: string;
  vendor_email?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  currency?: string;
  customer_name?: string;
  customer_vat_number?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    discount?: number;
    vat_rate?: number;
  }>;
  subtotal?: number;
  vat_total?: number;
  grand_total?: number;
  notes?: string;
}

interface FileEntry {
  file: File;
  preview: string;
  status: "pending" | "processing" | "done" | "error";
  data?: ExtractedInvoice;
  error?: string;
}

const OcrInvoiceUpload = ({ onBack, onSaved }: OcrInvoiceUploadProps) => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  // Editable fields for active invoice
  const [editData, setEditData] = useState<ExtractedInvoice | null>(null);
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("customers")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setCustomers(data);
      });
  }, [tenantId]);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith("image/") || f.type === "application/pdf"
      );
      addFiles(droppedFiles);
    },
    []
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const addFiles = (newFiles: File[]) => {
    const entries: FileEntry[] = newFiles.map((f) => ({
      file: f,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...entries]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (activeIndex === index) {
      setActiveIndex(null);
      setEditData(null);
      setEditItems([]);
    }
  };

  const processFile = async (index: number) => {
    const entry = files[index];
    if (!entry) return;

    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, status: "processing" } : f))
    );

    try {
      // Convert to base64
      const buffer = await entry.file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const { data, error } = await supabase.functions.invoke("ocr-invoice", {
        body: {
          imageBase64: base64,
          fileName: entry.file.name,
          fileSize: entry.file.size,
          mimeType: entry.file.type,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const extracted = data.data as ExtractedInvoice;
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "done", data: extracted } : f
        )
      );

      // Auto-select this file for review
      setActiveIndex(index);
      loadEditData(extracted);

      toast({ title: "تم استخراج البيانات بنجاح", description: `${entry.file.name}` });
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "error", error: err.message } : f
        )
      );
      toast({
        title: "فشل المعالجة",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const processAll = async () => {
    const pending = files
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => f.status === "pending");
    for (const { i } of pending) {
      await processFile(i);
    }
  };

  const loadEditData = (data: ExtractedInvoice) => {
    setEditData(data);
    const items: InvoiceItem[] = (data.items || []).map((item) => {
      const base: InvoiceItem = {
        id: crypto.randomUUID(),
        description: item.description || "",
        quantity: item.quantity || 1,
        unit: item.unit || "وحدة",
        unit_price: item.unit_price || 0,
        discount: item.discount || 0,
        vat_rate: item.vat_rate ?? 15,
        vat_amount: 0,
        line_total: 0,
      };
      const totals = calculateItemTotals(base);
      return { ...base, ...totals };
    });
    if (items.length === 0) {
      items.push({
        id: crypto.randomUUID(),
        description: "",
        quantity: 1,
        unit: "وحدة",
        unit_price: 0,
        discount: 0,
        vat_rate: 15,
        vat_amount: 0,
        line_total: 0,
      });
    }
    setEditItems(items);
  };

  const selectForReview = (index: number) => {
    const entry = files[index];
    if (entry?.data) {
      setActiveIndex(index);
      loadEditData(entry.data);
    }
  };

  const updateEditItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setEditItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        const totals = calculateItemTotals(updated);
        return { ...updated, ...totals };
      })
    );
  };

  const addEditItem = () => {
    setEditItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: 1,
        unit: "وحدة",
        unit_price: 0,
        discount: 0,
        vat_rate: 15,
        vat_amount: 0,
        line_total: 0,
      },
    ]);
  };

  const removeEditItem = (id: string) => {
    if (editItems.length > 1) setEditItems((prev) => prev.filter((i) => i.id !== id));
  };

  const totals = calculateInvoiceTotals(editItems);

  const handleSaveInvoice = async () => {
    if (!tenantId || !user || !editData) return;
    if (!selectedCustomerId) {
      toast({ title: "تنبيه", description: "يرجى اختيار العميل", variant: "destructive" });
      return;
    }
    if (editItems.every((i) => !i.description.trim())) {
      toast({ title: "تنبيه", description: "أضف بند واحد على الأقل", variant: "destructive" });
      return;
    }

    setSaving(true);
    const invoiceNumber = editData.invoice_number || generateInvoiceNumber();
    const invoiceDate = editData.invoice_date || new Date().toISOString().split("T")[0];
    const dueDate = editData.due_date || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        tenant_id: tenantId,
        customer_id: selectedCustomerId,
        created_by: user.id,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        supply_date: invoiceDate,
        due_date: dueDate,
        subtotal: totals.subtotal,
        discount_total: totals.discount_total,
        vat_total: totals.vat_total,
        grand_total: totals.grand_total,
        amount_due: totals.grand_total,
        notes: editData.notes || null,
        status: "draft",
      })
      .select("id")
      .single();

    if (error || !invoice) {
      toast({ title: "خطأ", description: error?.message || "فشل حفظ الفاتورة", variant: "destructive" });
      setSaving(false);
      return;
    }

    const itemsPayload = editItems
      .filter((i) => i.description.trim())
      .map((item, idx) => ({
        tenant_id: tenantId,
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        discount: item.discount,
        vat_rate: item.vat_rate,
        vat_amount: item.vat_amount,
        line_total: item.line_total,
        sort_order: idx,
      }));

    await supabase.from("invoice_items").insert(itemsPayload);

    toast({ title: "تم حفظ الفاتورة بنجاح" });
    setSaving(false);
    onSaved(invoice.id);
  };

  const inputClass =
    "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors";
  const smallInputClass =
    "h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-center font-english focus:border-accent focus:outline-none transition-colors";

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <div dir="rtl" className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowRight size={18} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ScanLine size={22} className="text-accent" />
              استيراد فواتير بالذكاء الاصطناعي
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              ارفع صور أو ملفات PDF للفواتير وسيتم استخراج البيانات تلقائياً
            </p>
          </div>
        </div>
        {pendingCount > 0 && (
          <Button onClick={processAll} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            <ScanLine size={16} />
            معالجة الكل ({pendingCount})
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: File Upload & List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Drop Zone */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border-2 border-dashed border-border bg-card p-8 text-center hover:border-accent/50 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => document.getElementById("ocr-file-input")?.click()}
          >
            <ImagePlus size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">اسحب الملفات هنا أو انقر للرفع</p>
            <p className="text-xs text-muted-foreground">
              يدعم صور JPG, PNG, WEBP و ملفات PDF
            </p>
            <input
              id="ocr-file-input"
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </motion.div>

          {/* File List */}
          <AnimatePresence>
            {files.map((entry, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`rounded-xl border bg-card p-4 shadow-card cursor-pointer transition-colors ${
                  activeIndex === index ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent/30"
                }`}
                onClick={() => entry.data && selectForReview(index)}
              >
                <div className="flex items-center gap-3">
                  {entry.preview ? (
                    <img
                      src={entry.preview}
                      alt={entry.file.name}
                      className="h-12 w-12 rounded-lg object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <FileText size={20} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{entry.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(entry.file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          processFile(index);
                        }}
                        className="gap-1 text-xs"
                      >
                        <ScanLine size={12} />
                        معالجة
                      </Button>
                    )}
                    {entry.status === "processing" && (
                      <Loader2 size={18} className="animate-spin text-accent" />
                    )}
                    {entry.status === "done" && (
                      <div className="flex items-center gap-1 text-success">
                        <Check size={16} />
                        <span className="text-xs">تم</span>
                      </div>
                    )}
                    {entry.status === "error" && (
                      <div className="flex items-center gap-1 text-destructive">
                        <AlertCircle size={16} />
                        <span className="text-xs">خطأ</span>
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                {entry.status === "error" && entry.error && (
                  <p className="text-xs text-destructive mt-2 pr-15">{entry.error}</p>
                )}
                {entry.status === "done" && entry.data && (
                  <div className="mt-2 pr-15 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{entry.data.vendor_name}</span>
                    {entry.data.grand_total && (
                      <>
                        <span>•</span>
                        <span className="font-english">{formatCurrency(entry.data.grand_total)} ر.س</span>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {files.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {doneCount} من {files.length} تم معالجتها
            </p>
          )}
        </div>

        {/* Right: Review & Edit */}
        <div className="lg:col-span-3 space-y-4">
          {activeIndex !== null && editData ? (
            <>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card p-5 shadow-card"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Edit3 size={14} className="text-accent" />
                    مراجعة وتعديل البيانات المستخرجة
                  </h3>
                  <Button
                    onClick={handleSaveInvoice}
                    disabled={saving}
                    className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    حفظ كفاتورة
                  </Button>
                </div>

                {/* Vendor Info (Read Only) */}
                <div className="rounded-lg border border-border p-4 mb-4" style={{ background: "hsl(210 20% 97%)" }}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">بيانات المورد (مستخرجة)</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">الاسم:</span>
                      <p className="font-medium text-foreground">{editData.vendor_name || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">الرقم الضريبي:</span>
                      <p className="font-medium font-english text-foreground" dir="ltr">
                        {editData.vendor_vat_number || "—"}
                      </p>
                    </div>
                    {editData.vendor_cr_number && (
                      <div>
                        <span className="text-xs text-muted-foreground">السجل التجاري:</span>
                        <p className="font-medium font-english text-foreground" dir="ltr">
                          {editData.vendor_cr_number}
                        </p>
                      </div>
                    )}
                    {editData.invoice_number && (
                      <div>
                        <span className="text-xs text-muted-foreground">رقم الفاتورة:</span>
                        <p className="font-medium font-english text-foreground" dir="ltr">
                          {editData.invoice_number}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer Selection */}
                <div className="mb-4">
                  <FormLabel
                    label="ربط بعميل"
                    required
                    tooltip="اختر العميل الذي ستُسجل الفاتورة باسمه في النظام"
                  />
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— اختر عميل —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {editData.customer_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      العميل المستخرج: <span className="font-medium text-foreground">{editData.customer_name}</span>
                    </p>
                  )}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <FormLabel label="تاريخ الفاتورة" />
                    <input
                      type="date"
                      value={editData.invoice_date || ""}
                      onChange={(e) => setEditData((prev) => prev ? { ...prev, invoice_date: e.target.value } : prev)}
                      className={`${inputClass} font-english`}
                    />
                  </div>
                  <div>
                    <FormLabel label="تاريخ الاستحقاق" />
                    <input
                      type="date"
                      value={editData.due_date || ""}
                      onChange={(e) => setEditData((prev) => prev ? { ...prev, due_date: e.target.value } : prev)}
                      className={`${inputClass} font-english`}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Items Table */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
              >
                <div className="p-5 pb-3">
                  <h3 className="text-sm font-semibold text-foreground">البنود المستخرجة</h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    راجع وعدّل البنود قبل الحفظ — يمكنك إضافة أو حذف بنود
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" dir="rtl">
                    <thead>
                      <tr className="border-y border-border bg-secondary/30">
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground" style={{ width: "30%" }}>الوصف</th>
                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "8%" }}>الكمية</th>
                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "10%" }}>الوحدة</th>
                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "12%" }}>السعر</th>
                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "10%" }}>الخصم</th>
                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "8%" }}>الضريبة</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground" style={{ width: "14%" }}>الإجمالي</th>
                        <th className="px-2 py-2.5" style={{ width: "5%" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item) => (
                        <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/10 transition-colors">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateEditItem(item.id, "description", e.target.value)}
                              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:border-accent focus:outline-none transition-colors"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" value={item.quantity} onChange={(e) => updateEditItem(item.id, "quantity", parseFloat(e.target.value) || 0)} min="0" dir="ltr" className={smallInputClass} />
                          </td>
                          <td className="px-2 py-2">
                            <input type="text" value={item.unit} onChange={(e) => updateEditItem(item.id, "unit", e.target.value)} className={smallInputClass} />
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" value={item.unit_price} onChange={(e) => updateEditItem(item.id, "unit_price", parseFloat(e.target.value) || 0)} min="0" step="0.01" dir="ltr" className={smallInputClass} />
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" value={item.discount} onChange={(e) => updateEditItem(item.id, "discount", parseFloat(e.target.value) || 0)} min="0" step="0.01" dir="ltr" className={smallInputClass} />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className="text-xs font-english text-muted-foreground">{item.vat_rate}٪</span>
                          </td>
                          <td className="px-3 py-2 text-left">
                            <span className="text-sm font-semibold font-english text-foreground" dir="ltr">{formatCurrency(item.line_total)}</span>
                          </td>
                          <td className="px-2 py-2">
                            <button
                              onClick={() => removeEditItem(item.id)}
                              disabled={editItems.length <= 1}
                              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t border-border/50">
                  <Button variant="outline" size="sm" onClick={addEditItem} className="gap-1.5 text-xs">
                    <Plus size={14} />
                    إضافة بند
                  </Button>
                </div>
              </motion.div>

              {/* Totals */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-xl border border-border bg-card p-5 shadow-card"
              >
                <h3 className="text-sm font-semibold text-foreground mb-3">ملخص الفاتورة</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">المجموع الفرعي</span>
                    <span className="font-english font-medium text-foreground" dir="ltr">
                      {formatCurrency(totals.subtotal)} ر.س
                    </span>
                  </div>
                  {totals.discount_total > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">الخصم</span>
                      <span className="font-english font-medium text-destructive" dir="ltr">
                        - {formatCurrency(totals.discount_total)} ر.س
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ضريبة القيمة المضافة (١٥٪)</span>
                    <span className="font-english font-medium text-foreground" dir="ltr">
                      {formatCurrency(totals.vat_total)} ر.س
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-foreground">الإجمالي المستحق</span>
                      <span className="text-lg font-bold font-english text-accent" dir="ltr">
                        {formatCurrency(totals.grand_total)} ر.س
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {editData.notes && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">ملاحظات مستخرجة:</p>
                    <p className="text-sm text-foreground">{editData.notes}</p>
                  </div>
                )}
              </motion.div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <Upload size={48} className="text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground mb-1">ارفع ملفات الفواتير ثم قم بمعالجتها</p>
              <p className="text-xs text-muted-foreground">ستظهر البيانات المستخرجة هنا للمراجعة والتعديل قبل الحفظ</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OcrInvoiceUpload;
