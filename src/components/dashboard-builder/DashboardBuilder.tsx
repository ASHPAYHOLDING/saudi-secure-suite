/**
 * DashboardBuilder — redesigned clean dashboard home.
 * Uses a static CSS grid layout for consistency, with optional
 * react-grid-layout mode when editing.
 */
import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings2, RotateCcw, Grip, X, Zap, BarChart3,
  Save, CheckCircle2, Plus, CalendarDays, Building2,
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

const QuickInvoiceDialog = lazy(() => import("@/components/invoices/QuickInvoiceDialog"));

// ─── Data fetcher ───
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
  const { width, containerRef } = useContainerWidth();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile && editMode) setEditMode(false);
  }, [isMobile, editMode]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard-builder-stats", tenantId],
    queryFn: () => fetchStats(tenantId!),
    enabled: !!tenantId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

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
    (key: string | null) => !key || can(key),
    [can]
  );

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
        x: item.x, y: item.y, w: item.w, h: item.h,
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
        const newItem: LayoutItem = { i: widgetId, x: 0, y: maxY, w: def.defaultSize.w, h: def.defaultSize.h };
        saveLayout([...layout, newItem]);
      } else {
        saveLayout(layout.filter((l) => l.i !== widgetId));
      }
    },
    [layout, saveLayout]
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => saveLayout(layout.filter((l) => l.i !== widgetId)),
    [layout, saveLayout]
  );

  const firstName = data?.tenantName || profile?.full_name?.split(" ")[0] || "";
  const hijriDate = new Date().toLocaleDateString("ar-SA-u-ca-islamic", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const gregDate = new Date().toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ─── Separate widget groups for static layout ───
  const kpiIds = ["revenue", "expenses", "overdue", "vat"];
  const secondaryIds = ["collection", "customers"];
  const wideIds = ["alerts", "charts", "activity", "payroll"];

  const kpiWidgets = kpiIds.filter(id => visibleLayout.some(l => l.i === id));
  const secondaryWidgets = secondaryIds.filter(id => visibleLayout.some(l => l.i === id));
  const wideWidgets = wideIds.filter(id => visibleLayout.some(l => l.i === id));

  return (
    <div dir={dir} className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* ═══ Welcome Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl bg-gradient-to-l from-primary via-primary to-primary/90 p-6 sm:p-8 text-primary-foreground relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              👋 مرحباً، {firstName}
            </h1>
            <div className="flex items-center gap-2 mt-2 text-primary-foreground/70 text-xs sm:text-sm">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{hijriDate}</span>
              <span className="text-primary-foreground/40">·</span>
              <span className="text-primary-foreground/50 text-[11px]">{gregDate}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ Actions Bar ═══ */}
      <AnimatePresence mode="wait">
        {editMode ? (
          /* ── Edit Mode Toolbar ── */
          <motion.div
            key="edit-toolbar"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border-2 border-dashed border-accent/40 bg-accent/[0.04] px-5 py-4"
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Settings2 className="w-4.5 h-4.5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">وضع التخصيص</p>
                  <p className="text-[11px] text-muted-foreground">اسحب لإعادة الترتيب · اسحب الزوايا لتغيير الحجم · اضغط ✕ للإزالة</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <WidgetCatalog layout={layout} onToggleWidget={handleToggleWidget} hasPermission={hasPermission} />
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-9 rounded-lg" onClick={resetLayout}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  إعادة تعيين
                </Button>
                <Button size="sm" className="gap-1.5 rounded-lg h-9 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => setEditMode(false)}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  تم التخصيص
                </Button>
                {saving && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground animate-pulse">
                    <Save className="w-3 h-3 me-1" />حفظ...
                  </Badge>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          /* ── Normal Actions Bar ── */
          <motion.div
            key="normal-toolbar"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 flex-wrap"
          >
            <Button
              size="sm"
              className="gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground shadow-sm rounded-lg h-9"
              onClick={() => setQuickInvoiceOpen(true)}
            >
              <Zap className="w-3.5 h-3.5" />
              فاتورة سريعة
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-lg h-9" onClick={() => navigate("/dashboard/reports")}>
              <BarChart3 className="w-3.5 h-3.5" />
              التقارير
            </Button>

            {/* Customize button — desktop only */}
            {!isMobile && (
              <div className="ms-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-lg h-9"
                  onClick={() => setEditMode(true)}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  تخصيص لوحة التحكم
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Content ═══ */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-[200px] rounded-xl" />
            <Skeleton className="h-[200px] rounded-xl" />
          </div>
        </div>
      ) : editMode ? (
        /* ── Editable Grid Mode ── */
        <div ref={containerRef as any} className="edit-mode-grid">
          <style>{`
            .edit-mode-grid .react-grid-item > div {
              height: 100%;
            }
            .edit-mode-grid .widget-inner {
              height: 100%;
            }
            /* Only the top-level Card should fill height, not its descendants */
            .edit-mode-grid .widget-inner > div[class] {
              height: 100%;
              display: flex;
              flex-direction: column;
            }
            .edit-mode-grid .react-resizable-handle {
              z-index: 20;
            }
          `}</style>
          <ResponsiveGridLayout
            className="layout"
            width={width || 1200}
            layouts={{ lg: gridLayout, md: gridLayout, sm: gridLayout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 8, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={60}
            dragConfig={{ enabled: !isMobile, handle: ".widget-drag-handle" }}
            resizeConfig={{ enabled: !isMobile, handles: ["se"] }}
            compactor={verticalCompactor}
            onLayoutChange={(l: any) => onLayoutChange(l)}
            margin={[14, 14] as [number, number]}
          >
            {visibleLayout.map((item) => {
              const Comp = WIDGET_COMPONENTS[item.i];
              const def = WIDGET_REGISTRY.find((w) => w.id === item.i);
              if (!Comp) return null;
              return (
                <div key={item.i} className="relative group h-full">
                  {/* Edit overlay frame */}
                  <div className="absolute inset-0 rounded-xl border-2 border-dashed border-accent/20 group-hover:border-accent/50 transition-colors pointer-events-none z-[5]" />
                  
                  {/* Widget label badge */}
                  <div className="absolute -top-2.5 inset-x-0 z-10 pointer-events-none flex justify-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent-foreground bg-accent px-2.5 py-0.5 rounded-full shadow-sm">
                      {def?.icon && <def.icon className="w-3 h-3" />}
                      {def?.labelAr}
                    </span>
                  </div>

                  {/* Drag handle */}
                  <div className="widget-drag-handle absolute top-2 start-2 z-10 cursor-grab active:cursor-grabbing p-1.5 rounded-lg bg-card border border-border/50 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <Grip className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveWidget(item.i)}
                    className="absolute top-2 end-2 z-10 p-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 shadow-sm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <div className="widget-inner overflow-hidden rounded-xl">
                    <Comp stats={data?.stats || {}} activities={data?.activities} monthlyData={data?.monthlyData} />
                  </div>
                </div>
              );
            })}
          </ResponsiveGridLayout>
        </div>
      ) : (
        /* ── Static Clean Layout ── */
        <div className="space-y-5">
          {/* KPI Row */}
          {kpiWidgets.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
            >
              {kpiWidgets.map((id, i) => {
                const Comp = WIDGET_COMPONENTS[id];
                if (!Comp) return null;
                return (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                  >
                    <Comp stats={data?.stats || {}} activities={data?.activities} monthlyData={data?.monthlyData} />
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Alerts */}
          {wideWidgets.includes("alerts") && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              {(() => {
                const Comp = WIDGET_COMPONENTS["alerts"];
                return Comp ? <Comp stats={data?.stats || {}} activities={data?.activities} monthlyData={data?.monthlyData} /> : null;
              })()}
            </motion.div>
          )}

          {/* Secondary KPIs (Collection + Customers) */}
          {secondaryWidgets.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
            >
              {secondaryWidgets.map((id) => {
                const Comp = WIDGET_COMPONENTS[id];
                if (!Comp) return null;
                return <Comp key={id} stats={data?.stats || {}} activities={data?.activities} monthlyData={data?.monthlyData} />;
              })}
            </motion.div>
          )}

          {/* Charts */}
          {wideWidgets.includes("charts") && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              {(() => {
                const Comp = WIDGET_COMPONENTS["charts"];
                return Comp ? <Comp stats={data?.stats || {}} activities={data?.activities} monthlyData={data?.monthlyData} /> : null;
              })()}
            </motion.div>
          )}

          {/* Activity + Payroll row */}
          {(wideWidgets.includes("activity") || wideWidgets.includes("payroll")) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              {wideWidgets.includes("activity") && (() => {
                const Comp = WIDGET_COMPONENTS["activity"];
                return Comp ? <Comp stats={data?.stats || {}} activities={data?.activities} monthlyData={data?.monthlyData} /> : null;
              })()}
              {wideWidgets.includes("payroll") && (() => {
                const Comp = WIDGET_COMPONENTS["payroll"];
                return Comp ? <Comp stats={data?.stats || {}} activities={data?.activities} monthlyData={data?.monthlyData} /> : null;
              })()}
            </motion.div>
          )}
        </div>
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
