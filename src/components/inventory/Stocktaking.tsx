import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { secureRpc } from "@/lib/secure-rpc";
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
import { Plus, ClipboardList, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const Stocktaking = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [countDialogOpen, setCountDialogOpen] = useState(false);
  const [activeStocktake, setActiveStocktake] = useState<any>(null);
  const [countItems, setCountItems] = useState<any[]>([]);

  const { data: stocktakes = [], isLoading } = useQuery({
    queryKey: ["stocktakes", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("stocktakes")
        .select("*, warehouses(name)")
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

  const createStocktake = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error("Missing context");
      const { data: numData } = await secureRpc("generate_inventory_number", {
        p_tenant_id: tenantId, p_prefix: "ST",
      });

      // Get current balances for this warehouse
      const { data: balances } = await supabase.from("inventory_balances")
        .select("product_id, variant_id, quantity_on_hand, products(name)")
        .eq("tenant_id", tenantId)
        .eq("warehouse_id", warehouseId);

      const { data: stocktake, error } = await supabase.from("stocktakes").insert({
        tenant_id: tenantId, warehouse_id: warehouseId,
        stocktake_number: numData || `ST-${Date.now()}`,
        status: "in_progress", notes: notes || null, created_by: user.id,
      }).select().single();
      if (error) throw error;

      // Create stocktake items from current balances
      if (balances && balances.length > 0) {
        const stItems = balances.map((b: any, idx: number) => ({
          tenant_id: tenantId, stocktake_id: stocktake.id,
          product_id: b.product_id, variant_id: b.variant_id || null,
          system_qty: b.quantity_on_hand, sort_order: idx,
        }));
        await supabase.from("stocktake_items").insert(stItems);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocktakes"] });
      toast({ title: "تم إنشاء أمر الجرد" });
      setDialogOpen(false);
      setWarehouseId("");
      setNotes("");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const openCount = async (stocktake: any) => {
    const { data } = await supabase.from("stocktake_items")
      .select("*, products(name)")
      .eq("stocktake_id", stocktake.id)
      .order("sort_order");
    setActiveStocktake(stocktake);
    setCountItems((data || []).map((item: any) => ({
      ...item,
      counted_qty: item.counted_qty ?? "",
    })));
    setCountDialogOpen(true);
  };

  const saveCount = useMutation({
    mutationFn: async () => {
      for (const item of countItems) {
        if (item.counted_qty !== "" && item.counted_qty !== null) {
          await supabase.from("stocktake_items").update({
            counted_qty: Number(item.counted_qty),
          }).eq("id", item.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocktakes"] });
      toast({ title: "تم حفظ أرقام الجرد" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const completeStocktake = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user || !activeStocktake) throw new Error("Missing context");

      // Save counts first
      await saveCount.mutateAsync();

      // Process adjustments for items with differences
      for (const item of countItems) {
        if (item.counted_qty === "" || item.counted_qty === null) continue;
        const diff = Number(item.counted_qty) - Number(item.system_qty);
        if (diff === 0) continue;

        // Get current avg cost
        const { data: balance } = await supabase.from("inventory_balances")
          .select("weighted_avg_cost")
          .eq("warehouse_id", activeStocktake.warehouse_id)
          .eq("product_id", item.product_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        await secureRpc("process_inventory_movement", {
          p_tenant_id: tenantId, p_warehouse_id: activeStocktake.warehouse_id,
          p_product_id: item.product_id, p_variant_id: item.variant_id || null,
          p_movement_type: "stocktake", p_quantity: diff,
          p_unit_cost: Number(balance?.weighted_avg_cost) || 0,
          p_reference_type: "stocktake", p_reference_id: activeStocktake.id,
          p_transfer_id: null, p_notes: `جرد: الفرق ${diff}`,
          p_created_by: user.id,
        });
      }

      await supabase.from("stocktakes").update({
        status: "completed", completed_by: user.id, completed_at: new Date().toISOString(),
      }).eq("id", activeStocktake.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocktakes"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_balances"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "تم إتمام الجرد وتحديث المخزون" });
      setCountDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const statusLabels: Record<string, { label: string; variant: any }> = {
    draft: { label: "مسودة", variant: "secondary" },
    in_progress: { label: "قيد التنفيذ", variant: "outline" },
    completed: { label: "مكتمل", variant: "default" },
    cancelled: { label: "ملغي", variant: "destructive" },
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList size={20} />
            الجرد ({stocktakes.length})
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus size={16} /> جرد جديد</Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>إنشاء أمر جرد</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createStocktake.mutate(); }} className="space-y-4">
                <div>
                  <Label>المستودع *</Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger><SelectValue placeholder="اختر المستودع" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w: any) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                </div>
                <Button type="submit" className="w-full" disabled={!warehouseId || createStocktake.isPending}>
                  {createStocktake.isPending ? "جاري الإنشاء..." : "بدء الجرد"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
          ) : stocktakes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد عمليات جرد بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الجرد</TableHead>
                    <TableHead>المستودع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stocktakes.map((s: any) => {
                    const st = statusLabels[s.status] || { label: s.status, variant: "outline" };
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono font-medium">{s.stocktake_number}</TableCell>
                        <TableCell>{s.warehouses?.name || "—"}</TableCell>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell className="text-sm">{format(new Date(s.created_at), "yyyy/MM/dd")}</TableCell>
                        <TableCell>
                          {s.status === "in_progress" && (
                            <Button size="sm" variant="outline" onClick={() => openCount(s)}>
                              تسجيل العد
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

      {/* Count Dialog */}
      <Dialog open={countDialogOpen} onOpenChange={setCountDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل العد - {activeStocktake?.stocktake_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الصنف</TableHead>
                    <TableHead>الكمية بالنظام</TableHead>
                    <TableHead>العد الفعلي</TableHead>
                    <TableHead>الفرق</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countItems.map((item: any, idx: number) => {
                    const diff = item.counted_qty !== "" ? Number(item.counted_qty) - Number(item.system_qty) : null;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.products?.name || "—"}</TableCell>
                        <TableCell>{Number(item.system_qty)}</TableCell>
                        <TableCell>
                          <Input type="number" min={0} className="w-24" value={item.counted_qty}
                            onChange={(e) => {
                              const updated = [...countItems];
                              updated[idx].counted_qty = e.target.value;
                              setCountItems(updated);
                            }} />
                        </TableCell>
                        <TableCell>
                          {diff !== null && (
                            <span className={diff > 0 ? "text-green-600 font-semibold" : diff < 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => saveCount.mutate()} variant="outline" className="flex-1" disabled={saveCount.isPending}>
                حفظ العد
              </Button>
              <Button onClick={() => completeStocktake.mutate()} className="flex-1 gap-1" disabled={completeStocktake.isPending}>
                <Check size={14} /> إتمام الجرد وتحديث المخزون
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Stocktaking;
