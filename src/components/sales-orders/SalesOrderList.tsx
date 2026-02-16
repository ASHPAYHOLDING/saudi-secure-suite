import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, ShoppingCart, Eye, Pencil, Trash2, FileInput } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateShort } from "@/lib/invoice-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  partially_fulfilled: "مكتمل جزئياً",
  fulfilled: "مكتمل",
  cancelled: "ملغى",
};
const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  partially_fulfilled: "bg-orange-100 text-orange-800",
  fulfilled: "bg-green-100 text-green-800",
  cancelled: "bg-muted text-muted-foreground",
};
const fulfillmentLabels: Record<string, string> = {
  unfulfilled: "لم يُنفذ",
  partial: "جزئي",
  fulfilled: "مكتمل",
};

interface SalesOrderListProps {
  onCreateNew: () => void;
  onCreateFromQuotation: (quotationId: string) => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}

const SalesOrderList = ({ onCreateNew, onCreateFromQuotation, onView, onEdit }: SalesOrderListProps) => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [quotationDialogOpen, setQuotationDialogOpen] = useState(false);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["sales_orders", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*, customers(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: approvedQuotations = [] } = useQuery({
    queryKey: ["approved_quotations", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("quotations")
        .select("id, quotation_number, title, grand_total, customers(name)")
        .eq("tenant_id", tenantId)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("sales_order_items").delete().eq("sales_order_id", id);
      const { error } = await supabase.from("sales_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_orders"] });
      toast({ title: "تم حذف أمر البيع" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const filtered = orders.filter((o: any) =>
    o.order_number.includes(search) || o.title?.includes(search) || o.customers?.name?.includes(search)
  );

  // Stats
  const pendingCount = orders.filter((o: any) => o.status === "pending" || o.status === "confirmed").length;
  const fulfilledCount = orders.filter((o: any) => o.fulfillment_status === "fulfilled").length;
  const totalValue = orders.filter((o: any) => o.status !== "cancelled").reduce((s: number, o: any) => s + (o.grand_total || 0), 0);

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">أوامر البيع</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة أوامر البيع وتتبع التنفيذ</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={quotationDialogOpen} onOpenChange={setQuotationDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-1.5" disabled={approvedQuotations.length === 0}>
                <FileInput size={16} /> من عرض سعر
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>اختر عرض سعر معتمد</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {approvedQuotations.map((q: any) => (
                  <button
                    key={q.id}
                    onClick={() => { setQuotationDialogOpen(false); onCreateFromQuotation(q.id); }}
                    className="w-full text-right rounded-lg border border-border p-3 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs text-muted-foreground">{q.quotation_number}</span>
                      <span className="font-mono text-sm font-medium">{formatCurrency(q.grand_total)} ر.س</span>
                    </div>
                    <p className="text-sm font-medium mt-1">{q.title || "—"}</p>
                    <p className="text-xs text-muted-foreground">{q.customers?.name || "—"}</p>
                  </button>
                ))}
                {approvedQuotations.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">لا توجد عروض أسعار معتمدة</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={onCreateNew} className="gap-1.5">
            <Plus size={16} /> أمر بيع جديد
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "أوامر نشطة", value: pendingCount, color: "text-blue-600" },
          { label: "مكتملة", value: fulfilledCount, color: "text-green-600" },
          { label: "إجمالي القيمة", value: `${formatCurrency(totalValue)} ر.س`, color: "text-foreground" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 px-5">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold font-english mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart size={20} />
            أوامر البيع ({filtered.length})
          </CardTitle>
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9 w-60" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد أوامر بيع بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الأمر</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>الإجمالي</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التنفيذ</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                      <TableCell className="font-medium">{o.title || "—"}</TableCell>
                      <TableCell>{o.customers?.name || "—"}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(o.grand_total)} ر.س</TableCell>
                      <TableCell>
                        <Badge className={statusColors[o.status]} variant="outline">
                          {statusLabels[o.status] || o.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {fulfillmentLabels[o.fulfillment_status] || o.fulfillment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDateShort(o.order_date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => onView(o.id)}><Eye size={14} /></Button>
                          {o.status === "pending" && (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => onEdit(o.id)}><Pencil size={14} /></Button>
                              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(o.id)}><Trash2 size={14} /></Button>
                            </>
                          )}
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
    </div>
  );
};

export default SalesOrderList;
