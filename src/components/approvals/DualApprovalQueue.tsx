import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { secureRpc } from "@/lib/secure-rpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/invoice-utils";
import {
  ShieldCheck, CheckCircle2, XCircle, Clock, Loader2,
  Banknote, Wallet, Receipt, MessageSquare, Users,
} from "lucide-react";
import { toast } from "sonner";

interface DualRequest {
  id: string;
  entity_type: string;
  entity_id: string;
  amount: number;
  currency: string;
  status: string;
  requested_by: string;
  requested_at: string;
  description: string | null;
  approvals: Array<{ acted_by: string; action: string; acted_at: string; comment: string | null }>;
}

const ENTITY_ICONS: Record<string, React.ElementType> = {
  payment: Banknote,
  wallet_transfer: Wallet,
  expense: Receipt,
};

const ENTITY_LABELS: Record<string, string> = {
  payment: "دفعة",
  wallet_transfer: "تحويل محفظة",
  expense: "مصروف",
};

const DualApprovalQueue = () => {
  const { tenantId, user } = useAuth();
  const [requests, setRequests] = useState<DualRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [showComment, setShowComment] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const { data: reqs } = await (supabase as any)
      .from("dual_approval_requests")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .order("requested_at", { ascending: false });

    if (!reqs || reqs.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    // Fetch actions for each request
    const enriched: DualRequest[] = [];
    for (const req of reqs) {
      const { data: actions } = await (supabase as any)
        .from("dual_approval_actions")
        .select("acted_by, action, acted_at, comment")
        .eq("request_id", req.id);

      enriched.push({ ...req, approvals: actions || [] });
    }

    setRequests(enriched);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleAction = async (requestId: string, action: "approved" | "rejected") => {
    setProcessing(requestId);
    const comment = commentMap[requestId] || undefined;

    const { data, error } = await secureRpc("submit_dual_approval", {
      p_request_id: requestId,
      p_action: action,
      p_comment: comment || null,
    });

    if (error) {
      toast.error(error.message);
    } else {
      const resultStatus = data as string;
      if (resultStatus === "approved") {
        toast.success("تمت الموافقة النهائية — العملية مكتملة");
      } else if (resultStatus === "rejected") {
        toast.info("تم رفض العملية");
      } else {
        toast.success("تم تسجيل موافقتك — بانتظار الموافقة الثانية");
      }
      fetchRequests();
    }
    setProcessing(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck size={18} className="text-primary" />
          طلبات الموافقة المزدوجة
          <Badge variant="secondary" className="text-[10px]">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((req, idx) => {
          const Icon = ENTITY_ICONS[req.entity_type] || Banknote;
          const alreadyActed = req.approvals.some(a => a.acted_by === user?.id);
          const isRequester = req.requested_by === user?.id;
          const approvalCount = req.approvals.filter(a => a.action === "approved").length;

          return (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-xl border border-border p-4 bg-card"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <Icon size={20} className="text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className="text-[10px]">{ENTITY_LABELS[req.entity_type] || req.entity_type}</Badge>
                      <span className="text-lg font-bold font-english text-foreground" dir="ltr">
                        {formatCurrency(req.amount)} <span className="text-xs font-normal text-muted-foreground">ر.س</span>
                      </span>
                    </div>
                    {req.description && (
                      <p className="text-xs text-muted-foreground">{req.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Users size={11} />
                        <span>{approvalCount}/2 موافقات</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(req.requested_at).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isRequester ? (
                    <Badge className="text-[10px] bg-muted text-muted-foreground">طلبك — بانتظار الآخرين</Badge>
                  ) : alreadyActed ? (
                    <Badge className="text-[10px] bg-accent/10 text-accent border-accent/20">تمت موافقتك</Badge>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowComment(showComment === req.id ? null : req.id)}
                        className="gap-1 text-muted-foreground h-8"
                      >
                        <MessageSquare size={13} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction(req.id, "rejected")}
                        disabled={processing === req.id}
                        className="gap-1 text-destructive hover:bg-destructive/10 border-destructive/30 h-8"
                      >
                        <XCircle size={13} />
                        رفض
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAction(req.id, "approved")}
                        disabled={processing === req.id}
                        className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                      >
                        {processing === req.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        موافقة
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {showComment === req.id && (
                <div className="mt-3 pt-3 border-t border-border">
                  <Input
                    value={commentMap[req.id] || ""}
                    onChange={(e) => setCommentMap(prev => ({ ...prev, [req.id]: e.target.value }))}
                    placeholder="تعليق (اختياري)..."
                    className="text-sm h-9"
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default DualApprovalQueue;
