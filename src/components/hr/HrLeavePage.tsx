import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "معلق", variant: "secondary" },
  approved: { label: "مقبول", variant: "default" },
  rejected: { label: "مرفوض", variant: "destructive" },
  cancelled: { label: "ملغي", variant: "outline" },
};

export default function HrLeavePage() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [typeNameEn, setTypeNameEn] = useState("");
  const [defaultDays, setDefaultDays] = useState("21");
  const [isPaid, setIsPaid] = useState(true);

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["hr-leave-types", tenantId], enabled: !!tenantId,
    queryFn: async () => { const { data } = await supabase.from("hr_leave_types").select("*").eq("tenant_id", tenantId!).order("name"); return data ?? []; },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["hr-leave-requests", tenantId], enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("hr_leave_requests")
        .select("*, hr_employees(first_name, last_name), hr_leave_types(name)")
        .eq("tenant_id", tenantId!).order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const addType = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hr_leave_types").insert({
        tenant_id: tenantId!, name: typeName, name_en: typeNameEn || null,
        default_days: Number(defaultDays), is_paid: isPaid,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تمت إضافة نوع الإجازة"); qc.invalidateQueries({ queryKey: ["hr-leave-types"] }); setTypeDialogOpen(false); setTypeName(""); setTypeNameEn(""); setDefaultDays("21"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><Calendar className="h-5 w-5" />الإجازات</h1>
      <Tabs defaultValue="requests">
        <TabsList><TabsTrigger value="requests">طلبات الإجازة</TabsTrigger><TabsTrigger value="types">أنواع الإجازات</TabsTrigger></TabsList>

        <TabsContent value="requests">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>الموظف</TableHead><TableHead>النوع</TableHead><TableHead>من</TableHead><TableHead>إلى</TableHead><TableHead>الأيام</TableHead><TableHead>الحالة</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد طلبات</TableCell></TableRow>
                ) : requests.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.hr_employees?.first_name} {r.hr_employees?.last_name}</TableCell>
                    <TableCell>{r.hr_leave_types?.name}</TableCell>
                    <TableCell className="text-sm">{r.start_date}</TableCell>
                    <TableCell className="text-sm">{r.end_date}</TableCell>
                    <TableCell>{Number(r.days_count)}</TableCell>
                    <TableCell><Badge variant={STATUS_LABELS[r.status]?.variant ?? "outline"}>{STATUS_LABELS[r.status]?.label ?? r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 me-1" />إضافة نوع</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>إضافة نوع إجازة</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div><Label>الاسم *</Label><Input value={typeName} onChange={(e) => setTypeName(e.target.value)} /></div>
                  <div><Label>الاسم EN</Label><Input value={typeNameEn} onChange={(e) => setTypeNameEn(e.target.value)} /></div>
                  <div><Label>الأيام الافتراضية</Label><Input type="number" value={defaultDays} onChange={(e) => setDefaultDays(e.target.value)} /></div>
                  <div className="flex items-center gap-2"><Switch checked={isPaid} onCheckedChange={setIsPaid} /><Label>مدفوعة</Label></div>
                  <Button onClick={() => addType.mutate()} disabled={!typeName || addType.isPending} className="w-full">{addType.isPending ? "جاري..." : "إضافة"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>النوع</TableHead><TableHead>الأيام</TableHead><TableHead>مدفوعة</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
              <TableBody>
                {leaveTypes.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">لا توجد أنواع</TableCell></TableRow>
                ) : leaveTypes.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{Number(t.default_days)}</TableCell>
                    <TableCell>{t.is_paid ? "نعم" : "لا"}</TableCell>
                    <TableCell><Badge variant={t.is_active ? "default" : "outline"}>{t.is_active ? "نشط" : "معطل"}</Badge></TableCell>
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
