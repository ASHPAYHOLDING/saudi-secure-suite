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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Layers, AlertTriangle, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";

interface BatchForm {
  product_id: string;
  batch_number: string;
  production_date: string;
  expiry_date: string;
  initial_quantity: number;
  cost_price: number;
  supplier_name: string;
  notes: string;
}

const emptyForm: BatchForm = {
  product_id: "", batch_number: "", production_date: "",
  expiry_date: "", initial_quantity: 0, cost_price: 0,
  supplier_name: "", notes: "",
};

const BatchTracking = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<BatchForm>(emptyForm);
  const [activeView, setActiveView] = useState("all");

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["product_batches", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("product_batches")
        .select("*, products(name, sku)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products_for_batch", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("product_type", "product");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const createBatch = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error("Missing context");
      const { error } = await supabase.from("product_batches").insert({
        tenant_id: tenantId,
        product_id: form.product_id,
        batch_number: form.batch_number,
        production_date: form.production_date || null,
        expiry_date: form.expiry_date || null,
        initial_quantity: form.initial_quantity,
        quantity: form.initial_quantity,
        cost_price: form.cost_price || 0,
        supplier_name: form.supplier_name || null,
        notes: form.notes || null,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_batches"] });
      toast({ title: "تمت إضافة الدفعة بنجاح" });
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days < 0) return { label: "منتهي", variant: "destructive" as const, days };
    if (days <= 30) return { label: `${days} يوم`, variant: "destructive" as const, days };
    if (days <= 90) return { label: `${days} يوم`, variant: "secondary" as const, days };
    return { label: `${days} يوم`, variant: "outline" as const, days };
  };

  const filtered = batches.filter((b: any) => {
    const matchSearch = b.batch_number.includes(search) ||
      b.products?.name?.includes(search) ||
      (b.supplier_name && b.supplier_name.includes(search));
    
    if (activeView === "expiring") {
      const status = getExpiryStatus(b.expiry_date);
      return matchSearch && status && status.days <= 90;
    }
    if (activeView === "expired") {
      const status = getExpiryStatus(b.expiry_date);
      return matchSearch && status && status.days < 0;
    }
    if (activeView === "depleted") {
      return matchSearch && b.quantity <= 0;
    }
    return matchSearch;
  });

  const expiringCount = batches.filter((b: any) => {
    const s = getExpiryStatus(b.expiry_date);
    return s && s.days >= 0 && s.days <= 90;
  }).length;

  const expiredCount = batches.filter((b: any) => {
    const s = getExpiryStatus(b.expiry_date);
    return s && s.days < 0;
  }).length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveView("all")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Layers size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{batches.length}</p>
              <p className="text-xs text-muted-foreground">إجمالي الدفعات</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveView("expiring")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <Calendar size={20} className="text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-accent-foreground">{expiringCount}</p>
              <p className="text-xs text-muted-foreground">قريبة الانتهاء (90 يوم)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveView("expired")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle size={20} className="text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{expiredCount}</p>
              <p className="text-xs text-muted-foreground">منتهية الصلاحية</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveView("depleted")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Layers size={20} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{batches.filter((b: any) => b.quantity <= 0).length}</p>
              <p className="text-xs text-muted-foreground">نفدت الكمية</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers size={20} />
            الدفعات / اللوتات
            {activeView !== "all" && (
              <Badge variant="secondary" className="mr-2">
                {activeView === "expiring" ? "قريبة الانتهاء" : activeView === "expired" ? "منتهية" : "نفدت"}
              </Badge>
            )}
            ({filtered.length})
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="بحث برقم الدفعة أو المنتج..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9 w-60"
              />
            </div>
            {activeView !== "all" && (
              <Button size="sm" variant="outline" onClick={() => setActiveView("all")}>عرض الكل</Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setForm(emptyForm); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus size={16} /> إضافة دفعة</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إضافة دفعة جديدة</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createBatch.mutate(); }} className="space-y-4">
                  <div>
                    <Label>المنتج *</Label>
                    <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>رقم الدفعة / اللوت *</Label>
                      <Input
                        value={form.batch_number}
                        onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                        placeholder="LOT-2026-001"
                        dir="ltr"
                        required
                      />
                    </div>
                    <div>
                      <Label>الكمية *</Label>
                      <Input
                        type="number" min={1}
                        value={form.initial_quantity}
                        onChange={(e) => setForm({ ...form, initial_quantity: +e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>تاريخ الإنتاج</Label>
                      <Input
                        type="date"
                        value={form.production_date}
                        onChange={(e) => setForm({ ...form, production_date: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label>تاريخ الانتهاء</Label>
                      <Input
                        type="date"
                        value={form.expiry_date}
                        onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>سعر التكلفة</Label>
                      <Input
                        type="number" min={0} step={0.01}
                        value={form.cost_price}
                        onChange={(e) => setForm({ ...form, cost_price: +e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>المورد</Label>
                      <Input
                        value={form.supplier_name}
                        onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>ملاحظات</Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={!form.product_id || !form.batch_number || form.initial_quantity <= 0 || createBatch.isPending}>
                    {createBatch.isPending ? "جاري الحفظ..." : "إضافة الدفعة"}
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
            <p className="text-center text-muted-foreground py-8">لا توجد دفعات بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الدفعة</TableHead>
                    <TableHead>المنتج</TableHead>
                    <TableHead>الكمية المتبقية</TableHead>
                    <TableHead>تاريخ الإنتاج</TableHead>
                    <TableHead>تاريخ الانتهاء</TableHead>
                    <TableHead>صلاحية</TableHead>
                    <TableHead>المورد</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b: any) => {
                    const expiryStatus = getExpiryStatus(b.expiry_date);
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-sm font-medium">{b.batch_number}</TableCell>
                        <TableCell>{b.products?.name || "—"}</TableCell>
                        <TableCell>
                          <span className={b.quantity <= 0 ? "text-destructive font-semibold" : "font-semibold"}>
                            {b.quantity}
                          </span>
                          <span className="text-muted-foreground text-xs"> / {b.initial_quantity}</span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {b.production_date ? format(new Date(b.production_date), "yyyy/MM/dd") : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {b.expiry_date ? format(new Date(b.expiry_date), "yyyy/MM/dd") : "—"}
                        </TableCell>
                        <TableCell>
                          {expiryStatus ? (
                            <Badge variant={expiryStatus.variant}>
                              {expiryStatus.days < 0 ? "منتهي" : `${expiryStatus.label} متبقي`}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{b.supplier_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={b.status === "active" ? "default" : "secondary"}>
                            {b.status === "active" ? "نشط" : b.status === "expired" ? "منتهي" : "محجوز"}
                          </Badge>
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
    </div>
  );
};

export default BatchTracking;
