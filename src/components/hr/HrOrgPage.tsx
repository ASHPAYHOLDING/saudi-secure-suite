import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
    queryKey: ["hr-departments", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("org_departments").select("*").eq("tenant_id", tenantId!).order("name");
      return data ?? [];
    },
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["hr-positions", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("org_positions").select("*, org_departments(name)").eq("tenant_id", tenantId!).order("title");
      return data ?? [];
    },
  });

  const addDept = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("org_departments").insert({ tenant_id: tenantId!, name: deptName, name_en: deptNameEn || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تمت إضافة القسم"); qc.invalidateQueries({ queryKey: ["hr-departments"] }); setDeptDialogOpen(false); setDeptName(""); setDeptNameEn(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const addPos = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("org_positions").insert({ tenant_id: tenantId!, title: posTitle, title_en: posTitleEn || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تمت إضافة المسمى"); qc.invalidateQueries({ queryKey: ["hr-positions"] }); setPosDialogOpen(false); setPosTitle(""); setPosTitleEn(""); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><Building2 className="h-5 w-5" />الهيكل التنظيمي</h1>
      <Tabs defaultValue="departments">
        <TabsList><TabsTrigger value="departments">الأقسام</TabsTrigger><TabsTrigger value="positions">المسميات الوظيفية</TabsTrigger></TabsList>

        <TabsContent value="departments" className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 me-1" />إضافة قسم</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>إضافة قسم</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div><Label>اسم القسم *</Label><Input value={deptName} onChange={(e) => setDeptName(e.target.value)} /></div>
                  <div><Label>الاسم بالإنجليزية</Label><Input value={deptNameEn} onChange={(e) => setDeptNameEn(e.target.value)} /></div>
                  <Button onClick={() => addDept.mutate()} disabled={!deptName || addDept.isPending} className="w-full">{addDept.isPending ? "جاري..." : "إضافة"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>اسم القسم</TableHead><TableHead>الاسم EN</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
              <TableBody>
                {departments.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">لا توجد أقسام</TableCell></TableRow>
                ) : departments.map((d: any) => (
                  <TableRow key={d.id}><TableCell className="font-medium">{d.name}</TableCell><TableCell className="text-muted-foreground">{d.name_en ?? "—"}</TableCell>
                    <TableCell><Badge variant={d.is_active ? "default" : "outline"}>{d.is_active ? "نشط" : "معطل"}</Badge></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="positions" className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={posDialogOpen} onOpenChange={setPosDialogOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 me-1" />إضافة مسمى</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>إضافة مسمى وظيفي</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div><Label>المسمى *</Label><Input value={posTitle} onChange={(e) => setPosTitle(e.target.value)} /></div>
                  <div><Label>المسمى EN</Label><Input value={posTitleEn} onChange={(e) => setPosTitleEn(e.target.value)} /></div>
                  <Button onClick={() => addPos.mutate()} disabled={!posTitle || addPos.isPending} className="w-full">{addPos.isPending ? "جاري..." : "إضافة"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>المسمى</TableHead><TableHead>المسمى EN</TableHead><TableHead>القسم</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
              <TableBody>
                {positions.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">لا توجد مسميات</TableCell></TableRow>
                ) : positions.map((p: any) => (
                  <TableRow key={p.id}><TableCell className="font-medium">{p.title}</TableCell><TableCell className="text-muted-foreground">{p.title_en ?? "—"}</TableCell>
                    <TableCell>{(p as any).org_departments?.name ?? "—"}</TableCell>
                    <TableCell><Badge variant={p.is_active ? "default" : "outline"}>{p.is_active ? "نشط" : "معطل"}</Badge></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
