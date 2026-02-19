import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { secureRpc } from "@/lib/secure-rpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Wallet, Clock, CheckCircle2, XCircle, Search, Loader2,
  Eye, FileText, Building2, ExternalLink, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface TopupRequest {
  id: string;
  tenant_id: string;
  wallet_id: string;
  amount: number;
  payment_method: string;
  bank_reference: string | null;
  receipt_url: string | null;
  receipt_filename: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_by: string;
  created_at: string;
  tenant_name?: string;
  user_email?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "قيد المراجعة", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: Clock },
  approved: { label: "تمت الموافقة", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "bg-red-500/10 text-red-500 border-red-500/20", icon: XCircle },
};

const AdminWalletRequests = () => {
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; requestId: string | null }>({ open: false, requestId: null });
  const [rejectionReason, setRejectionReason] = useState("");
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    let query = supabase
      .from("wallet_topup_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("فشل تحميل الطلبات");
      setLoading(false);
      return;
    }

    // Enrich with tenant names and user emails
    const enriched: TopupRequest[] = [];
    const tenantIds = [...new Set((data || []).map(r => r.tenant_id))];
    const userIds = [...new Set((data || []).map(r => r.created_by))];

    const [{ data: tenants }, { data: profiles }] = await Promise.all([
      supabase.from("tenants").select("id, name").in("id", tenantIds),
      supabase.from("profiles").select("id, email").in("id", userIds),
    ]);

    const tenantMap = Object.fromEntries((tenants || []).map(t => [t.id, t.name]));
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.email]));

    for (const r of (data || [])) {
      enriched.push({
        ...r,
        tenant_name: tenantMap[r.tenant_id] || "غير معروف",
        user_email: profileMap[r.created_by] || "—",
      });
    }

    setRequests(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("admin-topup-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_topup_requests" }, () => {
        fetchRequests();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [filter]);

  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const { data, error } = await secureRpc("admin_review_topup_request", {
        p_request_id: requestId,
        p_action: "approve",
      });
      if (error) throw error;
      toast.success("تمت الموافقة على الطلب وإضافة الرصيد");
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || "فشل في الموافقة على الطلب");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.requestId) return;
    setActionLoading(rejectDialog.requestId);
    try {
      const { error } = await secureRpc("admin_review_topup_request", {
        p_request_id: rejectDialog.requestId,
        p_action: "reject",
        p_rejection_reason: rejectionReason || null,
      });
      if (error) throw error;
      toast.success("تم رفض الطلب");
      setRejectDialog({ open: false, requestId: null });
      setRejectionReason("");
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || "فشل في رفض الطلب");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = requests.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.tenant_name?.toLowerCase().includes(s) ||
      r.user_email?.toLowerCase().includes(s) ||
      r.bank_reference?.toLowerCase().includes(s) ||
      r.amount.toString().includes(s)
    );
  });

  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-6 h-6 text-accent" />
            إدارة طلبات شحن المحفظة
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            مراجعة طلبات الشحن عبر التحويل البنكي والموافقة أو الرفض
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">
            <AlertTriangle className="w-4 h-4 ml-1" />
            {pendingCount} طلب معلق
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالمنشأة أو البريد أو المرجع..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "pending", "approved", "rejected"] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "الكل" : STATUS_CONFIG[f]?.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Wallet className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">لا توجد طلبات {filter !== "all" ? STATUS_CONFIG[filter]?.label : ""}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const st = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const StIcon = st.icon;
            const isLoading = actionLoading === req.id;
            return (
              <Card key={req.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                    {/* Right: Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className={st.color}>
                          <StIcon className="w-3.5 h-3.5 ml-1" />
                          {st.label}
                        </Badge>
                        <span className="text-xl font-bold text-foreground">
                          {req.amount.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">ر.س</span>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {req.tenant_name}
                        </span>
                        <span>{req.user_email}</span>
                        <span>{format(new Date(req.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}</span>
                      </div>
                      {req.bank_reference && (
                        <p className="text-xs text-muted-foreground">
                          مرجع بنكي: <span className="font-mono text-foreground">{req.bank_reference}</span>
                        </p>
                      )}
                      {req.rejection_reason && (
                        <p className="text-xs text-red-500">
                          سبب الرفض: {req.rejection_reason}
                        </p>
                      )}
                    </div>

                    {/* Left: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {req.receipt_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceiptPreview(req.receipt_url)}
                        >
                          <Eye className="w-4 h-4 ml-1" />
                          الإيصال
                        </Button>
                      )}
                      {req.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={isLoading}
                            onClick={() => handleApprove(req.id)}
                          >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
                            موافقة
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isLoading}
                            onClick={() => setRejectDialog({ open: true, requestId: req.id })}
                          >
                            <XCircle className="w-4 h-4 ml-1" />
                            رفض
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={o => { if (!o) setRejectDialog({ open: false, requestId: null }); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>رفض طلب الشحن</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Textarea
              placeholder="سبب الرفض (اختياري)..."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, requestId: null })}>إلغاء</Button>
            <Button
              variant="destructive"
              disabled={!!actionLoading}
              onClick={handleReject}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
              تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Preview Dialog */}
      <Dialog open={!!receiptPreview} onOpenChange={o => { if (!o) setReceiptPreview(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>إيصال التحويل</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[300px]">
            {receiptPreview && (
              <img
                src={receiptPreview}
                alt="إيصال التحويل"
                className="max-w-full max-h-[500px] rounded-lg object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            {receiptPreview && (
              <a
                href={receiptPreview}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-4 left-4"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 ml-1" />
                  فتح
                </Button>
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWalletRequests;
