import { useEffect, useState, useCallback, useMemo } from "react";
import {
  BookOpen, Plus, Send, Loader2, Trash2, AlertTriangle, CheckCircle2,
  Calendar, Building2, FileText, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { secureRpc } from "@/lib/secure-rpc";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";
import { format } from "date-fns";

// ── Types ──
interface JournalEntry {
  id: string;
  tenant_id: string;
  legal_entity_id: string | null;
  branch_id: string | null;
  cost_center_id: string | null;
  entry_date: string;
  reference: string;
  memo: string | null;
  status: "draft" | "posted" | "reversed";
  posted_at: string | null;
  created_by: string;
  created_at: string;
}

interface JournalLine {
  id: string;
  entry_id: string;
  account_id: string;
  description: string | null;
  debit: number;
  credit: number;
  currency_code: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  name_en: string | null;
  is_postable: boolean;
}

interface LegalEntity {
  id: string;
  name: string;
  name_en: string | null;
}

interface DraftLine {
  tempId: string;
  account_id: string;
  description: string;
  debit: string;
  credit: string;
}

const premiumFade = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

const JournalPage = () => {
  const { tenantId, userId } = useAuth();
  const { currentLang } = useLanguage();
  const isRTL = currentLang === "ar";

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"draft" | "posted">("draft");
  const [search, setSearch] = useState("");

  const fetchEntries = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setEntries((data as JournalEntry[]) || []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(e => {
      if (tab === "draft" && e.status !== "draft") return false;
      if (tab === "posted" && e.status !== "posted") return false;
      if (q && !e.reference.toLowerCase().includes(q) && !(e.memo || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, tab, search]);

  const handlePost = async (entryId: string) => {
    const { error } = await secureRpc("post_journal_entry", { p_entry_id: entryId });
    if (error) { toast.error(error.message); return; }
    toast.success(isRTL ? "تم ترحيل القيد بنجاح" : "Entry posted successfully");
    fetchEntries();
  };

  const handleDelete = async (entryId: string) => {
    const { error } = await supabase.from("journal_entries").delete().eq("id", entryId);
    if (error) { toast.error(error.message); return; }
    toast.success(isRTL ? "تم الحذف" : "Deleted");
    fetchEntries();
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <motion.div {...premiumFade} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 enterprise-shadow">
              <BookOpen className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {isRTL ? "دفتر اليومية" : "General Journal"}
                </h1>
                <Badge className="enterprise-indicator border-accent/25 text-accent text-[10px] px-1.5 py-0 font-bold">
                  Enterprise
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isRTL ? "إنشاء وترحيل القيود اليومية" : "Create and post journal entries"}
              </p>
            </div>
          </div>
          <CreateEntryDialog tenantId={tenantId!} userId={userId!} isRTL={isRTL} onCreated={fetchEntries} />
        </div>
      </motion.div>

      {/* Tabs + Search */}
      <motion.div variants={premiumFade} initial="initial" animate="animate" transition={{ delay: 0.1 }}>
        <Card className="enterprise-card">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <Tabs value={tab} onValueChange={v => setTab(v as any)} className="w-auto">
                <TabsList>
                  <TabsTrigger value="draft" className="gap-1.5 text-xs">
                    <FileText size={14} />
                    {isRTL ? "مسودات" : "Drafts"}
                    <Badge variant="secondary" className="text-[10px] px-1">{entries.filter(e => e.status === "draft").length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="posted" className="gap-1.5 text-xs">
                    <CheckCircle2 size={14} />
                    {isRTL ? "مرحّلة" : "Posted"}
                    <Badge variant="secondary" className="text-[10px] px-1">{entries.filter(e => e.status === "posted").length}</Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 ps-9 text-sm"
                  placeholder={isRTL ? "بحث بالمرجع..." : "Search by reference..."}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Table */}
      <motion.div variants={premiumFade} initial="initial" animate="animate" transition={{ delay: 0.2 }}>
        <Card className="enterprise-card overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <BookOpen className="mx-auto h-10 w-10 mb-2 opacity-40" />
              <p>{isRTL ? "لا توجد قيود" : "No entries found"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "المرجع" : "Reference"}</TableHead>
                  <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{isRTL ? "البيان" : "Memo"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e => (
                  <TableRow key={e.id} className="group">
                    <TableCell className="font-mono text-sm">{e.reference || "—"}</TableCell>
                    <TableCell className="text-sm">{format(new Date(e.entry_date), "yyyy-MM-dd")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{e.memo || "—"}</TableCell>
                    <TableCell>
                      {e.status === "draft" && <Badge variant="outline" className="text-[10px] text-amber-600">Draft</Badge>}
                      {e.status === "posted" && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">Posted</Badge>}
                      {e.status === "reversed" && <Badge variant="destructive" className="text-[10px]">Reversed</Badge>}
                    </TableCell>
                    <TableCell>
                      {e.status === "draft" && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handlePost(e.id)} title={isRTL ? "ترحيل" : "Post"}>
                            <Send size={13} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(e.id)} title={isRTL ? "حذف" : "Delete"}>
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      )}
                      {e.status === "posted" && e.posted_at && (
                        <span className="text-[10px] text-muted-foreground">{format(new Date(e.posted_at), "HH:mm")}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// Create Entry Wizard Dialog
// ══════════════════════════════════════════════════════════════
function CreateEntryDialog({ tenantId, userId, isRTL, onCreated }: {
  tenantId: string; userId: string; isRTL: boolean; onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entities, setEntities] = useState<LegalEntity[]>([]);

  // Header
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [entityId, setEntityId] = useState("__none__");

  // Lines
  const [lines, setLines] = useState<DraftLine[]>([
    { tempId: crypto.randomUUID(), account_id: "", description: "", debit: "", credit: "" },
    { tempId: crypto.randomUUID(), account_id: "", description: "", debit: "", credit: "" },
  ]);

  useEffect(() => {
    if (!open || !tenantId) return;
    // Fetch postable accounts
    supabase.from("coa_accounts").select("id, code, name, name_en, is_postable")
      .eq("tenant_id", tenantId).eq("is_postable", true).order("code")
      .then(({ data }) => setAccounts((data as Account[]) || []));
    // Fetch entities
    supabase.from("legal_entities").select("id, name, name_en")
      .eq("tenant_id", tenantId)
      .then(({ data }) => setEntities((data as LegalEntity[]) || []));
  }, [open, tenantId]);

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;
  const diff = Math.abs(totalDebit - totalCredit);

  const updateLine = (tempId: string, field: keyof DraftLine, value: string) => {
    setLines(prev => prev.map(l => l.tempId === tempId ? { ...l, [field]: value } : l));
  };

  const addLine = () => {
    setLines(prev => [...prev, { tempId: crypto.randomUUID(), account_id: "", description: "", debit: "", credit: "" }]);
  };

  const removeLine = (tempId: string) => {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter(l => l.tempId !== tempId));
  };

  const handleSave = async () => {
    if (!reference.trim()) { toast.error(isRTL ? "المرجع مطلوب" : "Reference required"); return; }
    const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) { toast.error(isRTL ? "يجب إضافة سطرين على الأقل" : "At least 2 lines required"); return; }
    if (!isBalanced) { toast.error(isRTL ? "القيد غير متوازن" : "Entry is not balanced"); return; }

    setSaving(true);
    // Insert header
    const { data: entry, error: entryErr } = await supabase.from("journal_entries").insert({
      tenant_id: tenantId,
      legal_entity_id: entityId === "__none__" ? null : entityId,
      entry_date: entryDate,
      reference: reference.trim(),
      memo: memo.trim() || null,
      created_by: userId,
    }).select("id").single();

    if (entryErr || !entry) { setSaving(false); toast.error(entryErr?.message || "Error"); return; }

    // Insert lines
    const lineInserts = validLines.map(l => ({
      tenant_id: tenantId,
      entry_id: entry.id,
      account_id: l.account_id,
      description: l.description.trim() || null,
      debit: parseFloat(l.debit) || 0,
      credit: parseFloat(l.credit) || 0,
    }));

    const { error: linesErr } = await supabase.from("journal_lines").insert(lineInserts);
    setSaving(false);
    if (linesErr) { toast.error(linesErr.message); return; }

    toast.success(isRTL ? "تم إنشاء القيد" : "Entry created");
    setOpen(false);
    resetForm();
    onCreated();
  };

  const resetForm = () => {
    setReference(""); setMemo(""); setEntryDate(format(new Date(), "yyyy-MM-dd")); setEntityId("__none__");
    setLines([
      { tempId: crypto.randomUUID(), account_id: "", description: "", debit: "", credit: "" },
      { tempId: crypto.randomUUID(), account_id: "", description: "", debit: "", credit: "" },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="gap-1.5 text-sm"><Plus size={16} /> {isRTL ? "قيد جديد" : "New Entry"}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isRTL ? "قيد يومية جديد" : "New Journal Entry"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Header fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{isRTL ? "المرجع" : "Reference"} *</Label>
              <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="JV-001" className="font-mono h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isRTL ? "التاريخ" : "Date"}</Label>
              <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isRTL ? "الكيان القانوني" : "Legal Entity"}</Label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{isRTL ? "بدون" : "None"}</SelectItem>
                  {entities.map(e => (
                    <SelectItem key={e.id} value={e.id}>{isRTL ? e.name : e.name_en || e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{isRTL ? "البيان" : "Memo"}</Label>
            <Textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} className="text-sm" />
          </div>

          <Separator />

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">{isRTL ? "بنود القيد" : "Entry Lines"}</Label>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={addLine}>
                <Plus size={12} /> {isRTL ? "إضافة سطر" : "Add Line"}
              </Button>
            </div>

            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-2 text-[10px] font-medium text-muted-foreground px-1">
                <div className="col-span-4">{isRTL ? "الحساب" : "Account"}</div>
                <div className="col-span-3">{isRTL ? "الوصف" : "Description"}</div>
                <div className="col-span-2">{isRTL ? "مدين" : "Debit"}</div>
                <div className="col-span-2">{isRTL ? "دائن" : "Credit"}</div>
                <div className="col-span-1"></div>
              </div>

              {lines.map(line => (
                <div key={line.tempId} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <Select value={line.account_id} onValueChange={v => updateLine(line.tempId, "account_id", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={isRTL ? "اختر حساب" : "Select"} /></SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => (
                          <SelectItem key={a.id} value={a.id} className="text-xs">
                            <span className="font-mono">{a.code}</span> — {isRTL ? a.name : a.name_en || a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input className="h-8 text-xs" value={line.description} onChange={e => updateLine(line.tempId, "description", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Input
                      className="h-8 text-xs font-mono text-end"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.debit}
                      onChange={e => updateLine(line.tempId, "debit", e.target.value)}
                      disabled={parseFloat(line.credit) > 0}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      className="h-8 text-xs font-mono text-end"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.credit}
                      onChange={e => updateLine(line.tempId, "credit", e.target.value)}
                      disabled={parseFloat(line.debit) > 0}
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeLine(line.tempId)} disabled={lines.length <= 2}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="grid grid-cols-12 gap-2 mt-3 px-1">
              <div className="col-span-7 text-end text-xs font-semibold text-muted-foreground">
                {isRTL ? "الإجمالي" : "Total"}
              </div>
              <div className="col-span-2 text-end font-mono text-sm font-bold">{totalDebit.toFixed(2)}</div>
              <div className="col-span-2 text-end font-mono text-sm font-bold">{totalCredit.toFixed(2)}</div>
              <div className="col-span-1"></div>
            </div>

            {/* Balance indicator */}
            <div className="mt-2">
              {totalDebit === 0 && totalCredit === 0 ? null : isBalanced ? (
                <div className="flex items-center gap-1.5 text-emerald-600 text-xs">
                  <CheckCircle2 size={14} />
                  {isRTL ? "القيد متوازن" : "Entry is balanced"}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-amber-600 text-xs">
                  <AlertTriangle size={14} />
                  {isRTL ? `فرق: ${diff.toFixed(2)}` : `Difference: ${diff.toFixed(2)}`}
                </div>
              )}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving || !isBalanced} className="w-full">
            {saving && <Loader2 size={14} className="animate-spin me-2" />}
            {isRTL ? "إنشاء القيد" : "Create Entry"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default JournalPage;
