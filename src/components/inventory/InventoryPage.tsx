import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, History, AlertTriangle, Layers, Warehouse, ClipboardCheck, ArrowLeftRight, ClipboardList, Database, BarChart3 } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import ProductList from "./ProductList";
import StockMovements from "./StockMovements";
import LowStockAlerts from "./LowStockAlerts";
import BatchTracking from "./BatchTracking";
import WarehouseManagement from "./WarehouseManagement";
import GoodsReceipts from "./GoodsReceipts";
import WarehouseTransfers from "./WarehouseTransfers";
import Stocktaking from "./Stocktaking";
import InventoryBalances from "./InventoryBalances";
import InventoryReports from "./InventoryReports";

const InventoryPage = () => {
  const [activeTab, setActiveTab] = useState("warehouses");

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader
        title="إدارة المخزون"
        description="إدارة المستودعات والمنتجات وتتبع المخزون والتكاليف"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex w-auto min-w-full md:min-w-0">
            <TabsTrigger value="warehouses" className="gap-1.5 text-xs sm:text-sm">
              <Warehouse size={14} />
              <span className="hidden sm:inline">المستودعات</span>
              <span className="sm:hidden">مستودعات</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5 text-xs sm:text-sm">
              <Package size={14} />
              <span className="hidden sm:inline">المنتجات</span>
              <span className="sm:hidden">منتجات</span>
            </TabsTrigger>
            <TabsTrigger value="balances" className="gap-1.5 text-xs sm:text-sm">
              <Database size={14} />
              <span className="hidden sm:inline">الأرصدة</span>
              <span className="sm:hidden">أرصدة</span>
            </TabsTrigger>
            <TabsTrigger value="receipts" className="gap-1.5 text-xs sm:text-sm">
              <ClipboardCheck size={14} />
              <span className="hidden sm:inline">سندات الاستلام</span>
              <span className="sm:hidden">استلام</span>
            </TabsTrigger>
            <TabsTrigger value="transfers" className="gap-1.5 text-xs sm:text-sm">
              <ArrowLeftRight size={14} />
              <span className="hidden sm:inline">التحويلات</span>
              <span className="sm:hidden">تحويل</span>
            </TabsTrigger>
            <TabsTrigger value="stocktake" className="gap-1.5 text-xs sm:text-sm">
              <ClipboardList size={14} />
              <span className="hidden sm:inline">الجرد</span>
              <span className="sm:hidden">جرد</span>
            </TabsTrigger>
            <TabsTrigger value="movements" className="gap-1.5 text-xs sm:text-sm">
              <History size={14} />
              <span className="hidden sm:inline">الحركات</span>
              <span className="sm:hidden">حركات</span>
            </TabsTrigger>
            <TabsTrigger value="batches" className="gap-1.5 text-xs sm:text-sm">
              <Layers size={14} />
              <span className="hidden sm:inline">الدفعات</span>
              <span className="sm:hidden">دفعات</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-1.5 text-xs sm:text-sm">
              <AlertTriangle size={14} />
              <span className="hidden sm:inline">التنبيهات</span>
              <span className="sm:hidden">تنبيه</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5 text-xs sm:text-sm">
              <BarChart3 size={14} />
              <span className="hidden sm:inline">التقارير</span>
              <span className="sm:hidden">تقارير</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="warehouses"><WarehouseManagement /></TabsContent>
        <TabsContent value="products"><ProductList /></TabsContent>
        <TabsContent value="balances"><InventoryBalances /></TabsContent>
        <TabsContent value="receipts"><GoodsReceipts /></TabsContent>
        <TabsContent value="transfers"><WarehouseTransfers /></TabsContent>
        <TabsContent value="stocktake"><Stocktaking /></TabsContent>
        <TabsContent value="movements"><StockMovements /></TabsContent>
        <TabsContent value="batches"><BatchTracking /></TabsContent>
        <TabsContent value="alerts"><LowStockAlerts /></TabsContent>
        <TabsContent value="reports"><InventoryReports /></TabsContent>
      </Tabs>
    </div>
  );
};

export default InventoryPage;
