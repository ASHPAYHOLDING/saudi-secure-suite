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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ArrowLeftRight, Trash2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface TransferItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

const WarehouseTransfers = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ["warehouse_transfers", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("warehouse_transfers")
        .select("*, from_wh:warehouses!warehouse_transfers_from_warehouse_id_fkey(name), to_wh:warehouses!warehouse_transfers_to_warehouse_id_fkey(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses_active", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("warehouses").select("id, name").eq("tenant_id", tenantId).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products_inv", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("products").select("id, name").eq("tenant_id", tenantId).eq("is_active", true).eq("product_type", "product");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const addItem = (productId: string) => {
    const prod = products.find((p: any) => p.id === productId);
    if (!prod || items.find(i => i.product_id === productId)) return;
    setItems([...items, { product_id: productId, product_name: (prod as any).name, quantity: 1 }]);
  };

  const createTransfer = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error("Missing context");
      const { data: numData } = await supabase.rpc("generate_inventory_number", {
        p_tenant_id: tenantId, p_prefix: "TR",
      });

      const { data: transfer, error } = await supabase.from("warehouse_transfers").insert({
        tenant_id: tenantId, transfer_number: numData || `TR-${Date.now()}`,
        from_warehouse_id: fromWarehouse, to_warehouse_id: toWarehouse,
        notes: notes || null, created_by: user.id,
      }).select().single();
      if (error) throw error;

      const transferItems = items.map((item, idx) => ({
        tenant_id: tenantId, transfer_id: transfer.id,
        product_id: item.product_id, quantity: item.quantity, sort_order: idx,
      }));
      const { error: itemsErr } = await supabase.from("warehouse_transfer_items").insert(transferItems);
      if (itemsErr) throw itemsErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse_transfers"] });
      toast({ title: "تم إنشاء أمر التحويل" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const completeTransfer = useMutation({
    mutationFn: async (transferId: string) => {
      if (!tenantId || !user) throw new Error("Missing context");
      const { data: transfer } = await supabase.from("warehouse_transfers").select("*").eq("id", transferId).single();
      if (!transfer || transfer.status === "completed") throw new Error("التحويل غير قابل للإتمام");

      const { data: transferItems } = await supabase.from("warehouse_transfer_items").select("*").eq("transfer_id", transferId);

      for (const item of (transferItems || [])) {
        // Get current avg cost from source warehouse
        const { data: balance } = await supabase.from("inventory_balances")
          .select("weighted_avg_cost")
          .eq("warehouse_id", transfer.from_warehouse_id)
          .eq("product_id", item.product_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        const avgCost = Number(balance?.weighted_avg_cost) || 0;

        // Out from source
        await supabase.rpc("process_inventory_movement", {
          p_tenant_id: tenantId, p_warehouse_id: transfer.from_warehouse_id,
          p_product_id: item.product_id, p_variant_id: null,
          p_movement_type: "transfer_out", p_quantity: item.quantity,
          p_unit_cost: avgCost, p_reference_type: "warehouse_transfer",
          p_reference_id: transferId, p_transfer_id: transferId,
          p_notes: null, p_created_by: user.id,
        });

        // In to destination
        await supabase.rpc("process_inventory_movement", {
          p_tenant_id: tenantId, p_warehouse_id: transfer.to_warehouse_id,
          p_product_id: item.product_id, p_variant_id: null,
          p_movement_type: "transfer_in", p_quantity: item.quantity,
          p_unit_cost: avgCost, p_reference_type: "warehouse_transfer",
          p_reference_id: transferId, p_transfer_id: transferId,
          p_notes: null, p_created_by: user.id,
        });
      }

      await supabase.from("warehouse_transfers").update({
        status: "completed", completed_by: user.id, completed_at: new Date().toISOString(),
      }).eq("id", transferId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse_transfers"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_balances"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "تم إتمام التحويل بنجاح" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setItems([]);
    setFromWarehouse("");
    setToWarehouse("");
    setNotes("");
  };

  const statusLabels: Record<string, { label: string; variant: any }> = {
    draft: { label: "مسودة", variant: "secondary" },
    in_transit: { label: "قيد النقل", variant: "outline" },
    completed: { label: "مكتمل", variant: "default" },
    cancelled: { label: "ملغي", variant: "destructive" },
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight size={20} />
          التحويلات بين المستودعات ({transfers.length})
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus size={16} /> تحويل جديد</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>تحويل بين مستودعات</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createTransfer.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>من مستودع *</Label>
                  <Select value={fromWarehouse} onValueChange={setFromWarehouse}>
                    <SelectTrigger><SelectValue placeholder="المصدر" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.filter((w: any) => w.id !== toWarehouse).map((w: any) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>إلى مستودع *</Label>
                  <Select value={toWarehouse} onValueChange={setToWarehouse}>
                    <SelectTrigger><SelectValue placeholder="الوجهة" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.filter((w: any) => w.id !== fromWarehouse).map((w: any) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">الأصناف</Label>
                  <Select onValueChange={addItem}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="+ إضافة صنف" /></SelectTrigger>
                    <SelectContent>
                      {products.filter((p: any) => !items.find(i => i.product_id === p.id)).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                    <span className="flex-1 text-sm font-medium">{item.product_name}</span>
                    <Input type="number" min={1} className="w-20" value={item.quantity}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx].quantity = +e.target.value;
                        setItems(updated);
                      }} />
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
              <div>
                <Label>ملاحظات</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <Button type="submit" className="w-full"
                disabled={!fromWarehouse || !toWarehouse || items.length === 0 || createTransfer.isPending}>
                {createTransfer.isPending ? "جاري الحفظ..." : "إنشاء أمر التحويل"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
        ) : transfers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد تحويلات بعد</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم التحويل</TableHead>
                  <TableHead>من</TableHead>
                  <TableHead>إلى</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t: any) => {
                  const st = statusLabels[t.status] || { label: t.status, variant: "outline" };
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono font-medium">{t.transfer_number}</TableCell>
                      <TableCell>{t.from_wh?.name || "—"}</TableCell>
                      <TableCell>{t.to_wh?.name || "—"}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell className="text-sm">{format(new Date(t.created_at), "yyyy/MM/dd")}</TableCell>
                      <TableCell>
                        {(t.status === "draft" || t.status === "in_transit") && (
                          <Button size="sm" variant="outline" className="gap-1"
                            onClick={() => completeTransfer.mutate(t.id)}
                            disabled={completeTransfer.isPending}>
                            <Check size={14} /> إتمام
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WarehouseTransfers;
