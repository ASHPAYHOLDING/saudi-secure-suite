import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import CertifiedApprovalStamp from "@/components/paylink/CertifiedApprovalStamp";
import {
  Shield, ShieldCheck, CheckCircle2, XCircle, Clock, Loader2, Eye,
  FileText, Download, Search, AlertTriangle, Building2, User
} from "lucide-react";
import { motion } from "framer-motion";

interface KycRequest {
  id: string;
  tenant_id: string;
  applicant_type: string;
  business_name: string;
  business_name_en: string | null;
  cr_number: string | null;
  vat_number: string | null;
  national_id: string | null;
  phone: string;
  email: string;
  iban: string;
  bank_name: string | null;
  subscriber_full_name: string;
  subscriber_signed_at: string | null;
  subscriber_signature_data: string | null;
  admin_signature_data: string | null;
  admin_signed_at: string | null;
  admin_full_name: string | null;
  status: string;
  rejection_reason: string | null;
  admin_notes: string | null;
  contract_number: string;
  agreement_html: string;
  created_at: string;
  reviewed_at: string | null;
}

interface KycDocument {
  id: string;
  document_type: string;
  document_name: string;
  file_url: string;
}

const AdminKycReview = () => {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<KycRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Review dialog
  const [reviewRequest, setReviewRequest] = useState<KycRequest | null>(null);
  const [reviewDocs, setReviewDocs] = useState<KycDocument[]>([]);
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminSignature] = useState<string>("certified-digital-stamp");
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("paylink_kyc_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setRequests((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openReview = async (req: KycRequest) => {
    setReviewRequest(req);
    setAdminNotes(req.admin_notes || "");
    setRejectionReason(req.rejection_reason || "");
    // stamp is auto-generated, no manual signature needed

    const { data: docs } = await supabase
      .from("paylink_kyc_documents")
      .select("*")
      .eq("kyc_request_id", req.id);
    setReviewDocs((docs as any[]) || []);
  };

  const handleApprove = async () => {
    if (!reviewRequest || !user) {
      toast.error("خطأ في البيانات");
      return;
    }

    setIsProcessing(true);
    const { error } = await supabase
      .from("paylink_kyc_requests")
      .update({
        status: "approved",
        admin_notes: adminNotes,
        admin_signature_data: "certified-digital-stamp",
        admin_signed_at: new Date().toISOString(),
        admin_user_id: user.id,
        admin_full_name: "نيوماكسيو",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      } as any)
      .eq("id", reviewRequest.id);

    setIsProcessing(false);
    if (error) {
      toast.error("حدث خطأ أثناء الاعتماد");
    } else {
      toast.success("✅ تم اعتماد الطلب وتفعيل بوابة الدفع");
      setReviewRequest(null);
      fetchRequests();
    }
  };

  const handleReject = async () => {
    if (!reviewRequest || !user) return;
    if (!rejectionReason.trim()) {
      toast.error("يرجى إدخال سبب الرفض");
      return;
    }

    setIsProcessing(true);
    const { error } = await supabase
      .from("paylink_kyc_requests")
      .update({
        status: "rejected",
        rejection_reason: rejectionReason,
        admin_notes: adminNotes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      } as any)
      .eq("id", reviewRequest.id);

    setIsProcessing(false);
    if (error) {
      toast.error("حدث خطأ");
    } else {
      toast.success("تم رفض الطلب");
      setReviewRequest(null);
      fetchRequests();
    }
  };

  const handleRequestUpdate = async () => {
    if (!reviewRequest || !user) return;
    if (!adminNotes.trim()) {
      toast.error("يرجى إدخال ملاحظات التعديل المطلوب");
      return;
    }

    setIsProcessing(true);
    const { error } = await supabase
      .from("paylink_kyc_requests")
      .update({
        status: "requires_update",
        admin_notes: adminNotes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      } as any)
      .eq("id", reviewRequest.id);

    setIsProcessing(false);
    if (error) {
      toast.error("حدث خطأ");
    } else {
      toast.success("تم طلب تعديل من المشترك");
      setReviewRequest(null);
      fetchRequests();
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string; icon: any }> = {
      pending: { label: "في الانتظار", className: "bg-warning/10 text-warning border-warning/20", icon: Clock },
      under_review: { label: "قيد المراجعة", className: "bg-info/10 text-info border-info/20", icon: Eye },
      approved: { label: "معتمد", className: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
      rejected: { label: "مرفوض", className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
      requires_update: { label: "يحتاج تعديل", className: "bg-warning/10 text-warning border-warning/20", icon: AlertTriangle },
    };
    const s = map[status] || map.pending;
    const Icon = s.icon;
    return <Badge className={`text-xs ${s.className}`}><Icon className="w-3 h-3 ml-1" />{s.label}</Badge>;
  };

  const typeLabel = (type: string) => type === "company" ? "شركة/مؤسسة" : type === "freelancer" ? "مستقل" : "فرد";
  const docTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      cr_certificate: "سجل تجاري", vat_certificate: "شهادة ضريبية", national_id: "هوية وطنية",
      bank_letter: "خطاب بنكي", freelancer_certificate: "وثيقة عمل حر", authorization_letter: "خطاب تفويض", other: "أخرى"
    };
    return map[type] || type;
  };

  const filtered = requests.filter(r => {
    const matchSearch = !search || r.business_name.includes(search) || r.contract_number.includes(search);
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const pendingCount = requests.filter(r => r.status === "pending").length;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "إجمالي الطلبات", value: requests.length, color: "text-foreground" },
          { label: "في الانتظار", value: pendingCount, color: "text-warning" },
          { label: "معتمد", value: requests.filter(r => r.status === "approved").length, color: "text-success" },
          { label: "مرفوض", value: requests.filter(r => r.status === "rejected").length, color: "text-destructive" },
          { label: "يحتاج تعديل", value: requests.filter(r => r.status === "requires_update").length, color: "text-info" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold ${s.color} font-[IBM_Plex_Sans_Arabic]`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex bg-muted rounded-lg p-0.5">
          {[
            { key: "all", label: "الكل" },
            { key: "pending", label: "في الانتظار" },
            { key: "approved", label: "معتمد" },
            { key: "rejected", label: "مرفوض" },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filterStatus === f.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>{f.label}</button>
          ))}
        </div>
        <div className="relative w-56">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} className="pe-9" />
        </div>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="pt-4">
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right font-semibold">رقم العقد</TableHead>
                  <TableHead className="text-right font-semibold">الاسم التجاري</TableHead>
                  <TableHead className="text-right font-semibold">النوع</TableHead>
                  <TableHead className="text-right font-semibold">الموقّع</TableHead>
                  <TableHead className="text-right font-semibold">التاريخ</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.contract_number}</TableCell>
                    <TableCell className="font-semibold text-sm">{r.business_name}</TableCell>
                    <TableCell className="text-sm">{typeLabel(r.applicant_type)}</TableCell>
                    <TableCell className="text-sm">{r.subscriber_full_name}</TableCell>
                    <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString("ar-SA")}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openReview(r)} className="gap-1 text-xs">
                        <Eye className="w-3.5 h-3.5" /> مراجعة
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>لا توجد طلبات</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!reviewRequest} onOpenChange={open => !open && setReviewRequest(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" /> مراجعة طلب التحقق
            </DialogTitle>
            <DialogDescription>
              رقم العقد: {reviewRequest?.contract_number}
              {reviewRequest && <span className="mr-3">{statusBadge(reviewRequest.status)}</span>}
            </DialogDescription>
          </DialogHeader>

          {reviewRequest && (
            <div className="space-y-5">
              {/* Business info */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-accent" /> بيانات المنشأة
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 rounded-lg p-4">
                  <div><span className="text-muted-foreground">النوع:</span> <span className="font-semibold mr-1">{typeLabel(reviewRequest.applicant_type)}</span></div>
                  <div><span className="text-muted-foreground">الاسم:</span> <span className="font-semibold mr-1">{reviewRequest.business_name}</span></div>
                  {reviewRequest.business_name_en && <div><span className="text-muted-foreground">الاسم (EN):</span> <span className="font-semibold mr-1">{reviewRequest.business_name_en}</span></div>}
                  {reviewRequest.cr_number && <div><span className="text-muted-foreground">سجل تجاري:</span> <span className="font-mono font-semibold mr-1">{reviewRequest.cr_number}</span></div>}
                  {reviewRequest.vat_number && <div><span className="text-muted-foreground">رقم ضريبي:</span> <span className="font-mono font-semibold mr-1">{reviewRequest.vat_number}</span></div>}
                  {reviewRequest.national_id && <div><span className="text-muted-foreground">هوية:</span> <span className="font-mono font-semibold mr-1">{reviewRequest.national_id}</span></div>}
                  <div><span className="text-muted-foreground">جوال:</span> <span className="font-mono font-semibold mr-1">{reviewRequest.phone}</span></div>
                  <div><span className="text-muted-foreground">بريد:</span> <span className="font-semibold mr-1">{reviewRequest.email}</span></div>
                  <div><span className="text-muted-foreground">آيبان:</span> <span className="font-mono font-semibold mr-1">{reviewRequest.iban}</span></div>
                  {reviewRequest.bank_name && <div><span className="text-muted-foreground">البنك:</span> <span className="font-semibold mr-1">{reviewRequest.bank_name}</span></div>}
                </div>
              </div>

              <Separator />

              {/* Documents */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent" /> المستندات المرفقة ({reviewDocs.length})
                </h4>
                {reviewDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لم يتم رفع مستندات</p>
                ) : (
                  <div className="space-y-2">
                    {reviewDocs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                        <FileText className="w-4 h-4 text-accent shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{docTypeLabel(doc.document_type)}</p>
                          <p className="text-xs text-muted-foreground">{doc.document_name}</p>
                        </div>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-1 text-xs">
                            <Download className="w-3.5 h-3.5" /> عرض
                          </Button>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Subscriber Signature */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-accent" /> توقيع المشترك
                </h4>
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <p className="text-sm"><span className="text-muted-foreground">الموقّع:</span> <span className="font-semibold mr-1">{reviewRequest.subscriber_full_name}</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">التاريخ:</span> <span className="font-semibold mr-1">{reviewRequest.subscriber_signed_at ? new Date(reviewRequest.subscriber_signed_at).toLocaleString("ar-SA") : "—"}</span></p>
                  {reviewRequest.subscriber_signature_data && (
                    <div className="border rounded-lg overflow-hidden bg-white inline-block">
                      <img src={reviewRequest.subscriber_signature_data} alt="توقيع المشترك" className="max-h-24" />
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Certified Stamp (if already approved) */}
              {reviewRequest.admin_signature_data && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-success" /> الختم الرقمي المعتمد
                  </h4>
                  <div className="bg-success/5 rounded-xl p-5 border border-success/20 relative overflow-hidden">
                    <div className="absolute top-2 left-2">
                      <Badge className="text-[9px] bg-success/10 text-success border-success/20 gap-1">
                        <ShieldCheck className="w-2.5 h-2.5" /> معتمد رسمياً
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm pt-4 mb-4">
                      <p><span className="text-muted-foreground">الجهة المعتمدة:</span> <span className="font-bold mr-1">{reviewRequest.admin_full_name || "نيوماكسيو"}</span></p>
                      <p><span className="text-muted-foreground">الصفة:</span> <span className="font-semibold mr-1 text-accent">مدير الامتثال المالي</span></p>
                      <p className="col-span-2"><span className="text-muted-foreground">تاريخ الاعتماد:</span> <span className="font-semibold mr-1 font-mono">{reviewRequest.admin_signed_at ? new Date(reviewRequest.admin_signed_at).toLocaleString("ar-SA") : "—"}</span></p>
                    </div>
                    <div className="flex justify-center">
                      <CertifiedApprovalStamp
                        approverName={reviewRequest.admin_full_name || "نيوماكسيو"}
                        approverTitle="مدير الامتثال المالي"
                        approvalDate={reviewRequest.admin_signed_at || undefined}
                        contractNumber={reviewRequest.contract_number}
                        size="lg"
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-3 text-center">ختم رقمي مشفّر ومعتمد وفقاً لنظام التعاملات الإلكترونية م/18</p>
                  </div>
                </div>
              )}

              <Separator />

              {/* Download Agreement */}
              <Button variant="outline" className="w-full gap-2" onClick={() => {
                if (!reviewRequest) return;
                const blob = new Blob([reviewRequest.agreement_html], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `contract-${reviewRequest.contract_number}.html`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="w-4 h-4" /> تحميل نسخة من العقد
              </Button>

              {/* Admin Actions (only for pending/under_review) */}
              {["pending", "under_review"].includes(reviewRequest.status) && (
                <div className="space-y-4 border-t border-border pt-4">
                  <h4 className="text-sm font-semibold text-foreground">إجراءات المراجعة</h4>

                  <div className="space-y-2">
                    <Label>ملاحظات الإدارة</Label>
                    <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="ملاحظات داخلية..." rows={2} />
                  </div>

                  <div className="space-y-2">
                    <Label>سبب الرفض (في حال الرفض)</Label>
                    <Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="سبب الرفض..." rows={2} />
                  </div>

                  {/* Certified Digital Stamp Preview */}
                  <div className="flex flex-col items-center py-4">
                    <p className="text-xs text-muted-foreground mb-3">سيتم اعتماد الطلب بالختم الرقمي التالي:</p>
                    <CertifiedApprovalStamp
                      approverName="نيوماكسيو"
                      approverTitle="مدير الامتثال المالي"
                      contractNumber={reviewRequest.contract_number}
                      size="md"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button onClick={handleApprove} disabled={isProcessing} className="gap-2 bg-success hover:bg-success/90 text-success-foreground flex-1">
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} اعتماد وتفعيل
                    </Button>
                    <Button onClick={handleRequestUpdate} disabled={isProcessing} variant="outline" className="gap-2 flex-1 text-warning border-warning/30">
                      <AlertTriangle className="w-4 h-4" /> طلب تعديل
                    </Button>
                    <Button onClick={handleReject} disabled={isProcessing} variant="destructive" className="gap-2 flex-1">
                      <XCircle className="w-4 h-4" /> رفض
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminKycReview;
