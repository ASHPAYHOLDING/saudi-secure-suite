import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

const LowStockAlerts = () => {
  const { tenantId } = useAuth();

  const { data: lowStock = [], isLoading } = useQuery({
    queryKey: ["low_stock", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("track_stock", true)
        .order("stock_quantity", { ascending: true });
      if (error) throw error;
      // Filter client-side: stock_quantity <= low_stock_threshold
      return data.filter((p: any) => p.stock_quantity <= (p.low_stock_threshold || 0));
    },
    enabled: !!tenantId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle size={20} className="text-destructive" />
          تنبيهات نقص المخزون ({lowStock.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
        ) : lowStock.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-lg font-medium text-muted-foreground">✅ لا توجد تنبيهات</p>
            <p className="text-sm text-muted-foreground">جميع المنتجات فوق حد التنبيه</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>المخزون الحالي</TableHead>
                  <TableHead>حد التنبيه</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.sku || "—"}</TableCell>
                    <TableCell className="text-destructive font-bold">{p.stock_quantity}</TableCell>
                    <TableCell>{p.low_stock_threshold}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {p.stock_quantity === 0 ? "نفد المخزون" : "مخزون منخفض"}
                      </Badge>
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

export default LowStockAlerts;
