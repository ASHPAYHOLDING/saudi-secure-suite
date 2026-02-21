import { useEffect, useState, useCallback } from "react";
import { Building2, GitBranch, Target, Plus, Star, Pencil, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────
interface LegalEntity {
  id: string;
  tenant_id: string;
  name: string;
  name_en: string | null;
  tax_number: string | null;
  country_code: string;
  currency_code: string;
  is_default: boolean;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
  name_en: string | null;
  code: string | null;
  is_active: boolean;
  is_main: boolean;
  legal_entity_id: string | null;
  cost_center_code: string | null;
}

interface CostCenter {
  id: string;
  name: string;
  name_en: string | null;
  code: string | null;
  is_active: boolean;
  legal_entity_id: string | null;
}

const premiumFade = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

// ── Main Component ──────────────────────────────────────────
const CorporateStructurePage = () => {
  const { tenantId } = useAuth();
  const { currentLang } = useLanguage();
  const isRTL = currentLang === "ar";

  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("entities");

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const [eRes, bRes, cRes] = await Promise.all([
      supabase.from("legal_entities").select("*").eq("tenant_id", tenantId).order("is_default", { ascending: false }),
      supabase.from("branches").select("id, name, name_en, code, is_active, is_main, legal_entity_id, cost_center_code").eq("tenant_id", tenantId).order("is_main", { ascending: false }),
      supabase.from("cost_centers").select("id, name, name_en, code, is_active, legal_entity_id").eq("tenant_id", tenantId).order("created_at"),
    ]);
    if (eRes.data) setEntities(eRes.data as LegalEntity[]);
    if (bRes.data) setBranches(bRes.data as Branch[]);
    if (cRes.data) setCostCenters(cRes.data as CostCenter[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Handlers ──────────────────────────────────────────────
  const setDefaultEntity = async (entityId: string) => {
    // Unset all defaults first, then set the chosen one
    await supabase.from("legal_entities").update({ is_default: false }).eq("tenant_id", tenantId!);
    const { error } = await supabase.from("legal_entities").update({ is_default: true }).eq("id", entityId);
    if (error) {
      toast.error(isRTL ? "حدث خطأ" : "Error setting default");
    } else {
      toast.success(isRTL ? "تم تعيين الكيان الافتراضي" : "Default entity set");
      fetchAll();
    }
  };

  const deleteEntity = async (id: string) => {
    const { error } = await supabase.from("legal_entities").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? "تم الحذف" : "Deleted");
      fetchAll();
    }
  };

  const getEntityName = (entityId: string | null) => {
    if (!entityId) return isRTL ? "غير محدد" : "Unassigned";
    const e = entities.find(x => x.id === entityId);
    return e ? (isRTL ? e.name : e.name_en || e.name) : "—";
  };

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
              <Building2 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {isRTL ? "الهيكل المؤسسي" : "Corporate Structure"}
                </h1>
                <Badge className="enterprise-indicator border-accent/25 text-accent text-[10px] px-1.5 py-0 font-bold">
                  Enterprise
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isRTL ? "إدارة الكيانات القانونية والفروع ومراكز التكلفة" : "Manage legal entities, branches, and cost centers"}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { icon: Building2, label: isRTL ? "الكيانات القانونية" : "Legal Entities", value: entities.length, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
          { icon: GitBranch, label: isRTL ? "الفروع" : "Branches", value: branches.length, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
          { icon: Target, label: isRTL ? "مراكز التكلفة" : "Cost Centers", value: costCenters.length, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} variants={premiumFade} initial="initial" animate="animate" transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <Card className="enterprise-card">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${kpi.bg}`}>
                  <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir={isRTL ? "rtl" : "ltr"}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="entities" className="gap-1.5">
            <Building2 size={14} />
            {isRTL ? "الكيانات القانونية" : "Legal Entities"}
          </TabsTrigger>
          <TabsTrigger value="branches" className="gap-1.5">
            <GitBranch size={14} />
            {isRTL ? "الفروع" : "Branches"}
          </TabsTrigger>
          <TabsTrigger value="centers" className="gap-1.5">
            <Target size={14} />
            {isRTL ? "مراكز التكلفة" : "Cost Centers"}
          </TabsTrigger>
        </TabsList>

        {/* ── Legal Entities Tab ── */}
        <TabsContent value="entities" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <CreateEntityDialog tenantId={tenantId!} isRTL={isRTL} onCreated={fetchAll} />
          </div>
          {entities.length === 0 ? (
            <Card className="enterprise-card p-8 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">{isRTL ? "لا توجد كيانات قانونية بعد" : "No legal entities yet"}</p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {entities.map((entity, i) => (
                <motion.div key={entity.id} variants={premiumFade} initial="initial" animate="animate" transition={{ delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
                  <Card className="enterprise-card relative overflow-hidden">
                    {entity.is_default && (
                      <div className="absolute top-3 end-3">
                        <Badge variant="default" className="gap-1 bg-accent text-accent-foreground text-[10px]">
                          <Star size={10} /> {isRTL ? "افتراضي" : "Default"}
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{isRTL ? entity.name : entity.name_en || entity.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      {entity.tax_number && <p>{isRTL ? "الرقم الضريبي" : "Tax #"}: {entity.tax_number}</p>}
                      <p>{isRTL ? "الدولة" : "Country"}: {entity.country_code} · {entity.currency_code}</p>
                      <div className="flex gap-2 pt-2">
                        {!entity.is_default && (
                          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setDefaultEntity(entity.id)}>
                            <Star size={12} /> {isRTL ? "تعيين افتراضي" : "Set Default"}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive text-xs" onClick={() => deleteEntity(entity.id)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Branches Tab ── */}
        <TabsContent value="branches" className="mt-4">
          <Card className="enterprise-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "الفرع" : "Branch"}</TableHead>
                  <TableHead>{isRTL ? "الرمز" : "Code"}</TableHead>
                  <TableHead>{isRTL ? "الكيان القانوني" : "Legal Entity"}</TableHead>
                  <TableHead>{isRTL ? "مركز التكلفة" : "Cost Center"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map(branch => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">
                      {isRTL ? branch.name : branch.name_en || branch.name}
                      {branch.is_main && (
                        <Badge variant="secondary" className="ms-2 text-[10px]">
                          {isRTL ? "رئيسي" : "Main"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{branch.code || "—"}</TableCell>
                    <TableCell>
                      <AssignEntitySelect
                        entityId={branch.legal_entity_id}
                        entities={entities}
                        isRTL={isRTL}
                        onAssign={async (entityId) => {
                          await supabase.from("branches").update({ legal_entity_id: entityId || null }).eq("id", branch.id);
                          fetchAll();
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{branch.cost_center_code || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={branch.is_active ? "default" : "secondary"} className="text-[10px]">
                        {branch.is_active ? (isRTL ? "نشط" : "Active") : (isRTL ? "معطل" : "Inactive")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {branches.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{isRTL ? "لا توجد فروع" : "No branches"}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── Cost Centers Tab ── */}
        <TabsContent value="centers" className="mt-4">
          <Card className="enterprise-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "مركز التكلفة" : "Cost Center"}</TableHead>
                  <TableHead>{isRTL ? "الرمز" : "Code"}</TableHead>
                  <TableHead>{isRTL ? "الكيان القانوني" : "Legal Entity"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costCenters.map(cc => (
                  <TableRow key={cc.id}>
                    <TableCell className="font-medium">{isRTL ? cc.name : cc.name_en || cc.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{cc.code || "—"}</TableCell>
                    <TableCell>
                      <AssignEntitySelect
                        entityId={cc.legal_entity_id}
                        entities={entities}
                        isRTL={isRTL}
                        onAssign={async (entityId) => {
                          await supabase.from("cost_centers").update({ legal_entity_id: entityId || null }).eq("id", cc.id);
                          fetchAll();
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={cc.is_active ? "default" : "secondary"} className="text-[10px]">
                        {cc.is_active ? (isRTL ? "نشط" : "Active") : (isRTL ? "معطل" : "Inactive")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {costCenters.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{isRTL ? "لا توجد مراكز تكلفة" : "No cost centers"}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────

function AssignEntitySelect({ entityId, entities, isRTL, onAssign }: {
  entityId: string | null;
  entities: LegalEntity[];
  isRTL: boolean;
  onAssign: (id: string | null) => void;
}) {
  return (
    <Select value={entityId || "__none__"} onValueChange={(v) => onAssign(v === "__none__" ? null : v)}>
      <SelectTrigger className="h-8 w-40 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{isRTL ? "غير محدد" : "Unassigned"}</SelectItem>
        {entities.map(e => (
          <SelectItem key={e.id} value={e.id}>{isRTL ? e.name : e.name_en || e.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreateEntityDialog({ tenantId, isRTL, onCreated }: { tenantId: string; isRTL: boolean; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", name_en: "", tax_number: "", country_code: "SA", currency_code: "SAR" });

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(isRTL ? "الاسم مطلوب" : "Name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("legal_entities").insert({
      tenant_id: tenantId,
      name: form.name.trim(),
      name_en: form.name_en.trim() || null,
      tax_number: form.tax_number.trim() || null,
      country_code: form.country_code,
      currency_code: form.currency_code,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? "تم إنشاء الكيان القانوني" : "Legal entity created");
      setOpen(false);
      setForm({ name: "", name_en: "", tax_number: "", country_code: "SA", currency_code: "SAR" });
      onCreated();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus size={16} /> {isRTL ? "إضافة كيان" : "Add Entity"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isRTL ? "كيان قانوني جديد" : "New Legal Entity"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{isRTL ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={isRTL ? "اسم الكيان" : "Entity name"} />
          </div>
          <div className="space-y-1.5">
            <Label>{isRTL ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
            <Input value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>{isRTL ? "الرقم الضريبي" : "Tax Number"}</Label>
            <Input value={form.tax_number} onChange={e => setForm(f => ({ ...f, tax_number: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{isRTL ? "رمز الدولة" : "Country"}</Label>
              <Input value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value }))} maxLength={3} />
            </div>
            <div className="space-y-1.5">
              <Label>{isRTL ? "العملة" : "Currency"}</Label>
              <Input value={form.currency_code} onChange={e => setForm(f => ({ ...f, currency_code: e.target.value }))} maxLength={3} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 size={14} className="animate-spin me-2" />}
            {isRTL ? "إنشاء" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CorporateStructurePage;
