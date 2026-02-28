/**
 * DashboardBuilder — replaces the default /dashboard home.
 * Provides drag-and-drop grid with RBAC-gated widgets.
 */
import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
// @ts-ignore — react-grid-layout uses CJS; named re-exports for ESM compat
import ReactGridLayout from "react-grid-layout";
const Responsive = (ReactGridLayout as any).Responsive ?? ReactGridLayout;
const WidthProvider = (ReactGridLayout as any).WidthProvider;
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { motion } from "framer-motion";
import {
  Settings2, RotateCcw, Grip, X, Activity, Zap, BarChart3,
  Save, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { useGranularPermissions } from "@/hooks/useGranularPermissions";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { timedCall } from "@/lib/timed-call";
import { cn } from "@/lib/utils";
import {
  WIDGET_REGISTRY,
  getDefaultLayout,
  type LayoutItem,
} from "./widget-registry";
import { WIDGET_COMPONENTS } from "./WidgetRenderers";
import WidgetCatalog from "./WidgetCatalog";

const ResponsiveGridLayout = WidthProvider(Responsive);

const QuickInvoiceDialog = lazy(() => import("@/components/invoices/QuickInvoiceDialog"));

// ─── Data fetcher (reuse from original) ───
async function fetchStats(tenantId: string) {
  const [invoicesRes, contractsRes, customersRes, expensesRes, auditRes, tenantRes] = await Promise.all([
    timedCall("invoices.select", async () =>
      supabase.from("invoices").select("status, grand_total, vat_total, due_date, invoice_date, created_at").eq("tenant_id", tenantId), `inv-${tenantId}`),
    timedCall("contracts.select", async () =>
      supabase.from("contracts").select("status").eq("tenant_id", tenantId), `con-${tenantId}`),
    timedCall("customers.count", async () =>
      supabase.from("customers").select("id").eq("tenant_id", tenantId), `cust-${tenantId}`),
    timedCall("expenses.select", async () =>
      supabase.from("expenses").select("total_amount, expense_date, status").eq("tenant_id", tenantId), `exp-${tenantId}`),
    timedCall("audit.recent", async () =>
      supabase.from("audit_logs").select("id, action, entity_type, entity_label, created_at, user_id").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(5), `aud-${tenantId}`),
    timedCall("tenant.name", async () =>
      supabase.from("tenants").select("name").eq("id", tenantId).single(), `tname-${tenantId}`),
  ]) as any[];

  const invoices = invoicesRes.data || [];
  const expenses = expensesRes.data || [];
  const contracts = contractsRes.data || [];
  const today = new Date().toISOString().split("T")[0];

  const totalExpenses = expenses
    .filter((e: any) => e.status === "approved" || e.status === "paid")
    .reduce((s: number, e: any) => s + (e.total_amount || 0), 0);

  const stats = {
    totalInvoices: invoices.length,
    draftInvoices: invoices.filter((i: any) => i.status === "draft").length,
    paidInvoices: invoices.filter((i: any) => i.status === "paid").length,
    pendingInvoices: invoices.filter((i: any) => i.status === "sent" || i.status === "pending").length,
    cancelledInvoices: invoices.filter((i: any) => i.status === "cancelled").length,
    overdueInvoices: invoices.filter((i: any) => i.status !== "paid" && i.status !== "cancelled" && i.due_date < today).length,
    totalRevenue: invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.grand_total || 0), 0),
    totalVat: invoices.reduce((s: number, i: any) => s + (i.vat_total || 0), 0),
    activeContracts: contracts.filter((c: any) => c.status === "active" || c.status === "signed").length,
    totalContracts: contracts.length,
    totalCustomers: customersRes.data?.length || 0,
    totalExpenses,
  };

  const monthlyData: any[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleDateString("ar-SA", { month: "short" });
    monthlyData.push({
      month: monthLabel,
      revenue: invoices.filter((inv: any) => inv.status === "paid" && inv.invoice_date?.startsWith(key)).reduce((s: number, inv: any) => s + (inv.grand_total || 0), 0),
      expenses: expenses.filter((e: any) => e.expense_date?.startsWith(key)).reduce((s: number, e: any) => s + (e.total_amount || 0), 0),
    });
  }

  return {
    stats,
    activities: auditRes.data || [],
    tenantName: tenantRes.data?.name || "",
    monthlyData,
  };
}

const DashboardBuilder = () => {
  const { tenantId, profile } = useAuth();
  const { t, dir } = useLanguage();
  const navigate = useNavigate();
  const { can } = useGranularPermissions();
  const { layout, saveLayout, resetLayout, saving } = useDashboardLayout();
  const [editMode, setEditMode] = useState(false);
  const [quickInvoiceOpen, setQuickInvoiceOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard-builder-stats", tenantId],
    queryFn: () => fetchStats(tenantId!),
    enabled: !!tenantId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Realtime refresh
  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase
      .channel(`db-realtime-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices", filter: `tenant_id=eq.${tenantId}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `tenant_id=eq.${tenantId}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, refetch]);

  const hasPermission = useCallback(
    (key: string | null) => {
      if (!key) return true;
      return can(key);
    },
    [can]
  );

  // Filter out widgets user doesn't have permission for
  const visibleLayout = useMemo(
    () => layout.filter((item) => {
      const def = WIDGET_REGISTRY.find((w) => w.id === item.i);
      return def && hasPermission(def.permissionKey);
    }),
    [layout, hasPermission]
  );

  const gridLayout = useMemo(
    () => visibleLayout.map((item) => {
      const def = WIDGET_REGISTRY.find((w) => w.id === item.i);
      return {
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: def?.defaultSize.minW || 2,
        minH: def?.defaultSize.minH || 2,
        static: !editMode,
      };
    }),
    [visibleLayout, editMode]
  );

  const onLayoutChange = useCallback(
    (newLayout: any[]) => {
      if (!editMode) return;
      const updated: LayoutItem[] = layout.map((item) => {
        const found = newLayout.find((l) => l.i === item.i);
        if (found) return { ...item, x: found.x, y: found.y, w: found.w, h: found.h };
        return item;
      });
      saveLayout(updated);
    },
    [editMode, layout, saveLayout]
  );

  const handleToggleWidget = useCallback(
    (widgetId: string, enabled: boolean) => {
      if (enabled) {
        const def = WIDGET_REGISTRY.find((w) => w.id === widgetId);
        if (!def) return;
        const maxY = layout.reduce((max, l) => Math.max(max, l.y + l.h), 0);
        const newItem: LayoutItem = {
          i: widgetId,
          x: 0,
          y: maxY,
          w: def.defaultSize.w,
          h: def.defaultSize.h,
        };
        saveLayout([...layout, newItem]);
      } else {
        saveLayout(layout.filter((l) => l.i !== widgetId));
      }
    },
    [layout, saveLayout]
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      saveLayout(layout.filter((l) => l.i !== widgetId));
    },
    [layout, saveLayout]
  );

  const firstName = data?.tenantName || profile?.full_name?.split(" ")[0] || "";

  return (
    <div dir={dir} className="space-y-4 p-4 sm:p-6 max-w-[1400px] mx-auto">
      {/* ═══ Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {t("dashboard.welcome", { name: firstName })}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <Activity className="w-3 h-3" />
            {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground shadow-sm"
            onClick={() => setQuickInvoiceOpen(true)}
          >
            <Zap className="w-3.5 h-3.5" />
            فاتورة سريعة
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/dashboard/reports")}>
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">التقارير</span>
          </Button>

          {/* Builder controls */}
          <div className="border-s border-border/50 ps-2 ms-1 flex items-center gap-1.5">
            <WidgetCatalog
              layout={layout}
              onToggleWidget={handleToggleWidget}
              hasPermission={hasPermission}
            />
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
              {editMode ? "تم" : "تخصيص"}
            </Button>
            {editMode && (
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={resetLayout}>
                <RotateCcw className="w-3.5 h-3.5" />
                إعادة ضبط
              </Button>
            )}
            {saving && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground animate-pulse">
                <Save className="w-3 h-3 me-1" />
                حفظ...
              </Badge>
            )}
          </div>
        </div>
      </motion.div>

      {/* Edit mode indicator */}
      {editMode && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-xs text-accent flex items-center gap-2"
        >
          <Grip className="w-4 h-4" />
          وضع التخصيص — اسحب وأفلِت لتغيير ترتيب العناصر، واسحب الزوايا لتغيير الحجم
        </motion.div>
      )}

      {/* ═══ Grid ═══ */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: gridLayout, md: gridLayout, sm: gridLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 8, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          isDraggable={editMode}
          isResizable={editMode}
          onLayoutChange={(l) => onLayoutChange(l)}
          draggableHandle=".widget-drag-handle"
          compactType="vertical"
          margin={[12, 12]}
        >
          {visibleLayout.map((item) => {
            const Comp = WIDGET_COMPONENTS[item.i];
            if (!Comp) return null;
            return (
              <div key={item.i} className="relative group">
                {editMode && (
                  <>
                    <div className="widget-drag-handle absolute top-1 start-1 z-10 cursor-grab active:cursor-grabbing p-1 rounded bg-muted/80 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Grip className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <button
                      onClick={() => handleRemoveWidget(item.i)}
                      className="absolute top-1 end-1 z-10 p-1 rounded bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <Comp
                  stats={data?.stats || {}}
                  activities={data?.activities}
                  monthlyData={data?.monthlyData}
                />
              </div>
            );
          })}
        </ResponsiveGridLayout>
      )}

      {/* Quick Invoice */}
      <Suspense fallback={null}>
        {quickInvoiceOpen && (
          <QuickInvoiceDialog open={quickInvoiceOpen} onOpenChange={setQuickInvoiceOpen} />
        )}
      </Suspense>
    </div>
  );
};

export default DashboardBuilder;
