import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Package, TrendingDown, DollarSign } from "lucide-react";

const InventoryReports = () => {
  const { tenantId } = useAuth();
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");

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

  // Inventory Valuation
  const { data: valuation = [] } = useQuery({
    queryKey: ["inventory_valuation", tenantId, selectedWarehouse],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("inventory_balances")
        .select("*, products(name, sku, unit), warehouses(name)")
        .eq("tenant_id", tenantId);
      if (selectedWarehouse !== "all") query = query.eq("warehouse_id", selectedWarehouse);
      const { data, error } = await query.order("total_value", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Movement history for COGS / item report
  const { data: movements = [] } = useQuery({
    queryKey: ["inventory_movements_report", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("*, products(name), warehouses(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Slow-moving analysis
  const { data: slowMoving = [] } = useQuery({
    queryKey: ["slow_moving", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("inventory_balances")
        .select("*, products(name, sku), warehouses(name)")
        .eq("tenant_id", tenantId)
        .gt("quantity_on_hand", 0)
        .order("last_movement_at", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // COGS aggregation
  const cogsMovements = movements.filter((m: any) => m.movement_type === "cogs" || m.movement_type === "goods_issue");
  const totalCOGS = cogsMovements.reduce((s: number, m: any) => s + Number(m.total_cost || 0), 0);

  const totalValuationAmount = valuation.reduce((s: number, v: any) => s + Number(v.total_value || 0), 0);
  const totalQty = valuation.reduce((s: number, v: any) => s + Number(v.quantity_on_hand || 0), 0);

  const movementLabels: Record<string, string> = {
    goods_receipt: "استلام", goods_issue: "صرف", transfer_in: "تحويل وارد",
    transfer_out: "تحويل صادر", adjustment: "تعديل", stocktake: "جرد",
    return_in: "مرتجع وارد", return_out: "مرتجع صادر", cogs: "ت.ب.م",
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Package size={20} className="text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{valuation.length}</p>
              <p className="text-xs text-muted-foreground">أصناف في المخزون</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><BarChart3 size={20} className="text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{Math.round(totalQty)}</p>
              <p className="text-xs text-muted-foreground">إجمالي الكمية</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><DollarSign size={20} className="text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{totalValuationAmount.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">قيمة المخزون (ر.س)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><TrendingDown size={20} className="text-destructive" /></div>
            <div>
              <p className="text-2xl font-bold">{totalCOGS.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">ت.ب.م (COGS)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warehouse filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">المستودع:</span>
        <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع المستودعات</SelectItem>
            {warehouses.map((w: any) => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="valuation" dir="rtl">
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="valuation">قيمة المخزون</TabsTrigger>
          <TabsTrigger value="movements">حركة الأصناف</TabsTrigger>
          <TabsTrigger value="slow">بطيء الحركة</TabsTrigger>
          <TabsTrigger value="cogs">COGS</TabsTrigger>
        </TabsList>

        <TabsContent value="valuation">
          <Card>
            <CardHeader>
              <CardTitle>تقرير قيمة المخزون</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الصنف</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>المستودع</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>متوسط التكلفة</TableHead>
                      <TableHead>القيمة الإجمالية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {valuation.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.products?.name || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{v.products?.sku || "—"}</TableCell>
                        <TableCell>{v.warehouses?.name || "—"}</TableCell>
                        <TableCell>{Number(v.quantity_on_hand)}</TableCell>
                        <TableCell>{Number(v.weighted_avg_cost).toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">{Number(v.total_value).toFixed(2)} ر.س</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle>تقرير حركة الأصناف</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الصنف</TableHead>
                      <TableHead>المستودع</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>التكلفة</TableHead>
                      <TableHead>قبل</TableHead>
                      <TableHead>بعد</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.slice(0, 50).map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.products?.name || "—"}</TableCell>
                        <TableCell>{m.warehouses?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{movementLabels[m.movement_type] || m.movement_type}</Badge>
                        </TableCell>
                        <TableCell>{Number(m.quantity)}</TableCell>
                        <TableCell>{Number(m.total_cost).toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground">{Number(m.previous_qty)}</TableCell>
                        <TableCell className="font-semibold">{Number(m.new_qty)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slow">
          <Card>
            <CardHeader>
              <CardTitle>تحليل الأصناف بطيئة الحركة</CardTitle>
            </CardHeader>
            <CardContent>
              {slowMoving.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الصنف</TableHead>
                        <TableHead>المستودع</TableHead>
                        <TableHead>الكمية</TableHead>
                        <TableHead>القيمة</TableHead>
                        <TableHead>آخر حركة</TableHead>
                        <TableHead>أيام الركود</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slowMoving.map((s: any) => {
                        const daysSince = s.last_movement_at
                          ? Math.floor((Date.now() - new Date(s.last_movement_at).getTime()) / 86400000)
                          : 999;
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.products?.name || "—"}</TableCell>
                            <TableCell>{s.warehouses?.name || "—"}</TableCell>
                            <TableCell>{Number(s.quantity_on_hand)}</TableCell>
                            <TableCell>{Number(s.total_value).toFixed(0)} ر.س</TableCell>
                            <TableCell className="text-sm">
                              {s.last_movement_at ? new Date(s.last_movement_at).toLocaleDateString("ar-SA") : "لم يتحرك"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={daysSince > 90 ? "destructive" : daysSince > 30 ? "secondary" : "outline"}>
                                {daysSince > 900 ? "لم يتحرك" : `${daysSince} يوم`}
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
        </TabsContent>

        <TabsContent value="cogs">
          <Card>
            <CardHeader>
              <CardTitle>تقرير تكلفة البضاعة المباعة (COGS)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">إجمالي تكلفة البضاعة المباعة</p>
                <p className="text-3xl font-bold">{totalCOGS.toFixed(2)} <span className="text-base font-normal text-muted-foreground">ر.س</span></p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الصنف</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>تكلفة الوحدة</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>المرجع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cogsMovements.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.products?.name || "—"}</TableCell>
                        <TableCell>{Number(m.quantity)}</TableCell>
                        <TableCell>{Number(m.unit_cost).toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">{Number(m.total_cost).toFixed(2)} ر.س</TableCell>
                        <TableCell className="text-xs">{m.reference_type || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InventoryReports;
