import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Upload, Download, Eye, AlertTriangle, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { FEATURE_KEYS } from "@/lib/entitlement-types";

const DOC_TYPES: Record<string, { ar: string; en: string; noExpiry?: boolean; requiredExpiry?: boolean }> = {
  national_id_or_iqama: { ar: "الهوية / الإقامة", en: "National ID / Iqama", requiredExpiry: true },
  national_id: { ar: "الهوية الوطنية", en: "National ID", requiredExpiry: true },
  iqama: { ar: "الإقامة", en: "Iqama", requiredExpiry: true },
  gosi_contract: { ar: "عقد التأمينات", en: "GOSI Contract", noExpiry: true },
  passport: { ar: "جواز السفر", en: "Passport" },
  work_contract: { ar: "عقد العمل", en: "Work Contract" },
  medical_insurance: { ar: "التأمين الطبي", en: "Medical Insurance" },
  driving_license: { ar: "رخصة القيادة", en: "Driving License" },
  degree_certificate: { ar: "شهادة جامعية", en: "Degree Certificate" },
  training_certificate: { ar: "شهادة تدريب", en: "Training Certificate" },
  bank_letter: { ar: "خطاب البنك", en: "Bank Letter" },
  other: { ar: "أخرى", en: "Other" },
};

function getExpiryStatus(expiryDate: string | null): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (!expiryDate) return { label: "بدون انتهاء", variant: "outline" };
  const diff = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: "منتهي", variant: "destructive" };
  if (diff <= 30) return { label: `ينتهي خلال ${diff} يوم`, variant: "secondary" };
  return { label: "ساري", variant: "default" };
}

interface Props {
  employeeId: string;
  employeeName: string;
}

export default function EmployeeDocumentCenter({ employeeId, employeeName }: Props) {
  const { tenantId, user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    document_type: "other",
    title: "",
    issued_date: "",
    expiry_date: "",
    notes: "",
  });

  const { entitlementsMap } = useEntitlementsContext();
  const docsEntry = entitlementsMap[FEATURE_KEYS.HR_DOCUMENTS];
  const docLimit = docsEntry?.limit ?? null;

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["employee-documents", employeeId],
    enabled: !!tenantId && !!employeeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const totalDocs = documents.length;
  const isAtLimit = docLimit !== null && totalDocs >= docLimit;
  const usagePercent = docLimit ? Math.min((totalDocs / docLimit) * 100, 100) : 0;

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      const ext = file.name.split(".").pop();
      const path = `${tenantId}/${employeeId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("hr-documents")
        .upload(path, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("employee_documents").insert({
        tenant_id: tenantId!,
        employee_id: employeeId,
        document_type: form.document_type as any,
        title: form.title || DOC_TYPES[form.document_type]?.ar || "مستند",
        file_path: path,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        issued_date: form.issued_date || null,
        expiry_date: DOC_TYPES[form.document_type]?.noExpiry ? null : (form.expiry_date || null),
        notes: form.notes || null,
        uploaded_by: user!.id,
      });
      if (insertErr) throw insertErr;
    },
    onSuccess: () => {
      toast.success("تم رفع المستند بنجاح | Document uploaded");
      qc.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
      closeDrawer();
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setUploading(false),
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("hr-documents").remove([doc.file_path]);
      const { error } = await supabase.from("employee_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف المستند | Document deleted");
      qc.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeDrawer = () => {
    setDrawerOpen(false);
    setForm({ document_type: "other", title: "", issued_date: "", expiry_date: "", notes: "" });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("يرجى اختيار ملف | Please select a file");
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) return toast.error("يُسمح بـ PDF / JPG / PNG فقط");
    if (file.size > 10 * 1024 * 1024) return toast.error("الحد الأقصى 10MB");
    const docMeta = DOC_TYPES[form.document_type];
    if (docMeta?.requiredExpiry && !form.expiry_date) {
      return toast.error("تاريخ الانتهاء مطلوب لهذا النوع | Expiry date is required");
    }
    uploadMutation.mutate(file);
  };

  const viewDocument = async (doc: any) => {
    const { data } = await supabase.storage.from("hr-documents").createSignedUrl(doc.file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("تعذّر فتح المستند");
  };

  const downloadDocument = async (doc: any) => {
    const { data } = await supabase.storage.from("hr-documents").download(doc.file_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } else toast.error("تعذّر تحميل المستند");
  };

  return (
    <div className="space-y-4">
      {/* Header + Upload button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-foreground">مستندات الموظف | Employee Documents</h3>
          <p className="text-xs text-muted-foreground">{employeeName}</p>
        </div>
        <Button
          onClick={() => setDrawerOpen(true)}
          size="sm"
          className="gap-1.5 min-h-[48px]"
          disabled={isAtLimit}
        >
          <Upload className="h-4 w-4" />
          <span>رفع مستند</span>
        </Button>
      </div>

      {/* Quota Banner */}
      {docLimit !== null && (
        <Card className={`border-border/50 ${isAtLimit ? "border-destructive/50 bg-destructive/5" : ""}`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2">
                {isAtLimit && <AlertTriangle className="h-4 w-4 text-destructive" />}
                <p className="text-xs font-semibold text-foreground">عداد المستندات | Document Quota</p>
              </div>
              <p className="text-sm font-bold tabular-nums">
                {totalDocs.toLocaleString("ar-SA")} / {docLimit.toLocaleString("ar-SA")}
              </p>
            </div>
            <Progress value={usagePercent} className="h-1.5" />
            {isAtLimit && (
              <p className="text-xs text-destructive mt-1.5">تم بلوغ الحد الأقصى. يرجى ترقية الباقة.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Document Cards */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground">لا توجد مستندات</p>
            <p className="text-xs text-muted-foreground">No documents uploaded yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {documents.map((doc: any) => {
            const expiry = getExpiryStatus(doc.expiry_date);
            const docType = DOC_TYPES[doc.document_type] ?? DOC_TYPES.other;
            return (
              <Card key={doc.id} className="border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">{docType.ar} — {docType.en}</p>
                      </div>
                    </div>
                    <Badge variant={expiry.variant} className="shrink-0 text-[10px]">
                      {expiry.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {doc.issued_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        صدور: {doc.issued_date}
                      </span>
                    )}
                    {doc.expiry_date && (
                      <span>انتهاء: {doc.expiry_date}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button variant="outline" size="sm" className="gap-1 min-h-[40px] flex-1" onClick={() => viewDocument(doc)}>
                      <Eye className="h-3.5 w-3.5" />
                      عرض
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 min-h-[40px] flex-1" onClick={() => downloadDocument(doc)}>
                      <Download className="h-3.5 w-3.5" />
                      تحميل
                    </Button>
                    <Button variant="ghost" size="sm" className="min-h-[40px] text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(doc)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Drawer */}
      <Sheet open={drawerOpen} onOpenChange={(o) => { if (!o) closeDrawer(); }}>
        <SheetContent side={document.documentElement.dir === "rtl" ? "right" : "left"} className="w-full sm:w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>رفع مستند جديد</SheetTitle>
            <SheetDescription>Upload New Document</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div>
              <Label className="text-xs font-semibold">نوع المستند <span className="text-destructive">*</span></Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Document Type</p>
              <Select value={form.document_type} onValueChange={(v) => setForm(f => ({ ...f, document_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.ar} — {v.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">عنوان المستند</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Document Title</p>
              <Input
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder={DOC_TYPES[form.document_type]?.ar ?? "مستند"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">تاريخ الإصدار</Label>
                <p className="text-[10px] text-muted-foreground mb-1.5">Issue Date</p>
                <Input type="date" dir="ltr" value={form.issued_date} onChange={(e) => setForm(f => ({ ...f, issued_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-semibold">
                  تاريخ الانتهاء {DOC_TYPES[form.document_type]?.requiredExpiry && <span className="text-destructive">*</span>}
                </Label>
                <p className="text-[10px] text-muted-foreground mb-1.5">Expiry Date</p>
                {DOC_TYPES[form.document_type]?.noExpiry ? (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">غير مطلوب لهذا النوع | Not applicable</p>
                ) : (
                  <Input type="date" dir="ltr" value={form.expiry_date} onChange={(e) => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">الملف <span className="text-destructive">*</span></Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">PDF / JPG / PNG — حد أقصى 10MB</p>
              <Input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="min-h-[48px]"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">ملاحظات</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Notes (optional)</p>
              <Input value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات إضافية..." />
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full min-h-[48px] mt-2"
            >
              {uploading ? "جاري الرفع... | Uploading..." : "رفع المستند | Upload Document"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
