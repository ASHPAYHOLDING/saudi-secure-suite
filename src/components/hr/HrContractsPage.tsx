import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Upload, Replace, History, Search, ShieldCheck, AlertCircle, Download, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import SmartEmptyState from "@/components/ui/smart-empty-state";

const CONTRACT_TYPES: Record<string, { ar: string; en: string }> = {
  full_time: { ar: "دوام كامل", en: "Full-time" },
  part_time: { ar: "دوام جزئي", en: "Part-time" },
  contract: { ar: "عقد مؤقت", en: "Contract" },
  internship: { ar: "تدريب", en: "Internship" },
  probation: { ar: "فترة تجربة", en: "Probation" },
};

export default function HrContractsPage() {
  const { tenantId, user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uploadNote, setUploadNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch employees with their current contracts
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["hr-contracts-gosi", tenantId, search],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from("hr_employees")
        .select("id, first_name, last_name, employee_number, status, position_id, org_departments(name), hr_contracts(id, contract_type, start_date, end_date, is_current, contract_number)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (search) {
        q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_number.ilike.%${search}%`);
      }
      const { data } = await q.limit(100);
      return data ?? [];
    },
  });

  // Fetch contract files for selected employee
  const { data: contractFiles = [], isLoading: filesLoading } = useQuery({
    queryKey: ["hr-contract-files", selectedEmployee?.id],
    enabled: !!selectedEmployee?.id && !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("hr_employee_contract_files" as any)
        .select("*")
        .eq("employee_id", selectedEmployee!.id)
        .eq("tenant_id", tenantId!)
        .order("uploaded_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const activeFile = contractFiles.find((f: any) => f.is_active);
  const historyFiles = contractFiles.filter((f: any) => !f.is_active);

  const handleUpload = async (isReplace: boolean) => {
    const file = fileRef.current?.files?.[0];
    if (!file || !selectedEmployee || !tenantId) return;

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("يُسمح فقط بملفات PDF أو صور (PNG, JPG, WebP)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("الحد الأقصى لحجم الملف 10 ميجابايت");
      return;
    }

    setUploading(true);
    try {
      const timestamp = Date.now();
      const ext = file.name.split(".").pop() || "pdf";
      const filePath = `${tenantId}/${selectedEmployee.id}/${timestamp}.${ext}`;

      // Upload to storage
      const { error: storageError } = await supabase.storage
        .from("hr-contracts")
        .upload(filePath, file, { contentType: file.type });

      if (storageError) throw storageError;

      // If replacing, deactivate the current active file
      if (isReplace && activeFile) {
        await supabase
          .from("hr_employee_contract_files" as any)
          .update({ is_active: false } as any)
          .eq("id", activeFile.id)
          .eq("tenant_id", tenantId);
      }

      // Insert file record
      const { error: dbError } = await supabase
        .from("hr_employee_contract_files" as any)
        .insert({
          employee_id: selectedEmployee.id,
          tenant_id: tenantId,
          file_path: filePath,
          file_name: file.name,
          mime_type: file.type,
          size: file.size,
          uploaded_by: user?.id,
          note: uploadNote || null,
          is_active: true,
        } as any);

      if (dbError) throw dbError;

      toast.success(isReplace ? "تم استبدال العقد بنجاح" : "تم رفع عقد التأمينات بنجاح");
      setUploadNote("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["hr-contract-files", selectedEmployee.id] });
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء الرفع");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (f: any) => {
    const { data } = await supabase.storage.from("hr-contracts").createSignedUrl(f.file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("تعذر تحميل الملف");
  };

  const openEmployeeDrawer = (emp: any) => {
    setSelectedEmployee(emp);
    setDrawerOpen(true);
    setUploadNote("");
  };

  const currentContract = (emp: any) => {
    const contracts = emp.hr_contracts ?? [];
    return contracts.find((c: any) => c.is_current) ?? contracts[0] ?? null;
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">عقود التأمينات الاجتماعية</h1>
            <p className="text-xs text-muted-foreground">GOSI Social Insurance Contracts</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-3 sm:p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              العقود تُدار عبر التأمينات الاجتماعية (GOSI)
            </p>
            <p className="text-xs text-muted-foreground">
              هنا نحتفظ بنسخة لأغراض التوثيق الداخلي فقط. لا يتم إنشاء أو تعديل العقود من النظام.
            </p>
            <p className="text-xs text-muted-foreground/70" dir="ltr">
              Contracts are managed through GOSI. This section is for internal documentation only.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث بالاسم أو الرقم الوظيفي... | Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {/* Employees Table */}
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold">
                  الرقم الوظيفي<br /><span className="text-muted-foreground/60 font-normal">Employee ID</span>
                </TableHead>
                <TableHead className="text-xs font-semibold">
                  الموظف<br /><span className="text-muted-foreground/60 font-normal">Employee</span>
                </TableHead>
                <TableHead className="text-xs font-semibold">
                  نوع العقد<br /><span className="text-muted-foreground/60 font-normal">Contract Type</span>
                </TableHead>
                <TableHead className="text-xs font-semibold">
                  تاريخ البدء<br /><span className="text-muted-foreground/60 font-normal">Start Date</span>
                </TableHead>
                <TableHead className="text-xs font-semibold">
                  تاريخ الانتهاء<br /><span className="text-muted-foreground/60 font-normal">End Date</span>
                </TableHead>
                <TableHead className="text-xs font-semibold">
                  وثيقة GOSI<br /><span className="text-muted-foreground/60 font-normal">GOSI Doc</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">جاري التحميل...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <SmartEmptyState
                      icon={FileText}
                      title="لا يوجد موظفون"
                      description="أضف موظفين أولاً لتتمكن من إدارة عقود التأمينات الاجتماعية"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((emp: any) => {
                  const c = currentContract(emp);
                  return (
                    <TableRow
                      key={emp.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => openEmployeeDrawer(emp)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">{emp.employee_number}</TableCell>
                      <TableCell className="font-medium text-foreground">{emp.first_name} {emp.last_name}</TableCell>
                      <TableCell className="text-sm">
                        {c ? (CONTRACT_TYPES[c.contract_type]?.ar ?? c.contract_type) : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" dir="ltr">
                        {c?.start_date ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" dir="ltr">
                        {c?.end_date ?? <span className="text-muted-foreground/50">غير محدد</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          عرض التفاصيل
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Employee Contract Drawer */}
      <Sheet open={drawerOpen} onOpenChange={(o) => { if (!o) { setDrawerOpen(false); setSelectedEmployee(null); } }}>
        <SheetContent side="left" className="w-full sm:w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              عقد التأمينات — {selectedEmployee?.first_name} {selectedEmployee?.last_name}
            </SheetTitle>
            <SheetDescription>GOSI Contract — {selectedEmployee?.employee_number}</SheetDescription>
          </SheetHeader>

          {selectedEmployee && (
            <Tabs defaultValue="info" className="mt-6">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1 gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  بيانات العقد
                </TabsTrigger>
                <TabsTrigger value="files" className="flex-1 gap-1.5 text-xs">
                  <Upload className="h-3.5 w-3.5" />
                  المرفقات
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 gap-1.5 text-xs">
                  <History className="h-3.5 w-3.5" />
                  السجل
                </TabsTrigger>
              </TabsList>

              {/* Tab: Contract Info (Read-Only) */}
              <TabsContent value="info" className="space-y-4 mt-4">
                {(() => {
                  const c = currentContract(selectedEmployee);
                  if (!c) {
                    return (
                      <div className="rounded-xl border border-border bg-muted/30 p-6 text-center space-y-2">
                        <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                        <p className="text-sm font-medium text-foreground">لا يوجد عقد مسجّل</p>
                        <p className="text-xs text-muted-foreground">No contract recorded for this employee</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      <ReadOnlyField label="نوع العقد" labelEn="Contract Type" value={CONTRACT_TYPES[c.contract_type]?.ar ?? c.contract_type} />
                      <ReadOnlyField label="تاريخ البداية" labelEn="Start Date" value={c.start_date} dir="ltr" />
                      <ReadOnlyField label="تاريخ النهاية" labelEn="End Date" value={c.end_date ?? "غير محدد (عقد مفتوح)"} dir="ltr" />
                      <ReadOnlyField label="المسمى الوظيفي" labelEn="Position" value={selectedEmployee.org_departments?.name ?? "—"} />
                      <ReadOnlyField label="رقم العقد" labelEn="Contract No." value={c.contract_number} />
                    </div>
                  );
                })()}
              </TabsContent>

              {/* Tab: Files (Upload / Replace) */}
              <TabsContent value="files" className="space-y-4 mt-4">
                {/* Current active file */}
                {activeFile ? (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        العقد الحالي | Current Contract
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{activeFile.file_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            رُفع في {new Date(activeFile.uploaded_at).toLocaleDateString("ar-SA")} •{" "}
                            {(activeFile.size / 1024).toFixed(0)} KB
                          </p>
                          {activeFile.note && (
                            <p className="text-xs text-muted-foreground mt-1">📝 {activeFile.note}</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownload(activeFile)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownload(activeFile)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center space-y-2">
                    <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-sm font-medium text-foreground">لم يتم رفع عقد التأمينات بعد</p>
                    <p className="text-xs text-muted-foreground">
                      No GOSI contract uploaded yet
                    </p>
                  </div>
                )}

                {/* Upload / Replace Section */}
                <Card className="border-border/50">
                  <CardContent className="p-4 space-y-3">
                    <Label className="text-xs font-semibold">
                      {activeFile ? "استبدال العقد الحالي" : "رفع عقد التأمينات"}
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      {activeFile
                        ? "سيتم نقل العقد الحالي للسجل تلقائياً | Current contract will be moved to history"
                        : "PDF أو صورة (PNG, JPG) — حد أقصى 10MB"
                      }
                    </p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      className="block w-full text-sm text-muted-foreground file:me-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                    />
                    <Textarea
                      placeholder="ملاحظة (اختياري) — مثلاً: تجديد سنوي 2025"
                      value={uploadNote}
                      onChange={(e) => setUploadNote(e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                    <Button
                      onClick={() => handleUpload(!!activeFile)}
                      disabled={uploading}
                      className="w-full gap-2"
                      variant={activeFile ? "outline" : "default"}
                    >
                      {uploading ? (
                        <>
                          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          جاري الرفع...
                        </>
                      ) : activeFile ? (
                        <>
                          <Replace className="h-4 w-4" />
                          استبدال العقد
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          رفع عقد التأمينات
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: History */}
              <TabsContent value="history" className="space-y-3 mt-4">
                {filesLoading ? (
                  <div className="text-center py-8">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : historyFiles.length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-6 text-center space-y-2">
                    <History className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-sm font-medium text-foreground">لا يوجد سجل سابق</p>
                    <p className="text-xs text-muted-foreground">
                      No previous versions found
                    </p>
                  </div>
                ) : (
                  historyFiles.map((f: any) => (
                    <Card key={f.id} className="border-border/40">
                      <CardContent className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{f.file_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(f.uploaded_at).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}
                            {" • "}{(f.size / 1024).toFixed(0)} KB
                          </p>
                          {f.note && <p className="text-xs text-muted-foreground/80 mt-0.5">📝 {f.note}</p>}
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => handleDownload(f)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* Read-Only Field Component */
function ReadOnlyField({ label, labelEn, value, dir }: { label: string; labelEn: string; value: string; dir?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
      <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1">
        {label} <span className="text-muted-foreground/40">/ {labelEn}</span>
      </p>
      <p className="text-sm font-medium text-foreground" dir={dir}>{value}</p>
    </div>
  );
}
