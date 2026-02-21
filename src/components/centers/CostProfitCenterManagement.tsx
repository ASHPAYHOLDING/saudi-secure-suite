import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Pencil, Trash2, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Center {
  id: string;
  tenant_id: string;
  name: string;
  name_en: string | null;
  code: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
}

type CenterType = "cost" | "profit";

const CostProfitCenterManagement = () => {
  const { tenantId } = useAuth();
  const [tab, setTab] = useState<CenterType>("cost");
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Center | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [code, setCode] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);

  const tableName = tab === "cost" ? "cost_centers" : "profit_centers";

  const loadCenters = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from(tableName as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("code", { ascending: true });
    setCenters((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadCenters(); }, [tenantId, tab]);

  const openCreate = () => {
    setEditing(null);
    setName(""); setNameEn(""); setCode(""); setParentId(""); setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (c: Center) => {
    setEditing(c);
    setName(c.name); setNameEn(c.name_en || ""); setCode(c.code || "");
    setParentId(c.parent_id || ""); setIsActive(c.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!tenantId || !name.trim()) { toast.error("يرجى إدخال اسم المركز"); return; }
    setSaving(true);
    const payload: any = {
      name: name.trim(),
      name_en: nameEn.trim() || null,
      code: code.trim() || null,
      parent_id: parentId || null,
      is_active: isActive,
    };

    if (editing) {
      const { error } = await supabase.from(tableName as any).update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("تم تحديث المركز");
    } else {
      payload.tenant_id = tenantId;
      const { error } = await supabase.from(tableName as any).insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("تم إنشاء المركز");
    }
    setSaving(false);
    setDialogOpen(false);
    loadCenters();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المركز؟")) return;
    const { error } = await supabase.from(tableName as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف المركز");
    loadCenters();
  };

  const parentOptions = centers.filter(c => c.id !== editing?.id);
  const label = tab === "cost" ? "مراكز التكلفة" : "مراكز الربح";
  const labelEn = tab === "cost" ? "Cost Centers" : "Profit Centers";

  return (
    <div dir="rtl" className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
          <Building2 size={20} className="text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">مراكز التكلفة والربح</h1>
          <p className="text-xs text-muted-foreground">إدارة التقسيم المالي على مستوى الأقسام والمشاريع</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as CenterType)} dir="rtl">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="cost">مراكز التكلفة</TabsTrigger>
          <TabsTrigger value="profit">مراكز الربح</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">{label}</CardTitle>
              <Button size="sm" onClick={openCreate} className="gap-1.5">
                <Plus size={14} /> إضافة
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
              ) : centers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  لا توجد {label} بعد. اضغط "إضافة" لإنشاء مركز جديد.
                </div>
              ) : (
                <div className="space-y-2">
                  {centers.map((c) => {
                    const parent = centers.find(p => p.id === c.parent_id);
                    return (
                      <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-secondary/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              {c.code && <Badge variant="outline" className="font-english text-[10px]">{c.code}</Badge>}
                              <span className="font-medium text-sm">{c.name}</span>
                              {c.name_en && <span className="text-xs text-muted-foreground font-english">({c.name_en})</span>}
                            </div>
                            {parent && (
                              <span className="text-[10px] text-muted-foreground">← {parent.name}</span>
                            )}
                          </div>
                          {!c.is_active && <Badge variant="secondary" className="text-[10px]">معطّل</Badge>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil size={14} /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)} className="text-destructive hover:text-destructive"><Trash2 size={14} /></Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل" : "إنشاء"} {tab === "cost" ? "مركز تكلفة" : "مركز ربح"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>الاسم (عربي) *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: قسم التسويق" />
            </div>
            <div className="space-y-1.5">
              <Label>الاسم (إنجليزي)</Label>
              <Input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="e.g. Marketing Dept" className="font-english" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>الرمز</Label>
              <Input value={code} onChange={e => setCode(e.target.value)} placeholder="CC-001" className="font-english" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>المركز الأب</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger><SelectValue placeholder="— بدون —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— بدون —</SelectItem>
                  {parentOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ""}{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>مفعّل</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CostProfitCenterManagement;
