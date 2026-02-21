import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2, XCircle, Clock, Loader2, BookOpen, FileText,
  MessageSquare, User, Calendar, DollarSign, Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { secureRpc } from "@/lib/secure-rpc";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";
import { format } from "date-fns";

interface PendingEntry {
  id: string;
  tenant_id: string;
  entry_number: string;
  entry_date: string;
  description: string | null;
  total_debit: number;
  total_credit: number;
  currency: string;
  created_by: string;
  created_at: string;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  approval_reason: string | null;
}

const fmtNum = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const premiumFade = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

const JournalApprovalsPage = () => {
  const { tenantId, user } = useAuth();
  const { currentLang } = useLanguage();
  const isRTL = currentLang === "ar";

  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");

  // Action dialog
  const [actionEntry, setActionEntry] = useState<PendingEntry | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from("journal_entries")
      .select("id, tenant_id, entry_number, entry_date, description, total_debit, total_credit, currency, created_by, created_at, approval_status, approved_by, approved_at, approval_reason")
      .eq("tenant_id", tenantId)
      .eq("requires_approval", true)
      .order("created_at", { ascending: false });
    setEntries((data as unknown as PendingEntry[]) || []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const filtered = entries.filter(e => {
    if (tab === "pending") return e.approval_status === "pending";
    return e.approval_status === "approved" || e.approval_status === "rejected";
  });

  const pendingCount = entries.filter(e => e.approval_status === "pending").length;

  const openAction = (entry: PendingEntry, type: "approve" | "reject") => {
    setActionEntry(entry);
    setActionType(type);
    setReason("");
  };

  const handleAction = async () => {
    if (!actionEntry || !user) return;
    setSubmitting(true);
    const fn = actionType === "approve" ? "approve_journal_entry" : "reject_journal_entry";
    const paramKey = actionType === "approve" ? "p_approver_id" : "p_rejector_id";
    const { data, error } = await secureRpc(fn, {
      p_entry_id: actionEntry.id,
      [paramKey]: user.id,
      p_reason: reason.trim() || null,
    });
    setSubmitting(false);

    if (error) { toast.error(error.message); return; }
    const result = data as { success: boolean; message: string };
    if (!result?.success) { toast.error(result?.message || "Error"); return; }

    toast.success(result.message);
    setActionEntry(null);
    fetchEntries();
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 gap-1"><Clock size={10} />{isRTL ? "بانتظار الموافقة" : "Pending"}</Badge>;
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] gap-1"><CheckCircle2 size={10} />{isRTL ? "معتمد" : "Approved"}</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="text-[10px] gap-1"><XCircle size={10} />{isRTL ? "مرفوض" : "Rejected"}</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <motion.div {...premiumFade} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10">
              <Shield className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {isRTL ? "موافقات القيود اليومية" : "Journal Approvals"}
                </h1>
                <Badge className="border-accent/25 text-accent text-[10px] px-1.5 py-0 font-bold">Enterprise</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isRTL ? "مراجعة واعتماد أو رفض القيود التي تتجاوز الحد المالي" : "Review and approve/reject journal entries above the threshold"}
              </p>
            </div>
          </div>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1 gap-1.5">
              <Clock size={14} />
              {pendingCount} {isRTL ? "بانتظار المراجعة" : "pending"}
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={premiumFade} initial="initial" animate="animate" transition={{ delay: 0.1 }}>
        <Tabs value={tab} onValueChange={v => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5 text-xs">
              <Clock size={14} />
              {isRTL ? "معلقة" : "Pending"}
              {pendingCount > 0 && <Badge variant="secondary" className="text-[10px] px-1">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="reviewed" className="gap-1.5 text-xs">
              <CheckCircle2 size={14} />
              {isRTL ? "تمت المراجعة" : "Reviewed"}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </motion.div>

      {/* Table */}
      <motion.div variants={premiumFade} initial="initial" animate="animate" transition={{ delay: 0.2 }}>
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <BookOpen className="mx-auto h-10 w-10 mb-2 opacity-40" />
              <p>{tab === "pending"
                ? (isRTL ? "لا توجد قيود معلقة للمراجعة" : "No pending entries for review")
                : (isRTL ? "لا توجد قيود تمت مراجعتها" : "No reviewed entries")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "رقم القيد" : "Entry #"}</TableHead>
                  <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{isRTL ? "البيان" : "Description"}</TableHead>
                  <TableHead className="text-end">{isRTL ? "المبلغ" : "Amount"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                  {tab === "reviewed" && <TableHead>{isRTL ? "السبب" : "Reason"}</TableHead>}
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e => (
                  <TableRow key={e.id} className="group">
                    <TableCell className="font-mono text-sm font-medium">{e.entry_number}</TableCell>
                    <TableCell className="text-sm">{format(new Date(e.entry_date), "yyyy-MM-dd")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{e.description || "—"}</TableCell>
                    <TableCell className="text-sm font-semibold text-end tabular-nums">
                      {fmtNum(e.total_debit)} {e.currency}
                    </TableCell>
                    <TableCell>{statusBadge(e.approval_status)}</TableCell>
                    {tab === "reviewed" && (
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                        {e.approval_reason || "—"}
                      </TableCell>
                    )}
                    <TableCell>
                      {e.approval_status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50" onClick={() => openAction(e, "approve")}>
                            <CheckCircle2 size={12} /> {isRTL ? "اعتماد" : "Approve"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => openAction(e, "reject")}>
                            <XCircle size={12} /> {isRTL ? "رفض" : "Reject"}
                          </Button>
                        </div>
                      )}
                      {e.approval_status !== "pending" && e.approved_at && (
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(e.approved_at), "yyyy-MM-dd HH:mm")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </motion.div>

      {/* Approve/Reject Dialog */}
      <Dialog open={!!actionEntry} onOpenChange={o => { if (!o) setActionEntry(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === "approve" ? (
                <><CheckCircle2 size={18} className="text-emerald-600" /> {isRTL ? "اعتماد القيد" : "Approve Entry"}</>
              ) : (
                <><XCircle size={18} className="text-destructive" /> {isRTL ? "رفض القيد" : "Reject Entry"}</>
              )}
            </DialogTitle>
          </DialogHeader>
          {actionEntry && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{isRTL ? "رقم القيد" : "Entry #"}</span>
                  <span className="font-mono font-medium">{actionEntry.entry_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{isRTL ? "المبلغ" : "Amount"}</span>
                  <span className="font-semibold">{fmtNum(actionEntry.total_debit)} {actionEntry.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{isRTL ? "التاريخ" : "Date"}</span>
                  <span>{format(new Date(actionEntry.entry_date), "yyyy-MM-dd")}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{isRTL ? "السبب (اختياري)" : "Reason (optional)"}</Label>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={actionType === "reject" ? (isRTL ? "سبب الرفض..." : "Rejection reason...") : (isRTL ? "ملاحظات..." : "Notes...")}
                  rows={3}
                  className="text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionEntry(null)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
            <Button
              onClick={handleAction}
              disabled={submitting}
              className={actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              variant={actionType === "reject" ? "destructive" : "default"}
            >
              {submitting && <Loader2 size={14} className="animate-spin me-1.5" />}
              {actionType === "approve" ? (isRTL ? "اعتماد" : "Approve") : (isRTL ? "رفض" : "Reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JournalApprovalsPage;
