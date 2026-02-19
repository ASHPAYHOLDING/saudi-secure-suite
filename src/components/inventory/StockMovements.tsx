import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { secureRpc } from "@/lib/secure-rpc";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { History, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const movementLabels: Record<string, { label: string; color: string }> = {
  in: { label: "وارد", color: "bg-green-100 text-green-800" },
  out: { label: "صادر", color: "bg-red-100 text-red-800" },
  adjustment: { label: "تعديل", color: "bg-blue-100 text-blue-800" },
  return: { label: "مرتجع", color: "bg-amber-100 text-amber-800" },
};

const StockMovements = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [movementType, setMovementType] = useState("in");
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState("");

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["stock_movements", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, products(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products_for_movement", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, track_stock")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("track_stock", true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const addMovement = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error("Missing context");
      const { error } = await secureRpc("record_stock_movement", {
        _product_id: productId,
        _tenant_id: tenantId,
        _movement_type: movementType,
        _quantity: quantity,
        _reference_type: "manual",
        _notes: notes || null,
        _created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "تم تسجيل الحركة" });
      setDialogOpen(false);
      setProductId("");
      setQuantity(0);
      setNotes("");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <History size={20} />
          حركة المخزون
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus size={16} /> تسجيل حركة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>تسجيل حركة مخزون</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); addMovement.mutate(); }} className="space-y-4">
              <div>
                <Label>المنتج *</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>نوع الحركة</Label>
                  <Select value={movementType} onValueChange={setMovementType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">وارد (إضافة)</SelectItem>
                      <SelectItem value="out">صادر (خصم)</SelectItem>
                      <SelectItem value="adjustment">تعديل يدوي</SelectItem>
                      <SelectItem value="return">مرتجع</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الكمية *</Label>
                  <Input type="number" min={0} step={1} value={quantity} onChange={(e) => setQuantity(+e.target.value)} required />
                </div>
              </div>
              <div>
                <Label>ملاحظات</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={!productId || quantity <= 0 || addMovement.isPending}>
                {addMovement.isPending ? "جاري التسجيل..." : "تسجيل"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
        ) : movements.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد حركات بعد</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>قبل</TableHead>
                  <TableHead>بعد</TableHead>
                  <TableHead>المرجع</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m: any) => {
                  const style = movementLabels[m.movement_type] || { label: m.movement_type, color: "" };
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.products?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge className={style.color} variant="outline">{style.label}</Badge>
                      </TableCell>
                      <TableCell>{m.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">{m.previous_quantity}</TableCell>
                      <TableCell className="font-semibold">{m.new_quantity}</TableCell>
                      <TableCell className="text-xs">{m.reference_type || "—"}</TableCell>
                      <TableCell className="text-xs">{format(new Date(m.created_at), "yyyy/MM/dd HH:mm")}</TableCell>
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

export default StockMovements;
