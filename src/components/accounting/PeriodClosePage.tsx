import { useEffect, useState, useCallback } from "react";
import {
  Lock, Unlock, Loader2, CalendarClock, AlertTriangle, CheckCircle2, Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { secureRpc } from "@/lib/secure-rpc";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";

interface Period {
  id: string;
  tenant_id: string;
  legal_entity_id: string | null;
  period_year: number;
  period_month: number;
  status: "open" | "closed";
  closed_at: string | null;
  closed_by: string | null;
}

interface LegalEntity {
  id: string;
  name: string;
  name_en: string | null;
}

const MONTH_NAMES_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const MONTH_NAMES_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const premiumFade = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

const PeriodClosePage = () => {
  const { tenantId, user, userRole } = useAuth();
  const { currentLang } = useLanguage();
  const isRTL = currentLang === "ar";
  const isOwner = userRole === "owner";

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [entityId, setEntityId] = useState<string>("__all__");
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ month: number; action: "close" | "reopen" } | null>(null);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const [entRes, perRes] = await Promise.all([
      supabase.from("legal_entities").select("id, name, name_en").eq("tenant_id", tenantId),
      supabase.from("accounting_periods").select("*").eq("tenant_id", tenantId).eq("period_year", selectedYear),
    ]);
    setEntities((entRes.data as LegalEntity[]) || []);
    setPeriods((perRes.data as unknown as Period[]) || []);
    setLoading(false);
  }, [tenantId, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getMonthStatus = (month: number): Period | undefined => {
    const eid = entityId === "__all__" ? null : entityId;
    return periods.find(p =>
      p.period_month === month &&
      (eid === null ? p.legal_entity_id === null : p.legal_entity_id === eid)
    );
  };

  const handleAction = async () => {
    if (!confirmDialog || !tenantId || !user) return;
    const { month, action } = confirmDialog;
    setActionLoading(`${action}-${month}`);
    const fn = action === "close" ? "close_accounting_period" : "reopen_accounting_period";
    const { data, error } = await secureRpc(fn, {
      p_tenant_id: tenantId,
      p_legal_entity_id: entityId === "__all__" ? null : entityId,
      p_year: selectedYear,
      p_month: month,
      p_user_id: user.id,
    });
    setActionLoading(null);
    setConfirmDialog(null);
    if (error) { toast.error(error.message); return; }
    if (data && !(data as any).success) { toast.error((data as any).error || "Error"); return; }
    toast.success(isRTL
      ? (action === "close" ? "تم إغلاق الفترة" : "تم إعادة فتح الفترة")
      : (action === "close" ? "Period closed" : "Period reopened"));
    fetchData();
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <motion.div {...premiumFade} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10">
              <CalendarClock className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {isRTL ? "إغلاق الفترات المحاسبية" : "Accounting Period Close"}
                </h1>
                <Badge className="border-accent/25 text-accent text-[10px] px-1.5 py-0 font-bold">
                  Enterprise
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isRTL ? "إغلاق وإعادة فتح الفترات المحاسبية الشهرية" : "Close and reopen monthly accounting periods"}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={premiumFade} initial="initial" animate="animate" transition={{ delay: 0.1 }}>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">{isRTL ? "السنة" : "Year"}</span>
                <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                  <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {entities.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">{isRTL ? "الكيان القانوني" : "Legal Entity"}</span>
                  <Select value={entityId} onValueChange={setEntityId}>
                    <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{isRTL ? "بدون كيان" : "No Entity"}</SelectItem>
                      {entities.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          <span className="flex items-center gap-1.5">
                            <Building2 size={12} />
                            {isRTL ? e.name : e.name_en || e.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Table */}
      <motion.div variants={premiumFade} initial="initial" animate="animate" transition={{ delay: 0.2 }}>
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "الشهر" : "Month"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isRTL ? "تاريخ الإغلاق" : "Closed At"}</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map(month => {
                  const period = getMonthStatus(month);
                  const isClosed = period?.status === "closed";
                  const monthName = isRTL ? MONTH_NAMES_AR[month - 1] : MONTH_NAMES_EN[month - 1];
                  return (
                    <TableRow key={month} className="group">
                      <TableCell className="font-medium">{monthName} {selectedYear}</TableCell>
                      <TableCell>
                        {isClosed ? (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] gap-1">
                            <Lock size={10} /> {isRTL ? "مغلقة" : "Closed"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-600 text-[10px] gap-1">
                            <Unlock size={10} /> {isRTL ? "مفتوحة" : "Open"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {period?.closed_at ? new Date(period.closed_at).toLocaleDateString(isRTL ? "ar-SA" : "en-US") : "—"}
                      </TableCell>
                      <TableCell>
                        {isClosed ? (
                          isOwner && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs"
                              disabled={actionLoading === `reopen-${month}`}
                              onClick={() => setConfirmDialog({ month, action: "reopen" })}
                            >
                              {actionLoading === `reopen-${month}` ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />}
                              {isRTL ? "إعادة فتح" : "Reopen"}
                            </Button>
                          )
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1 text-xs"
                            disabled={actionLoading === `close-${month}`}
                            onClick={() => setConfirmDialog({ month, action: "close" })}
                          >
                            {actionLoading === `close-${month}` ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                            {isRTL ? "إغلاق" : "Close"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </motion.div>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={o => { if (!o) setConfirmDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {confirmDialog?.action === "close"
                ? (isRTL ? "تأكيد إغلاق الفترة" : "Confirm Period Close")
                : (isRTL ? "تأكيد إعادة الفتح" : "Confirm Period Reopen")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmDialog?.action === "close"
              ? (isRTL
                ? `سيتم منع ترحيل أي قيد يومية بتاريخ ${MONTH_NAMES_AR[(confirmDialog?.month || 1) - 1]} ${selectedYear}. هل تريد المتابعة؟`
                : `Posting journal entries dated ${MONTH_NAMES_EN[(confirmDialog?.month || 1) - 1]} ${selectedYear} will be blocked. Continue?`)
              : (isRTL
                ? `سيتم إعادة فتح الفترة والسماح بترحيل القيود. هل تريد المتابعة؟`
                : `The period will be reopened, allowing journal posting. Continue?`)}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant={confirmDialog?.action === "close" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={!!actionLoading}
            >
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : (
                confirmDialog?.action === "close"
                  ? (isRTL ? "إغلاق الفترة" : "Close Period")
                  : (isRTL ? "إعادة الفتح" : "Reopen Period")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PeriodClosePage;
