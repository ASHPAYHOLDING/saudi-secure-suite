import { useEffect, useState, useCallback, useMemo } from "react";
import {
  BookOpen, Building2, Plus, Copy, CheckCircle2, Archive, Search,
  Upload, ChevronRight, ChevronDown, Loader2, Trash2, FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { secureRpc } from "@/lib/secure-rpc";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────
interface LegalEntity {
  id: string;
  name: string;
  name_en: string | null;
}

interface Chart {
  id: string;
  tenant_id: string;
  legal_entity_id: string | null;
  version: number;
  name: string;
  name_en: string | null;
  is_active: boolean;
  created_at: string;
}

type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

interface Account {
  id: string;
  chart_id: string;
  code: string;
  name: string;
  name_en: string | null;
  account_type: AccountType;
  parent_id: string | null;
  is_postable: boolean;
  sort_order: number;
}

interface TreeNode extends Account {
  children: TreeNode[];
  depth: number;
}

const ACCOUNT_TYPES: { value: AccountType; labelAr: string; labelEn: string; color: string }[] = [
  { value: "asset", labelAr: "أصول", labelEn: "Asset", color: "text-blue-600" },
  { value: "liability", labelAr: "التزامات", labelEn: "Liability", color: "text-red-600" },
  { value: "equity", labelAr: "حقوق ملكية", labelEn: "Equity", color: "text-purple-600" },
  { value: "revenue", labelAr: "إيرادات", labelEn: "Revenue", color: "text-emerald-600" },
  { value: "expense", labelAr: "مصروفات", labelEn: "Expense", color: "text-amber-600" },
];

const premiumFade = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

// ── Build tree from flat list ──────────────────────────────
function buildTree(accounts: Account[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const acc of accounts) {
    map.set(acc.id, { ...acc, children: [], depth: 0 });
  }
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      const parent = map.get(node.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(list: TreeNode[]) {
    for (const n of list) {
      result.push(n);
      if (n.children.length) walk(n.children);
    }
  }
  walk(nodes);
  return result;
}

// ── Main Component ──────────────────────────────────────────
const ChartOfAccountsPage = () => {
  const { tenantId } = useAuth();
  const { currentLang } = useLanguage();
  const isRTL = currentLang === "ar";

  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [selectedChartId, setSelectedChartId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Fetch legal entities
  const fetchEntities = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from("legal_entities").select("id, name, name_en").eq("tenant_id", tenantId);
    setEntities((data as LegalEntity[]) || []);
    setLoading(false);
  }, [tenantId]);

  // Fetch charts for selected entity
  const fetchCharts = useCallback(async () => {
    if (!tenantId || !selectedEntityId) { setCharts([]); return; }
    const { data } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("legal_entity_id", selectedEntityId)
      .order("version", { ascending: false });
    const chartList = (data as Chart[]) || [];
    setCharts(chartList);
    // Auto-select active chart
    const active = chartList.find(c => c.is_active);
    if (active) setSelectedChartId(active.id);
    else if (chartList.length) setSelectedChartId(chartList[0].id);
    else setSelectedChartId("");
  }, [tenantId, selectedEntityId]);

  // Fetch accounts for selected chart
  const fetchAccounts = useCallback(async () => {
    if (!selectedChartId) { setAccounts([]); return; }
    setAccountsLoading(true);
    const { data } = await supabase
      .from("coa_accounts")
      .select("id, chart_id, code, name, name_en, account_type, parent_id, is_postable, sort_order")
      .eq("chart_id", selectedChartId)
      .order("sort_order");
    setAccounts((data as Account[]) || []);
    setAccountsLoading(false);
    // Expand all by default
    if (data) setExpandedIds(new Set(data.map((a: any) => a.id)));
  }, [selectedChartId]);

  useEffect(() => { fetchEntities(); }, [fetchEntities]);
  useEffect(() => { fetchCharts(); }, [fetchCharts]);
  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const selectedChart = charts.find(c => c.id === selectedChartId);

  // ── Tree data ──
  const tree = useMemo(() => buildTree(accounts), [accounts]);
  const flatList = useMemo(() => flattenTree(tree), [tree]);

  const filteredList = useMemo(() => {
    if (!search.trim()) return flatList;
    const q = search.toLowerCase();
    return flatList.filter(a => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || (a.name_en || "").toLowerCase().includes(q));
  }, [flatList, search]);

  // ── Actions ──
  const handleCloneChart = async () => {
    if (!selectedChartId) return;
    const { data, error } = await secureRpc("clone_chart_of_accounts", { p_chart_id: selectedChartId });
    if (error) { toast.error(error.message); return; }
    toast.success(isRTL ? "تم استنساخ الشجرة بنجاح" : "Chart cloned successfully");
    fetchCharts();
  };

  const handleActivateChart = async (chartId: string) => {
    // Deactivate all charts for this entity, then activate selected
    await supabase.from("chart_of_accounts")
      .update({ is_active: false })
      .eq("tenant_id", tenantId!)
      .eq("legal_entity_id", selectedEntityId);
    const { error } = await supabase.from("chart_of_accounts")
      .update({ is_active: true })
      .eq("id", chartId);
    if (error) { toast.error(error.message); return; }
    toast.success(isRTL ? "تم التفعيل" : "Activated");
    fetchCharts();
  };

  const handleArchiveChart = async (chartId: string) => {
    const { error } = await supabase.from("chart_of_accounts")
      .update({ is_active: false })
      .eq("id", chartId);
    if (error) { toast.error(error.message); return; }
    toast.success(isRTL ? "تمت الأرشفة" : "Archived");
    fetchCharts();
  };

  const handleDeleteAccount = async (id: string) => {
    const { error } = await supabase.from("coa_accounts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    fetchAccounts();
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── CSV Import ──
  const handleCsvImport = async (file: File) => {
    if (!selectedChartId || !tenantId) return;
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) { toast.error(isRTL ? "ملف فارغ" : "Empty file"); return; }

    // Expected CSV: code,name,name_en,type,is_postable,parent_code
    const rows: Omit<Account, "id" | "chart_id" | "sort_order">[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < 4) continue;
      rows.push({
        code: cols[0],
        name: cols[1],
        name_en: cols[2] || null,
        account_type: (cols[3] as AccountType) || "expense",
        is_postable: cols[4] !== "false",
        parent_id: null, // Resolved later
      });
    }

    // Insert in batch
    const inserts = rows.map((r, i) => ({
      tenant_id: tenantId,
      chart_id: selectedChartId,
      code: r.code,
      name: r.name,
      name_en: r.name_en,
      account_type: r.account_type,
      is_postable: r.is_postable,
      sort_order: i,
    }));

    const { error } = await supabase.from("coa_accounts").insert(inserts);
    if (error) { toast.error(error.message); return; }
    toast.success(isRTL ? `تم استيراد ${inserts.length} حساب` : `Imported ${inserts.length} accounts`);
    fetchAccounts();
  };

  const typeInfo = (t: AccountType) => ACCOUNT_TYPES.find(x => x.value === t)!;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

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
                  {isRTL ? "شجرة الحسابات" : "Chart of Accounts"}
                </h1>
                <Badge className="enterprise-indicator border-accent/25 text-accent text-[10px] px-1.5 py-0 font-bold">
                  Enterprise
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isRTL ? "إدارة شجرة الحسابات مع الإصدارات والكيانات القانونية" : "Manage chart of accounts with versioning and legal entities"}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filters Bar */}
      <motion.div variants={premiumFade} initial="initial" animate="animate" transition={{ delay: 0.1, duration: 0.45 }}>
        <Card className="enterprise-card">
          <CardContent className="flex flex-col sm:flex-row gap-3 p-4 items-end">
            {/* Legal Entity */}
            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <Label className="text-xs text-muted-foreground">{isRTL ? "الكيان القانوني" : "Legal Entity"}</Label>
              <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={isRTL ? "اختر كيان" : "Select entity"} />
                </SelectTrigger>
                <SelectContent>
                  {entities.map(e => (
                    <SelectItem key={e.id} value={e.id}>{isRTL ? e.name : e.name_en || e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Chart version */}
            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <Label className="text-xs text-muted-foreground">{isRTL ? "الإصدار" : "Chart Version"}</Label>
              <Select value={selectedChartId} onValueChange={setSelectedChartId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={isRTL ? "اختر شجرة" : "Select chart"} />
                </SelectTrigger>
                <SelectContent>
                  {charts.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} (v{c.version})
                      {c.is_active && " ✓"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <Label className="text-xs text-muted-foreground">{isRTL ? "بحث" : "Search"}</Label>
              <div className="relative">
                <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 ps-9"
                  placeholder={isRTL ? "كود أو اسم الحساب..." : "Code or account name..."}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0">
              {selectedChartId && (
                <>
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleCloneChart}>
                    <Copy size={14} /> {isRTL ? "استنساخ" : "Clone"}
                  </Button>
                  {selectedChart && !selectedChart.is_active && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs text-emerald-600" onClick={() => handleActivateChart(selectedChartId)}>
                      <CheckCircle2 size={14} /> {isRTL ? "تفعيل" : "Activate"}
                    </Button>
                  )}
                  {selectedChart?.is_active && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs text-amber-600" onClick={() => handleArchiveChart(selectedChartId)}>
                      <Archive size={14} /> {isRTL ? "أرشفة" : "Archive"}
                    </Button>
                  )}
                </>
              )}
              {selectedEntityId && (
                <CreateChartDialog tenantId={tenantId!} entityId={selectedEntityId} isRTL={isRTL} onCreated={fetchCharts} />
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Accounts Table */}
      {selectedChartId ? (
        <motion.div variants={premiumFade} initial="initial" animate="animate" transition={{ delay: 0.2, duration: 0.45 }}>
          <Card className="enterprise-card overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText size={16} />
                {isRTL ? "الحسابات" : "Accounts"}
                <Badge variant="secondary" className="text-[10px]">{accounts.length}</Badge>
                {selectedChart?.is_active && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">
                    {isRTL ? "نشط" : "Active"}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex gap-2">
                <label>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleCsvImport(e.target.files[0]); e.target.value = ""; }}
                  />
                  <Button size="sm" variant="outline" className="gap-1 text-xs" asChild>
                    <span><Upload size={14} /> {isRTL ? "استيراد CSV" : "Import CSV"}</span>
                  </Button>
                </label>
                <AddAccountDialog
                  tenantId={tenantId!}
                  chartId={selectedChartId}
                  accounts={accounts}
                  isRTL={isRTL}
                  onCreated={fetchAccounts}
                />
              </div>
            </CardHeader>
            {accountsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <BookOpen className="mx-auto h-10 w-10 mb-2 opacity-40" />
                <p>{isRTL ? "لا توجد حسابات" : "No accounts found"}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">{isRTL ? "الحساب" : "Account"}</TableHead>
                    <TableHead>{isRTL ? "الكود" : "Code"}</TableHead>
                    <TableHead>{isRTL ? "النوع" : "Type"}</TableHead>
                    <TableHead>{isRTL ? "قابل للترحيل" : "Postable"}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredList.map(node => {
                    const hasChildren = node.children.length > 0;
                    const isExpanded = expandedIds.has(node.id);
                    // Check if this node should be visible (all ancestors expanded)
                    if (!search.trim() && node.parent_id) {
                      let parentId = node.parent_id;
                      let visible = true;
                      while (parentId) {
                        if (!expandedIds.has(parentId)) { visible = false; break; }
                        const parent = flatList.find(n => n.id === parentId);
                        parentId = parent?.parent_id || null;
                      }
                      if (!visible) return null;
                    }

                    const t = typeInfo(node.account_type);
                    return (
                      <TableRow key={node.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-1" style={{ paddingInlineStart: `${node.depth * 24}px` }}>
                            {hasChildren ? (
                              <button onClick={() => toggleExpand(node.id)} className="p-0.5 rounded hover:bg-muted">
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            ) : (
                              <span className="w-5" />
                            )}
                            <span className="font-medium text-sm">{isRTL ? node.name : node.name_en || node.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{node.code}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${t.color}`}>
                            {isRTL ? t.labelAr : t.labelEn}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {node.is_postable ? (
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                            onClick={() => handleDeleteAccount(node.id)}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </motion.div>
      ) : (
        <Card className="enterprise-card p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">{isRTL ? "اختر كياناً قانونياً وشجرة حسابات لعرض الحسابات" : "Select a legal entity and chart to view accounts"}</p>
        </Card>
      )}
    </div>
  );
};

// ── Create Chart Dialog ──────────────────────────────────────
function CreateChartDialog({ tenantId, entityId, isRTL, onCreated }: {
  tenantId: string; entityId: string; isRTL: boolean; onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");

  const handleSave = async () => {
    if (!name.trim()) { toast.error(isRTL ? "الاسم مطلوب" : "Name required"); return; }
    setSaving(true);
    const { error } = await supabase.from("chart_of_accounts").insert({
      tenant_id: tenantId,
      legal_entity_id: entityId,
      name: name.trim(),
      name_en: nameEn.trim() || null,
      is_active: false,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isRTL ? "تم إنشاء الشجرة" : "Chart created");
    setOpen(false);
    setName("");
    setNameEn("");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1 text-xs"><Plus size={14} /> {isRTL ? "شجرة جديدة" : "New Chart"}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{isRTL ? "شجرة حسابات جديدة" : "New Chart of Accounts"}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1"><Label>{isRTL ? "الاسم" : "Name"}</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label>{isRTL ? "الاسم (EN)" : "Name (EN)"}</Label><Input value={nameEn} onChange={e => setNameEn(e.target.value)} /></div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 size={14} className="animate-spin me-2" />}
            {isRTL ? "إنشاء" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Account Dialog ──────────────────────────────────────
function AddAccountDialog({ tenantId, chartId, accounts, isRTL, onCreated }: {
  tenantId: string; chartId: string; accounts: Account[]; isRTL: boolean; onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", name_en: "", account_type: "expense" as AccountType,
    parent_id: "__none__", is_postable: true,
  });

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error(isRTL ? "الكود والاسم مطلوبان" : "Code and name required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("coa_accounts").insert({
      tenant_id: tenantId,
      chart_id: chartId,
      code: form.code.trim(),
      name: form.name.trim(),
      name_en: form.name_en.trim() || null,
      account_type: form.account_type,
      parent_id: form.parent_id === "__none__" ? null : form.parent_id,
      is_postable: form.is_postable,
      sort_order: accounts.length,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isRTL ? "تمت الإضافة" : "Account added");
    setOpen(false);
    setForm({ code: "", name: "", name_en: "", account_type: "expense", parent_id: "__none__", is_postable: true });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1 text-xs"><Plus size={14} /> {isRTL ? "إضافة حساب" : "Add Account"}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{isRTL ? "حساب جديد" : "New Account"}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>{isRTL ? "الكود" : "Code"}</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="1100" className="font-mono" /></div>
            <div className="space-y-1">
              <Label>{isRTL ? "النوع" : "Type"}</Label>
              <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v as AccountType }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{isRTL ? t.labelAr : t.labelEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>{isRTL ? "الاسم" : "Name"}</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="space-y-1"><Label>{isRTL ? "الاسم (EN)" : "Name (EN)"}</Label><Input value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} /></div>
          <div className="space-y-1">
            <Label>{isRTL ? "الحساب الأب" : "Parent Account"}</Label>
            <Select value={form.parent_id} onValueChange={v => setForm(f => ({ ...f, parent_id: v }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{isRTL ? "بدون أب" : "No parent"}</SelectItem>
                {accounts.filter(a => !a.is_postable || true).map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.code} — {isRTL ? a.name : a.name_en || a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_postable} onCheckedChange={v => setForm(f => ({ ...f, is_postable: v }))} />
            <Label className="text-sm">{isRTL ? "قابل للترحيل" : "Postable"}</Label>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 size={14} className="animate-spin me-2" />}
            {isRTL ? "إضافة" : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ChartOfAccountsPage;
