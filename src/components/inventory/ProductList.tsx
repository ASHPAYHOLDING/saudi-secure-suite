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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Package, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProductForm {
  name: string;
  name_en: string;
  sku: string;
  description: string;
  product_type: string;
  unit: string;
  unit_price: number;
  cost_price: number;
  vat_rate: number;
  stock_quantity: number;
  low_stock_threshold: number;
  track_stock: boolean;
  category: string;
  barcode: string;
}

const emptyForm: ProductForm = {
  name: "", name_en: "", sku: "", description: "",
  product_type: "product", unit: "وحدة", unit_price: 0, cost_price: 0,
  vat_rate: 15, stock_quantity: 0, low_stock_threshold: 10,
  track_stock: true, category: "", barcode: "",
};

const ProductList = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error("Missing context");
      if (editId) {
        const { error } = await supabase.from("products").update({
          name: form.name, name_en: form.name_en || null, sku: form.sku || null,
          description: form.description || null, product_type: form.product_type,
          unit: form.unit, unit_price: form.unit_price, cost_price: form.cost_price,
          vat_rate: form.vat_rate, low_stock_threshold: form.low_stock_threshold,
          track_stock: form.track_stock, category: form.category || null,
          barcode: form.barcode || null,
        }).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert({
          ...form,
          name_en: form.name_en || null, sku: form.sku || null,
          description: form.description || null, category: form.category || null,
          barcode: form.barcode || null, tenant_id: tenantId, created_by: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: editId ? "تم تحديث المنتج" : "تمت إضافة المنتج" });
      setDialogOpen(false);
      setForm(emptyForm);
      setEditId(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "تم حذف المنتج" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name, name_en: p.name_en || "", sku: p.sku || "", description: p.description || "",
      product_type: p.product_type, unit: p.unit || "وحدة", unit_price: p.unit_price,
      cost_price: p.cost_price || 0, vat_rate: p.vat_rate, stock_quantity: p.stock_quantity,
      low_stock_threshold: p.low_stock_threshold || 10, track_stock: p.track_stock,
      category: p.category || "", barcode: p.barcode || "",
    });
    setDialogOpen(true);
  };

  const filtered = products.filter((p: any) =>
    p.name.includes(search) || (p.sku && p.sku.includes(search)) || (p.name_en && p.name_en.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Package size={20} />
          المنتجات والخدمات ({filtered.length})
        </CardTitle>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9 w-60"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus size={16} /> إضافة</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>{editId ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>النوع</Label>
                    <Select value={form.product_type} onValueChange={(v) => setForm({ ...form, product_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product">منتج</SelectItem>
                        <SelectItem value="service">خدمة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>SKU</Label>
                    <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} dir="ltr" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>سعر البيع</Label>
                    <Input type="number" min={0} step={0.01} value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: +e.target.value })} />
                  </div>
                  <div>
                    <Label>سعر التكلفة</Label>
                    <Input type="number" min={0} step={0.01} value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: +e.target.value })} />
                  </div>
                  <div>
                    <Label>ضريبة %</Label>
                    <Input type="number" min={0} step={0.01} value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: +e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>الوحدة</Label>
                    <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                  </div>
                  <div>
                    <Label>الكمية الابتدائية</Label>
                    <Input type="number" min={0} value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: +e.target.value })} disabled={!!editId} />
                  </div>
                  <div>
                    <Label>حد التنبيه</Label>
                    <Input type="number" min={0} value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: +e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>التصنيف</Label>
                    <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  </div>
                  <div>
                    <Label>الباركود</Label>
                    <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} dir="ltr" />
                  </div>
                </div>
                <div>
                  <Label>الوصف</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.track_stock} onCheckedChange={(v) => setForm({ ...form, track_stock: v })} />
                  <Label>تتبع المخزون</Label>
                </div>
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "جاري الحفظ..." : editId ? "تحديث" : "إضافة"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد منتجات بعد</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>المخزون</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.product_type === "product" ? "منتج" : "خدمة"}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.sku || "—"}</TableCell>
                    <TableCell>{p.unit_price.toFixed(2)} ر.س</TableCell>
                    <TableCell>
                      {p.track_stock ? (
                        <span className={p.stock_quantity <= (p.low_stock_threshold || 0) ? "text-destructive font-semibold" : ""}>
                          {p.stock_quantity}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "default" : "secondary"}>
                        {p.is_active ? "نشط" : "معطل"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil size={14} /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(p.id)}><Trash2 size={14} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductList;
