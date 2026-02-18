import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database } from "lucide-react";
import { useState } from "react";

const InventoryBalances = () => {
  const { tenantId } = useAuth();
  const [warehouseFilter, setWarehouseFilter] = useState("all");

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

  const { data: balances = [], isLoading } = useQuery({
    queryKey: ["inventory_balances", tenantId, warehouseFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("inventory_balances")
        .select("*, products(name, sku, unit), warehouses(name)")
        .eq("tenant_id", tenantId);
      if (warehouseFilter !== "all") query = query.eq("warehouse_id", warehouseFilter);
      const { data, error } = await query.order("quantity_on_hand", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Database size={20} />
          أرصدة المخزون ({balances.length})
        </CardTitle>
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع المستودعات</SelectItem>
            {warehouses.map((w: any) => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
        ) : balances.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد أرصدة مخزون بعد</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الصنف</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>المستودع</TableHead>
                  <TableHead>الكمية المتاحة</TableHead>
                  <TableHead>محجوز</TableHead>
                  <TableHead>إجمالي</TableHead>
                  <TableHead>متوسط التكلفة</TableHead>
                  <TableHead>القيمة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.products?.name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{b.products?.sku || "—"}</TableCell>
                    <TableCell>{b.warehouses?.name || "—"}</TableCell>
                    <TableCell>
                      <span className={Number(b.quantity_available) <= 0 ? "text-destructive font-semibold" : "font-semibold"}>
                        {Number(b.quantity_available)}
                      </span>
                    </TableCell>
                    <TableCell>{Number(b.quantity_reserved)}</TableCell>
                    <TableCell>{Number(b.quantity_on_hand)}</TableCell>
                    <TableCell>{Number(b.weighted_avg_cost).toFixed(2)}</TableCell>
                    <TableCell className="font-semibold">{Number(b.total_value).toFixed(2)} ر.س</TableCell>
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

export default InventoryBalances;
