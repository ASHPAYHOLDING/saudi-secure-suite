import { useState, useEffect, useCallback } from "react";
import {
  Lock, Unlock, Loader2, ShieldCheck, Calendar, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface PeriodLock {
  id: string;
  period_year: number;
  period_month: number;
  is_locked: boolean;
  locked_at: string;
  locked_by: string;
  unlocked_at: string | null;
  unlocked_by: string | null;
  lock_reason: string | null;
  unlock_reason: string | null;
}

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const PeriodLockManagement = () => {
  const { user, tenantId } = useAuth();
  const { isRTL } = useLanguage();

  const [locks, setLocks] = useState<PeriodLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Lock dialog
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [lockYear, setLockYear] = useState(() => new Date().getFullYear());
  const [lockMonth, setLockMonth] = useState(() => new Date().getMonth()); // prev month
  const [lockReason, setLockReason] = useState("");

  // Unlock dialog
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<PeriodLock | null>(null);
  const [unlockReason, setUnlockReason] = useState("");

  const fetchLocks = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("period_locks")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false });
    if (!error) setLocks((data as any[]) || []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchLocks(); }, [fetchLocks]);

  const handleLock = async () => {
    if (!tenantId || !user) return;
    setActionLoading(true);
    try {
      // Check if already exists
      const existing = locks.find(l => l.period_year === lockYear && l.period_month === lockMonth + 1);
      if (existing?.is_locked) {
        toast.error(isRTL ? "هذه الفترة مقفلة بالفعل" : "This period is already locked");
        setActionLoading(false);
        return;
      }

      if (existing) {
        // Re-lock
        const { error } = await supabase
          .from("period_locks")
          .update({
            is_locked: true,
            locked_at: new Date().toISOString(),
            locked_by: user.id,
            lock_reason: lockReason || "إقفال شهري",
            unlocked_at: null,
            unlocked_by: null,
            unlock_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("period_locks")
          .insert({
            tenant_id: tenantId,
            period_year: lockYear,
            period_month: lockMonth + 1,
            locked_by: user.id,
            lock_reason: lockReason || "إقفال شهري",
          });
        if (error) throw error;
      }

      // Log to audit
      await supabase.from("audit_logs").insert({
        tenant_id: tenantId,
        user_id: user.id,
        entity_type: "period_lock",
        action: "lock",
        entity_label: `${lockYear}/${lockMonth + 1}`,
        after_value: { year: lockYear, month: lockMonth + 1, reason: lockReason },
      });

      toast.success(isRTL ? `تم قفل فترة ${MONTHS_AR[lockMonth]} ${lockYear}` : `Locked ${MONTHS_EN[lockMonth]} ${lockYear}`);
      setShowLockDialog(false);
      setLockReason("");
      fetchLocks();
    } catch (err: any) {
      toast.error(err.message);
    }
    setActionLoading(false);
  };

  const handleUnlock = async () => {
    if (!unlockTarget || !user || !tenantId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("period_locks")
        .update({
          is_locked: false,
          unlocked_at: new Date().toISOString(),
          unlocked_by: user.id,
          unlock_reason: unlockReason || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", unlockTarget.id);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        tenant_id: tenantId,
        user_id: user.id,
        entity_type: "period_lock",
        action: "unlock",
        entity_label: `${unlockTarget.period_year}/${unlockTarget.period_month}`,
        before_value: { locked: true },
        after_value: { locked: false, reason: unlockReason },
      });

      toast.success(isRTL
        ? `تم فتح فترة ${MONTHS_AR[unlockTarget.period_month - 1]} ${unlockTarget.period_year}`
        : `Unlocked ${MONTHS_EN[unlockTarget.period_month - 1]} ${unlockTarget.period_year}`);
      setShowUnlockDialog(false);
      setUnlockReason("");
      setUnlockTarget(null);
      fetchLocks();
    } catch (err: any) {
      toast.error(err.message);
    }
    setActionLoading(false);
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  // Build 12-month grid for quick view
  const getStatusForMonth = (year: number, month: number) => {
    return locks.find(l => l.period_year === year && l.period_month === month);
  };

  return (
    <div dir="rtl" className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Lock className="text-primary" size={22} />
            {isRTL ? "قفل الفترات المحاسبية" : "Period Lock Management"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isRTL ? "قفل الأشهر لمنع تعديل القيود والفواتير والمصروفات" : "Lock months to prevent modifications to entries, invoices, and expenses"}
          </p>
        </div>
        <Button onClick={() => setShowLockDialog(true)} className="gap-1.5 text-xs">
          <Lock size={14} />
          {isRTL ? "قفل فترة" : "Lock Period"}
        </Button>
      </div>

      {/* Year Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[currentYear, currentYear - 1].map(year => (
          <Card key={year}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar size={16} className="text-primary" />
                {year}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {Array.from({ length: 12 }, (_, i) => {
                  const lock = getStatusForMonth(year, i + 1);
                  const isLocked = lock?.is_locked === true;
                  const wasUnlocked = lock && !lock.is_locked;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (isLocked && lock) {
                          setUnlockTarget(lock);
                          setShowUnlockDialog(true);
                        } else {
                          setLockYear(year);
                          setLockMonth(i);
                          setShowLockDialog(true);
                        }
                      }}
                      className={`
                        rounded-lg border p-2.5 text-center transition-all cursor-pointer
                        ${isLocked
                          ? "bg-destructive/10 border-destructive/30 hover:bg-destructive/20"
                          : wasUnlocked
                            ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20"
                            : "bg-muted/30 border-border hover:bg-muted/50"
                        }
                      `}
                    >
                      <span className="block text-[10px] text-muted-foreground">
                        {isRTL ? MONTHS_AR[i] : MONTHS_EN[i]}
                      </span>
                      <span className="block mt-1">
                        {isLocked ? (
                          <Lock size={16} className="mx-auto text-destructive" />
                        ) : wasUnlocked ? (
                          <Unlock size={16} className="mx-auto text-amber-500" />
                        ) : (
                          <CheckCircle2 size={16} className="mx-auto text-muted-foreground/40" />
                        )}
                      </span>
                      <Badge
                        variant={isLocked ? "destructive" : wasUnlocked ? "secondary" : "outline"}
                        className="text-[8px] mt-1"
                      >
                        {isLocked ? (isRTL ? "مقفل" : "Locked") : wasUnlocked ? (isRTL ? "مفتوح" : "Unlocked") : (isRTL ? "مفتوح" : "Open")}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* History Table */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary" />
            {isRTL ? "سجل القفل والفتح" : "Lock/Unlock History"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[350px]">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : locks.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                {isRTL ? "لا توجد فترات مقفلة" : "No locked periods"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">{isRTL ? "الفترة" : "Period"}</TableHead>
                    <TableHead className="text-xs">{isRTL ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="text-xs">{isRTL ? "تاريخ القفل" : "Locked At"}</TableHead>
                    <TableHead className="text-xs">{isRTL ? "سبب القفل" : "Lock Reason"}</TableHead>
                    <TableHead className="text-xs">{isRTL ? "تاريخ الفتح" : "Unlocked At"}</TableHead>
                    <TableHead className="text-xs">{isRTL ? "سبب الفتح" : "Unlock Reason"}</TableHead>
                    <TableHead className="text-xs">{isRTL ? "إجراء" : "Action"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locks.map(lock => (
                    <TableRow key={lock.id}>
                      <TableCell className="text-xs font-medium">
                        {isRTL ? MONTHS_AR[lock.period_month - 1] : MONTHS_EN[lock.period_month - 1]} {lock.period_year}
                      </TableCell>
                      <TableCell>
                        <Badge variant={lock.is_locked ? "destructive" : "secondary"} className="text-[9px] gap-0.5">
                          {lock.is_locked ? <Lock size={10} /> : <Unlock size={10} />}
                          {lock.is_locked ? (isRTL ? "مقفل" : "Locked") : (isRTL ? "مفتوح" : "Unlocked")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(lock.locked_at).toLocaleDateString("ar-SA")}
                      </TableCell>
                      <TableCell className="text-xs">{lock.lock_reason || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lock.unlocked_at ? new Date(lock.unlocked_at).toLocaleDateString("ar-SA") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{lock.unlock_reason || "—"}</TableCell>
                      <TableCell>
                        {lock.is_locked ? (
                          <Button
                            variant="outline" size="sm"
                            className="text-[10px] h-7 gap-1"
                            onClick={() => { setUnlockTarget(lock); setShowUnlockDialog(true); }}
                          >
                            <Unlock size={10} /> {isRTL ? "فتح" : "Unlock"}
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                {isRTL ? "ماذا يحدث عند قفل فترة؟" : "What happens when a period is locked?"}
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>{isRTL ? "يُمنع إنشاء أو تعديل أو حذف القيود المحاسبية في الفترة المقفلة" : "Creating, editing, or deleting journal entries in the locked period is blocked"}</li>
                <li>{isRTL ? "يُمنع تعديل الفواتير الصادرة في الفترة المقفلة" : "Modifying invoices issued in the locked period is blocked"}</li>
                <li>{isRTL ? "يُمنع تعديل المصروفات المسجلة في الفترة المقفلة" : "Modifying expenses recorded in the locked period is blocked"}</li>
                <li>{isRTL ? "يتم تسجيل كل عملية قفل وفتح في سجل المراجعة" : "Every lock/unlock action is recorded in the audit log"}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lock Dialog */}
      <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Lock size={16} className="text-destructive" />
              {isRTL ? "قفل فترة محاسبية" : "Lock Accounting Period"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{isRTL ? "السنة" : "Year"}</Label>
                <Select value={String(lockYear)} onValueChange={v => setLockYear(Number(v))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isRTL ? "الشهر" : "Month"}</Label>
                <Select value={String(lockMonth)} onValueChange={v => setLockMonth(Number(v))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(isRTL ? MONTHS_AR : MONTHS_EN).map((m, i) => (
                      <SelectItem key={i} value={String(i)} className="text-xs">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isRTL ? "سبب القفل (اختياري)" : "Lock Reason (optional)"}</Label>
              <Textarea value={lockReason} onChange={e => setLockReason(e.target.value)} className="text-xs" rows={2} placeholder={isRTL ? "إقفال شهري..." : "Monthly close..."} />
            </div>
            <div className="rounded-lg bg-destructive/10 p-3">
              <p className="text-[11px] text-destructive font-medium">
                {isRTL
                  ? `⚠️ سيتم منع أي تعديل على القيود والفواتير والمصروفات في ${MONTHS_AR[lockMonth]} ${lockYear}`
                  : `⚠️ All modifications to entries, invoices & expenses in ${MONTHS_EN[lockMonth]} ${lockYear} will be blocked`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLockDialog(false)} className="text-xs">
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleLock} disabled={actionLoading} variant="destructive" className="gap-1.5 text-xs">
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              {isRTL ? "تأكيد القفل" : "Confirm Lock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Dialog */}
      <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Unlock size={16} className="text-amber-500" />
              {isRTL ? "فتح فترة محاسبية" : "Unlock Accounting Period"}
            </DialogTitle>
          </DialogHeader>
          {unlockTarget && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-sm font-semibold">
                  {isRTL ? MONTHS_AR[unlockTarget.period_month - 1] : MONTHS_EN[unlockTarget.period_month - 1]} {unlockTarget.period_year}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isRTL ? "سبب الفتح (مطلوب)" : "Unlock Reason (required)"}</Label>
                <Textarea value={unlockReason} onChange={e => setUnlockReason(e.target.value)} className="text-xs" rows={2} placeholder={isRTL ? "تصحيح قيد..." : "Correcting an entry..."} />
              </div>
              <div className="rounded-lg bg-amber-500/10 p-3">
                <p className="text-[11px] text-amber-600 font-medium">
                  {isRTL
                    ? "⚠️ فتح الفترة سيسمح بتعديل القيود والفواتير والمصروفات — سيتم تسجيل هذا الإجراء"
                    : "⚠️ Unlocking will allow modifications — this action will be logged"}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnlockDialog(false)} className="text-xs">
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleUnlock} disabled={actionLoading || !unlockReason.trim()} className="gap-1.5 text-xs">
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
              {isRTL ? "تأكيد الفتح" : "Confirm Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PeriodLockManagement;
