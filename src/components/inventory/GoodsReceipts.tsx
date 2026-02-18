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
import { Plus, ClipboardCheck, Trash2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ReceiptItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  vat_rate: number;
}

const GoodsReceipts = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ReceiptItem[]>([]);

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["goods_receipts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("goods_receipts")
        .select("*, warehouses(name), suppliers(name)")
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
        .from("products").select("id, name, cost_price, vat_rate")
        .eq("tenant_id", tenantId).eq("is_active", true).eq("product_type", "product");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_list", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("suppliers").select("id, name").eq("tenant_id", tenantId).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const addItem = (productId: string) => {
    const prod = products.find((p: any) => p.id === productId);
    if (!prod || items.find(i => i.product_id === productId)) return;
    setItems([...items, {
      product_id: productId,
      product_name: (prod as any).name,
      quantity: 1,
      unit_cost: Number((prod as any).cost_price) || 0,
      vat_rate: Number((prod as any).vat_rate) || 15,
    }]);
  };

  const updateItem = (idx: number, field: keyof ReceiptItem, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
  const vatTotal = items.reduce((s, i) => s + i.quantity * i.unit_cost * i.vat_rate / 100, 0);

  const createReceipt = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error("Missing context");
      // Generate number
      const { data: numData } = await supabase.rpc("generate_inventory_number", {
        p_tenant_id: tenantId, p_prefix: "GR",
      });
      const receiptNumber = numData || `GR-${Date.now()}`;

      const { data: receipt, error } = await supabase.from("goods_receipts").insert({
        tenant_id: tenantId, warehouse_id: warehouseId,
        receipt_number: receiptNumber, supplier_id: supplierId || null,
        subtotal, vat_total: vatTotal, grand_total: subtotal + vatTotal,
        notes: notes || null, created_by: user.id,
      }).select().single();
      if (error) throw error;

      // Insert items
      const receiptItems = items.map((item, idx) => ({
        tenant_id: tenantId, receipt_id: receipt.id,
        product_id: item.product_id, quantity: item.quantity,
        unit_cost: item.unit_cost, vat_rate: item.vat_rate,
        vat_amount: item.quantity * item.unit_cost * item.vat_rate / 100,
        line_total: item.quantity * item.unit_cost * (1 + item.vat_rate / 100),
        sort_order: idx,
      }));
      const { error: itemsErr } = await supabase.from("goods_receipt_items").insert(receiptItems);
      if (itemsErr) throw itemsErr;

      return receipt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods_receipts"] });
      toast({ title: "تم إنشاء سند الاستلام" });
      setDialogOpen(false);
      setItems([]);
      setWarehouseId("");
      setSupplierId("");
      setNotes("");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const confirmReceipt = useMutation({
    mutationFn: async (receiptId: string) => {
      if (!tenantId || !user) throw new Error("Missing context");
      // Get receipt + items
      const { data: receipt } = await supabase.from("goods_receipts").select("*").eq("id", receiptId).single();
      if (!receipt || receipt.status !== "draft") throw new Error("السند غير قابل للتأكيد");

      const { data: receiptItems } = await supabase.from("goods_receipt_items")
        .select("*").eq("receipt_id", receiptId);

      // Process each item movement
      for (const item of (receiptItems || [])) {
        await supabase.rpc("process_inventory_movement", {
          p_tenant_id: tenantId, p_warehouse_id: receipt.warehouse_id,
          p_product_id: item.product_id, p_variant_id: null,
          p_movement_type: "goods_receipt", p_quantity: item.quantity,
          p_unit_cost: item.unit_cost, p_reference_type: "goods_receipt",
          p_reference_id: receiptId, p_transfer_id: null,
          p_notes: null, p_created_by: user.id,
        });
      }

      // Update status
      await supabase.from("goods_receipts").update({
        status: "confirmed", confirmed_by: user.id, confirmed_at: new Date().toISOString(),
      }).eq("id", receiptId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods_receipts"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_balances"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "تم تأكيد سند الاستلام وتحديث المخزون" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const statusLabels: Record<string, { label: string; variant: any }> = {
    draft: { label: "مسودة", variant: "secondary" },
    confirmed: { label: "مؤكد", variant: "default" },
    cancelled: { label: "ملغي", variant: "destructive" },
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck size={20} />
          سندات الاستلام ({receipts.length})
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setItems([]); setWarehouseId(""); setSupplierId(""); setNotes(""); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus size={16} /> سند استلام جديد</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>إنشاء سند استلام</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createReceipt.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
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
                  <Label>المورد</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Items */}
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
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">أضف أصنافاً للسند</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>الصنف</TableHead>
                          <TableHead>الكمية</TableHead>
                          <TableHead>التكلفة</TableHead>
                          <TableHead>ضريبة %</TableHead>
                          <TableHead>الإجمالي</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.product_name}</TableCell>
                            <TableCell>
                              <Input type="number" min={1} className="w-20" value={item.quantity}
                                onChange={(e) => updateItem(idx, "quantity", +e.target.value)} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" min={0} step={0.01} className="w-24" value={item.unit_cost}
                                onChange={(e) => updateItem(idx, "unit_cost", +e.target.value)} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" min={0} className="w-16" value={item.vat_rate}
                                onChange={(e) => updateItem(idx, "vat_rate", +e.target.value)} />
                            </TableCell>
                            <TableCell className="font-semibold">
                              {(item.quantity * item.unit_cost * (1 + item.vat_rate / 100)).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeItem(idx)}>
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {items.length > 0 && (
                  <div className="flex justify-end gap-6 text-sm border-t pt-2">
                    <span>المجموع: <strong>{subtotal.toFixed(2)}</strong></span>
                    <span>الضريبة: <strong>{vatTotal.toFixed(2)}</strong></span>
                    <span>الإجمالي: <strong>{(subtotal + vatTotal).toFixed(2)}</strong> ر.س</span>
                  </div>
                )}
              </div>

              <div>
                <Label>ملاحظات</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={!warehouseId || items.length === 0 || createReceipt.isPending}>
                {createReceipt.isPending ? "جاري الحفظ..." : "إنشاء سند الاستلام"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
        ) : receipts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد سندات استلام بعد</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم السند</TableHead>
                  <TableHead>المستودع</TableHead>
                  <TableHead>المورد</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((r: any) => {
                  const st = statusLabels[r.status] || { label: r.status, variant: "outline" };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono font-medium">{r.receipt_number}</TableCell>
                      <TableCell>{r.warehouses?.name || "—"}</TableCell>
                      <TableCell>{r.suppliers?.name || "—"}</TableCell>
                      <TableCell className="font-semibold">{Number(r.grand_total).toFixed(2)} ر.س</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell className="text-sm">{format(new Date(r.created_at), "yyyy/MM/dd")}</TableCell>
                      <TableCell>
                        {r.status === "draft" && (
                          <Button size="sm" variant="outline" className="gap-1"
                            onClick={() => confirmReceipt.mutate(r.id)}
                            disabled={confirmReceipt.isPending}>
                            <Check size={14} /> تأكيد
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

export default GoodsReceipts;
