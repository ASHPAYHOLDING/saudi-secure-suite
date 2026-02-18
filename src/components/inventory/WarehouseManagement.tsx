import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Warehouse, Pencil, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WarehouseForm {
  name: string;
  name_en: string;
  code: string;
  address: string;
  is_active: boolean;
  is_default: boolean;
}

const emptyForm: WarehouseForm = {
  name: "", name_en: "", code: "", address: "", is_active: true, is_default: false,
};

const WarehouseManagement = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<WarehouseForm>(emptyForm);

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ["warehouses", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: balanceSummary = [] } = useQuery({
    queryKey: ["warehouse_balance_summary", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("inventory_balances")
        .select("warehouse_id, quantity_on_hand, total_value")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      // Aggregate per warehouse
      const map: Record<string, { items: number; qty: number; value: number }> = {};
      (data || []).forEach((b: any) => {
        if (!map[b.warehouse_id]) map[b.warehouse_id] = { items: 0, qty: 0, value: 0 };
        map[b.warehouse_id].items++;
        map[b.warehouse_id].qty += Number(b.quantity_on_hand) || 0;
        map[b.warehouse_id].value += Number(b.total_value) || 0;
      });
      return map;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error("Missing context");
      if (editId) {
        const { error } = await supabase.from("warehouses").update({
          name: form.name, name_en: form.name_en || null, code: form.code || null,
          address: form.address || null, is_active: form.is_active, is_default: form.is_default,
        }).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("warehouses").insert({
          name: form.name, name_en: form.name_en || null, code: form.code || null,
          address: form.address || null, is_active: form.is_active, is_default: form.is_default,
          tenant_id: tenantId, created_by: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast({ title: editId ? "تم تحديث المستودع" : "تمت إضافة المستودع" });
      setDialogOpen(false);
      setForm(emptyForm);
      setEditId(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const openEdit = (w: any) => {
    setEditId(w.id);
    setForm({
      name: w.name, name_en: w.name_en || "", code: w.code || "",
      address: w.address || "", is_active: w.is_active, is_default: w.is_default,
    });
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Warehouse size={20} />
          المستودعات ({warehouses.length})
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus size={16} /> إضافة مستودع</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editId ? "تعديل المستودع" : "إضافة مستودع جديد"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>الاسم *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <Label>Name (EN)</Label>
                  <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} dir="ltr" />
                </div>
              </div>
              <div>
                <Label>الرمز</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} dir="ltr" placeholder="WH-01" />
              </div>
              <div>
                <Label>العنوان</Label>
                <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label>نشط</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
                  <Label>افتراضي</Label>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "جاري الحفظ..." : editId ? "تحديث" : "إضافة"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
        ) : warehouses.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Warehouse size={48} className="mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">لم يتم إضافة مستودعات بعد</p>
            <p className="text-sm text-muted-foreground">أضف مستودعاً لبدء تتبع المخزون</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.map((w: any) => {
              const summary = (balanceSummary as any)[w.id] || { items: 0, qty: 0, value: 0 };
              return (
                <Card key={w.id} className="relative">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{w.name}</h3>
                        {w.code && <p className="text-xs text-muted-foreground font-mono">{w.code}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        {w.is_default && <Badge variant="default">افتراضي</Badge>}
                        <Badge variant={w.is_active ? "outline" : "secondary"}>
                          {w.is_active ? "نشط" : "معطل"}
                        </Badge>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(w)}>
                          <Pencil size={14} />
                        </Button>
                      </div>
                    </div>
                    {w.address && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin size={12} /> {w.address}
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-center border-t pt-3">
                      <div>
                        <p className="text-lg font-bold">{summary.items}</p>
                        <p className="text-xs text-muted-foreground">أصناف</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{Math.round(summary.qty)}</p>
                        <p className="text-xs text-muted-foreground">إجمالي الكمية</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{summary.value.toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground">القيمة (ر.س)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WarehouseManagement;
