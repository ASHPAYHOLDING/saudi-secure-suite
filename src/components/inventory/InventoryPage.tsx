import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, History, AlertTriangle, Layers } from "lucide-react";
import ProductList from "./ProductList";
import StockMovements from "./StockMovements";
import LowStockAlerts from "./LowStockAlerts";
import BatchTracking from "./BatchTracking";

const InventoryPage = () => {
  const [activeTab, setActiveTab] = useState("products");

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">إدارة المخزون</h1>
        <p className="text-sm text-muted-foreground mt-1">
          إدارة المنتجات والخدمات وتتبع المخزون
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="products" className="gap-2">
            <Package size={16} />
            المنتجات
          </TabsTrigger>
          <TabsTrigger value="batches" className="gap-2">
            <Layers size={16} />
            الدفعات
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-2">
            <History size={16} />
            حركة المخزون
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <AlertTriangle size={16} />
            التنبيهات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ProductList />
        </TabsContent>
        <TabsContent value="batches">
          <BatchTracking />
        </TabsContent>
        <TabsContent value="movements">
          <StockMovements />
        </TabsContent>
        <TabsContent value="alerts">
          <LowStockAlerts />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InventoryPage;
