import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Briefcase, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function HrOrgPage() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();
  const [deptName, setDeptName] = useState("");
  const [deptNameEn, setDeptNameEn] = useState("");
  const [posTitle, setPosTitle] = useState("");
  const [posTitleEn, setPosTitleEn] = useState("");
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [posDialogOpen, setPosDialogOpen] = useState(false);

  const { data: departments = [] } = useQuery({
    queryKey: ["hr-departments", tenantId], enabled: !!tenantId,
    queryFn: async () => { const { data } = await supabase.from("org_departments").select("*").eq("tenant_id", tenantId!).order("name"); return data ?? []; },
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["hr-positions", tenantId], enabled: !!tenantId,
    queryFn: async () => { const { data } = await supabase.from("org_positions").select("*, org_departments(name)").eq("tenant_id", tenantId!).order("title"); return data ?? []; },
  });

  const addDept = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("org_departments").insert({ tenant_id: tenantId!, name: deptName, name_en: deptNameEn || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تمت إضافة القسم بنجاح"); qc.invalidateQueries({ queryKey: ["hr-departments"] }); setDeptDialogOpen(false); setDeptName(""); setDeptNameEn(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const addPos = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("org_positions").insert({ tenant_id: tenantId!, title: posTitle, title_en: posTitleEn || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تمت إضافة المسمى الوظيفي بنجاح"); qc.invalidateQueries({ queryKey: ["hr-positions"] }); setPosDialogOpen(false); setPosTitle(""); setPosTitleEn(""); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">الهيكل التنظيمي</h1>
          <p className="text-xs text-muted-foreground">Organization Structure</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/50"><CardContent className="p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Departments / الأقسام</p>
          <p className="text-2xl font-bold">{departments.length.toLocaleString("ar-SA")}</p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Positions / المسميات</p>
          <p className="text-2xl font-bold">{positions.length.toLocaleString("ar-SA")}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="departments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="departments" className="gap-1.5"><FolderTree className="h-3.5 w-3.5" />الأقسام | Departments</TabsTrigger>
          <TabsTrigger value="positions" className="gap-1.5"><Briefcase className="h-3.5 w-3.5" />المسميات الوظيفية | Positions</TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />إضافة قسم</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة قسم جديد</DialogTitle>
                  <DialogDescription>Add New Department</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label className="text-xs font-semibold">اسم القسم <span className="text-destructive">*</span></Label>
                    <p className="text-[10px] text-muted-foreground mb-1.5">Department Name (Arabic)</p>
                    <Input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="مثال: قسم الموارد البشرية" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">الاسم بالإنجليزية</Label>
                    <p className="text-[10px] text-muted-foreground mb-1.5">Department Name (English) — اختياري</p>
                    <Input dir="ltr" value={deptNameEn} onChange={(e) => setDeptNameEn(e.target.value)} placeholder="e.g. Human Resources" />
                  </div>
                  <Button onClick={() => addDept.mutate()} disabled={!deptName || addDept.isPending} className="w-full">
                    {addDept.isPending ? "جاري الإضافة..." : "إضافة القسم | Add Department"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="border-border/50 overflow-hidden"><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">اسم القسم<br /><span className="text-muted-foreground/60 font-normal">Department</span></TableHead>
                  <TableHead className="text-xs font-semibold">الاسم EN<br /><span className="text-muted-foreground/60 font-normal">English Name</span></TableHead>
                  <TableHead className="text-xs font-semibold">الحالة<br /><span className="text-muted-foreground/60 font-normal">Status</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-muted"><FolderTree className="h-8 w-8 text-muted-foreground/50" /></div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">لا توجد أقسام مُسجلة</p>
                        <p className="text-xs text-muted-foreground">No departments created yet</p>
                        <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto mt-2">أضف الأقسام لتنظيم الهيكل الإداري للمنشأة</p>
                      </div>
                    </div>
                  </TableCell></TableRow>
                ) : departments.map((d: any) => (
                  <TableRow key={d.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-medium text-foreground">{d.name}</TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">{d.name_en ?? "—"}</TableCell>
                    <TableCell><Badge variant={d.is_active ? "default" : "outline"}>{d.is_active ? "نشط | Active" : "معطل | Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="positions" className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={posDialogOpen} onOpenChange={setPosDialogOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />إضافة مسمى</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة مسمى وظيفي</DialogTitle>
                  <DialogDescription>Add New Position</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label className="text-xs font-semibold">المسمى الوظيفي <span className="text-destructive">*</span></Label>
                    <p className="text-[10px] text-muted-foreground mb-1.5">Position Title (Arabic)</p>
                    <Input value={posTitle} onChange={(e) => setPosTitle(e.target.value)} placeholder="مثال: مدير الموارد البشرية" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">المسمى بالإنجليزية</Label>
                    <p className="text-[10px] text-muted-foreground mb-1.5">Position Title (English) — اختياري</p>
                    <Input dir="ltr" value={posTitleEn} onChange={(e) => setPosTitleEn(e.target.value)} placeholder="e.g. HR Manager" />
                  </div>
                  <Button onClick={() => addPos.mutate()} disabled={!posTitle || addPos.isPending} className="w-full">
                    {addPos.isPending ? "جاري الإضافة..." : "إضافة المسمى | Add Position"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="border-border/50 overflow-hidden"><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">المسمى<br /><span className="text-muted-foreground/60 font-normal">Title</span></TableHead>
                  <TableHead className="text-xs font-semibold">المسمى EN<br /><span className="text-muted-foreground/60 font-normal">English Title</span></TableHead>
                  <TableHead className="text-xs font-semibold">القسم<br /><span className="text-muted-foreground/60 font-normal">Department</span></TableHead>
                  <TableHead className="text-xs font-semibold">الحالة<br /><span className="text-muted-foreground/60 font-normal">Status</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-muted"><Briefcase className="h-8 w-8 text-muted-foreground/50" /></div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">لا توجد مسميات وظيفية</p>
                        <p className="text-xs text-muted-foreground">No positions defined yet</p>
                        <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto mt-2">حدد المسميات الوظيفية لتوصيف أدوار الموظفين</p>
                      </div>
                    </div>
                  </TableCell></TableRow>
                ) : positions.map((p: any) => (
                  <TableRow key={p.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-medium text-foreground">{p.title}</TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">{p.title_en ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{(p as any).org_departments?.name ?? "—"}</TableCell>
                    <TableCell><Badge variant={p.is_active ? "default" : "outline"}>{p.is_active ? "نشط | Active" : "معطل | Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
