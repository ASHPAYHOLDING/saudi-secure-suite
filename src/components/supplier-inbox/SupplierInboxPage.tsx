import { useState, useCallback, useEffect } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Inbox, Upload, FileText, Search, CheckCircle2, XCircle, Eye,
  AlertTriangle, Loader2, Trash2, Shield, Clock, Filter,
} from "lucide-react";

interface SupplierInvoice {
  id: string;
  file_name: string;
  file_url: string;
  ocr_status: string;
  status: string;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number;
  vat_amount: number;
  currency: string;
  is_spam: boolean;
  spam_score: number;
  description: string | null;
  rejection_reason: string | null;
  created_at: string;
  ocr_data: any;
}

const SupplierInboxPage = () => {
  const { currentLang } = useLanguage();
  const { tenantId, user } = useAuth();
  const isRTL = currentLang === "ar";

  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [detailInvoice, setDetailInvoice] = useState<SupplierInvoice | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);

  const fetchInvoices = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    let query = supabase
      .from("supplier_invoices")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;
    setInvoices((data as SupplierInvoice[]) || []);
    setLoading(false);
  }, [tenantId, filter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !tenantId || !user) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const filePath = `${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("supplier-invoices")
        .upload(filePath, file);

      if (uploadErr) {
        toast.error(isRTL ? `فشل رفع ${file.name}` : `Failed to upload ${file.name}`);
        continue;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("supplier_invoices")
        .insert({
          tenant_id: tenantId,
          uploaded_by: user.id,
          file_url: filePath,
          file_name: file.name,
          file_size_bytes: file.size,
        } as any)
        .select()
        .single();

      if (insertErr) {
        toast.error(isRTL ? "فشل حفظ السجل" : "Failed to save record");
        continue;
      }

      // Trigger OCR
      supabase.functions.invoke("ocr-supplier-invoice", {
        body: { supplierInvoiceId: (inserted as any).id },
      }).then(({ error }) => {
        if (error) console.error("OCR trigger failed:", error);
        fetchInvoices();
      });
    }

    toast.success(isRTL ? `تم رفع ${files.length} ملف` : `${files.length} file(s) uploaded`);
    setUploading(false);
    fetchInvoices();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files);
  };

  const approve = async (id: string) => {
    const { error } = await supabase
      .from("supplier_invoices")
      .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() } as any)
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) {
      toast.error(isRTL ? "فشل الاعتماد" : "Approval failed");
      return;
    }
    toast.success(isRTL ? "تم الاعتماد" : "Approved");
    fetchInvoices();
  };

  const reject = async (id: string) => {
    const { error } = await supabase
      .from("supplier_invoices")
      .update({ status: "rejected", rejection_reason: rejectReason } as any)
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) {
      toast.error(isRTL ? "فشل الرفض" : "Rejection failed");
      return;
    }
    setRejectingId(null);
    setRejectReason("");
    toast.success(isRTL ? "تم الرفض" : "Rejected");
    fetchInvoices();
  };

  const markReviewed = async (id: string) => {
    await supabase
      .from("supplier_invoices")
      .update({ status: "reviewed", reviewed_by: user?.id, reviewed_at: new Date().toISOString() } as any)
      .eq("id", id);
    toast.success(isRTL ? "تم المراجعة" : "Marked as reviewed");
    fetchInvoices();
  };

  const deleteInvoice = async (id: string) => {
    if (!tenantId) return;
    const { error } = await supabase
      .from("supplier_invoices")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) {
      toast.error(isRTL ? "فشل الحذف - قد لا تملك الصلاحية" : "Delete failed - you may not have permission");
      return;
    }
    toast.success(isRTL ? "تم الحذف" : "Deleted");
    fetchInvoices();
  };

  const bulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setBulkApproving(true);
    await supabase
      .from("supplier_invoices")
      .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() } as any)
      .in("id", Array.from(selectedIds));
    toast.success(isRTL ? `تم اعتماد ${selectedIds.size} فاتورة` : `${selectedIds.size} invoices approved`);
    setSelectedIds(new Set());
    setBulkApproving(false);
    fetchInvoices();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const statusBadge = (status: string, isSpam: boolean) => {
    if (isSpam) return <Badge variant="destructive" className="text-[10px]"><Shield className="h-3 w-3 mr-1" />{isRTL ? "مشبوه" : "Spam"}</Badge>;
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending_review: { variant: "outline", label: isRTL ? "بانتظار المراجعة" : "Pending Review" },
      reviewed: { variant: "secondary", label: isRTL ? "تمت المراجعة" : "Reviewed" },
      approved: { variant: "default", label: isRTL ? "معتمد" : "Approved" },
      rejected: { variant: "destructive", label: isRTL ? "مرفوض" : "Rejected" },
      converted: { variant: "default", label: isRTL ? "محوّل" : "Converted" },
    };
    const s = map[status] || { variant: "outline" as const, label: status };
    return <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>;
  };

  const ocrBadge = (status: string) => {
    const map: Record<string, { icon: any; cls: string; label: string }> = {
      pending: { icon: Clock, cls: "text-muted-foreground", label: isRTL ? "بانتظار OCR" : "OCR Pending" },
      processing: { icon: Loader2, cls: "text-accent animate-spin", label: isRTL ? "جاري المعالجة" : "Processing" },
      completed: { icon: CheckCircle2, cls: "text-accent", label: isRTL ? "مكتمل" : "Completed" },
      failed: { icon: XCircle, cls: "text-destructive", label: isRTL ? "فشل" : "Failed" },
    };
    const s = map[status] || map.pending;
    const Icon = s.icon;
    return <span className={`flex items-center gap-1 text-[10px] ${s.cls}`}><Icon className="h-3 w-3" />{s.label}</span>;
  };

  const filtered = invoices.filter(inv => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (inv.supplier_name?.toLowerCase().includes(q) ||
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.file_name.toLowerCase().includes(q));
  });

  const stats = {
    total: invoices.length,
    pending: invoices.filter(i => i.status === "pending_review").length,
    spam: invoices.filter(i => i.is_spam).length,
    approved: invoices.filter(i => i.status === "approved").length,
  };

  return (
    <div className="p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" />
            {isRTL ? "صندوق فواتير الموردين" : "Supplier Invoice Inbox"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? "رفع ومعالجة واعتماد فواتير الموردين" : "Upload, process, and approve supplier invoices"}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: isRTL ? "الإجمالي" : "Total", value: stats.total, icon: FileText, cls: "text-primary" },
          { label: isRTL ? "بانتظار المراجعة" : "Pending", value: stats.pending, icon: Clock, cls: "text-accent" },
          { label: isRTL ? "معتمد" : "Approved", value: stats.approved, icon: CheckCircle2, cls: "text-accent" },
          { label: isRTL ? "مشبوه" : "Spam", value: stats.spam, icon: Shield, cls: "text-destructive" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <s.icon className={`h-5 w-5 ${s.cls}`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upload Zone */}
      <Card
        className="border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors cursor-pointer"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => document.getElementById("supplier-file-input")?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
          {uploading ? (
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          ) : (
            <Upload className="h-10 w-10 text-primary/50" />
          )}
          <p className="text-sm text-muted-foreground">
            {isRTL ? "اسحب وأفلت ملفات الفواتير هنا أو اضغط للرفع" : "Drag & drop invoice files here or click to upload"}
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            {isRTL ? "PDF, JPG, PNG — حد أقصى 20MB" : "PDF, JPG, PNG — Max 20MB"}
          </p>
          <input
            id="supplier-file-input"
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            multiple
            onChange={e => handleUpload(e.target.files)}
          />
        </CardContent>
      </Card>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute top-2.5 ltr:left-3 rtl:right-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isRTL ? "ابحث بالمورد أو رقم الفاتورة..." : "Search by supplier or invoice number..."}
            className="ltr:pl-9 rtl:pr-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {["all", "pending_review", "reviewed", "approved", "rejected"].map(f => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? (isRTL ? "الكل" : "All") :
               f === "pending_review" ? (isRTL ? "معلق" : "Pending") :
               f === "reviewed" ? (isRTL ? "مراجع" : "Reviewed") :
               f === "approved" ? (isRTL ? "معتمد" : "Approved") :
               isRTL ? "مرفوض" : "Rejected"}
            </Button>
          ))}
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 p-3">
          <span className="text-sm font-medium">{isRTL ? `${selectedIds.size} محدد` : `${selectedIds.size} selected`}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>{isRTL ? "إلغاء" : "Deselect"}</Button>
            <Button size="sm" onClick={bulkApprove} disabled={bulkApproving}>
              <CheckCircle2 className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {isRTL ? "اعتماد الكل" : "Approve All"}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">{isRTL ? "جاري التحميل..." : "Loading..."}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">{isRTL ? "لا توجد فواتير" : "No invoices"}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={selectedIds.has(inv.id)}
                    onCheckedChange={() => toggleSelect(inv.id)}
                    disabled={inv.status === "approved" || inv.status === "rejected"}
                  />
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">
                        {inv.supplier_name || inv.file_name}
                      </span>
                      {inv.invoice_number && (
                        <span className="text-xs text-muted-foreground">#{inv.invoice_number}</span>
                      )}
                      {statusBadge(inv.status, inv.is_spam)}
                      {ocrBadge(inv.ocr_status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {inv.file_name} · {new Date(inv.created_at).toLocaleDateString(isRTL ? "ar-SA" : "en-US")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {inv.total_amount > 0 && (
                      <p className="text-sm font-semibold text-foreground">
                        {inv.total_amount.toLocaleString()} <span className="text-xs text-muted-foreground">{inv.currency}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailInvoice(inv)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {inv.status === "pending_review" && inv.ocr_status === "completed" && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-accent" onClick={() => markReviewed(inv.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-accent" onClick={() => approve(inv.id)}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setRejectingId(inv.id)}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {inv.status === "reviewed" && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-accent" onClick={() => approve(inv.id)}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setRejectingId(inv.id)}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {(inv.status === "pending_review" || inv.is_spam) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteInvoice(inv.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailInvoice} onOpenChange={() => setDetailInvoice(null)}>
        <DialogContent className="max-w-lg" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "تفاصيل الفاتورة" : "Invoice Details"}</DialogTitle>
          </DialogHeader>
          {detailInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">{isRTL ? "المورد" : "Supplier"}</span><p className="font-medium">{detailInvoice.supplier_name || "—"}</p></div>
                <div><span className="text-muted-foreground">{isRTL ? "رقم الفاتورة" : "Invoice #"}</span><p className="font-medium">{detailInvoice.invoice_number || "—"}</p></div>
                <div><span className="text-muted-foreground">{isRTL ? "التاريخ" : "Date"}</span><p className="font-medium">{detailInvoice.invoice_date || "—"}</p></div>
                <div><span className="text-muted-foreground">{isRTL ? "الإجمالي" : "Total"}</span><p className="font-medium">{detailInvoice.total_amount.toLocaleString()} {detailInvoice.currency}</p></div>
                <div><span className="text-muted-foreground">{isRTL ? "الضريبة" : "VAT"}</span><p className="font-medium">{detailInvoice.vat_amount.toLocaleString()} {detailInvoice.currency}</p></div>
                <div><span className="text-muted-foreground">{isRTL ? "الحالة" : "Status"}</span><div>{statusBadge(detailInvoice.status, detailInvoice.is_spam)}</div></div>
              </div>
              {detailInvoice.description && (
                <div><span className="text-sm text-muted-foreground">{isRTL ? "الوصف" : "Description"}</span><p className="text-sm">{detailInvoice.description}</p></div>
              )}
              {detailInvoice.is_spam && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {isRTL ? `درجة الاشتباه: ${(detailInvoice.spam_score * 100).toFixed(0)}%` : `Spam score: ${(detailInvoice.spam_score * 100).toFixed(0)}%`}
                </div>
              )}
              {detailInvoice.rejection_reason && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <strong>{isRTL ? "سبب الرفض:" : "Rejection reason:"}</strong> {detailInvoice.rejection_reason}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{isRTL ? "الملف:" : "File:"} {detailInvoice.file_name}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectingId} onOpenChange={() => { setRejectingId(null); setRejectReason(""); }}>
        <DialogContent dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "رفض الفاتورة" : "Reject Invoice"}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder={isRTL ? "سبب الرفض..." : "Rejection reason..."}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingId(null)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
            <Button variant="destructive" onClick={() => rejectingId && reject(rejectingId)} disabled={!rejectReason}>
              {isRTL ? "رفض" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierInboxPage;
