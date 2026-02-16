import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Zap, CreditCard, Receipt, FileText, ShoppingCart, Package,
  CheckCircle2, Clock, AlertTriangle, Keyboard,
} from "lucide-react";

interface PendingItem {
  id: string;
  type: "invoice" | "expense" | "quotation" | "purchase_order" | "sales_order";
  number: string;
  label: string;
  amount: number;
  date: string;
  status: string;
}

const AccountantDashboard = () => {
  const { t, currentLang } = useLanguage();
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const isRTL = currentLang === "ar";

  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [stats, setStats] = useState({ pending: 0, overdue: 0, today: 0 });

  const fetchPending = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const items: PendingItem[] = [];

    const [invoices, expenses, quotations, purchaseOrders] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, invoice_number, grand_total, invoice_date, status")
        .eq("tenant_id", tenantId)
        .in("status", ["draft", "issued"])
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("expenses")
        .select("id, expense_number, title, total_amount, expense_date, status")
        .eq("tenant_id", tenantId)
        .in("status", ["draft", "pending"])
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("quotations")
        .select("id, quotation_number, grand_total, created_at, status")
        .eq("tenant_id", tenantId)
        .in("status", ["draft", "sent"])
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("purchase_orders")
        .select("id, order_number, grand_total, order_date, status")
        .eq("tenant_id", tenantId)
        .in("status", ["draft", "pending"])
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    invoices.data?.forEach((i) =>
      items.push({
        id: i.id, type: "invoice", number: i.invoice_number,
        label: isRTL ? "فاتورة" : "Invoice",
        amount: i.grand_total, date: i.invoice_date, status: i.status,
      })
    );
    expenses.data?.forEach((e) =>
      items.push({
        id: e.id, type: "expense", number: e.expense_number,
        label: e.title || (isRTL ? "مصروف" : "Expense"),
        amount: e.total_amount, date: e.expense_date, status: e.status,
      })
    );
    quotations.data?.forEach((q) =>
      items.push({
        id: q.id, type: "quotation", number: q.quotation_number,
        label: isRTL ? "عرض سعر" : "Quotation",
        amount: q.grand_total, date: q.created_at?.split("T")[0] || "", status: q.status,
      })
    );
    purchaseOrders.data?.forEach((po) =>
      items.push({
        id: po.id, type: "purchase_order", number: po.order_number,
        label: isRTL ? "أمر شراء" : "Purchase Order",
        amount: po.grand_total, date: po.order_date, status: po.status,
      })
    );

    setPendingItems(items);
    setStats({
      pending: items.length,
      overdue: invoices.data?.filter(i => i.status === "issued").length || 0,
      today: items.filter(i => i.date === new Date().toISOString().split("T")[0]).length,
    });
    setLoading(false);
  }, [tenantId, isRTL]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "a" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        setSelectedIds(new Set(pendingItems.map((i) => i.id)));
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pendingItems]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === pendingItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingItems.map((i) => i.id)));
    }
  };

  const bulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setApproving(true);

    const selected = pendingItems.filter((i) => selectedIds.has(i.id));
    const grouped: Record<string, string[]> = {};
    selected.forEach((i) => {
      if (!grouped[i.type]) grouped[i.type] = [];
      grouped[i.type].push(i.id);
    });

    const tableMap: Record<string, string> = {
      invoice: "invoices",
      expense: "expenses",
      quotation: "quotations",
      purchase_order: "purchase_orders",
      sales_order: "sales_orders",
    };

    const statusMap: Record<string, string> = {
      invoice: "issued",
      expense: "approved",
      quotation: "approved",
      purchase_order: "approved",
      sales_order: "confirmed",
    };

    const promises = Object.entries(grouped).map(([type, ids]) => {
      const table = tableMap[type];
      const newStatus = statusMap[type];
      return supabase
        .from(table as any)
        .update({ status: newStatus })
        .in("id", ids);
    });

    await Promise.all(promises);
    toast.success(isRTL ? `تم اعتماد ${selectedIds.size} عنصر` : `${selectedIds.size} items approved`);
    setSelectedIds(new Set());
    setApproving(false);
    fetchPending();
  };

  const typeIcons: Record<string, any> = {
    invoice: CreditCard,
    expense: Receipt,
    quotation: FileText,
    purchase_order: Package,
    sales_order: ShoppingCart,
  };

  const typeColors: Record<string, string> = {
    invoice: "bg-primary/10 text-primary",
    expense: "bg-destructive/10 text-destructive",
    quotation: "bg-accent/10 text-accent",
    purchase_order: "bg-secondary text-secondary-foreground",
    sales_order: "bg-muted text-muted-foreground",
  };

  return (
    <div className="p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-accent" />
            {isRTL ? "وضع الإنتاجية" : "Productivity Mode"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? "مهامك المعلقة وإجراءات سريعة" : "Your pending tasks & quick actions"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="hidden md:inline-flex h-6 items-center gap-1 rounded border border-border bg-muted px-2 text-[10px] font-medium text-muted-foreground">
            <Keyboard className="h-3 w-3" /> ⌘K
          </kbd>
          <span className="text-xs text-muted-foreground hidden md:inline">
            {isRTL ? "لوحة الأوامر" : "Command Palette"}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Clock className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">{isRTL ? "مهام معلقة" : "Pending Tasks"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.overdue}</p>
              <p className="text-xs text-muted-foreground">{isRTL ? "بحاجة لمتابعة" : "Need Attention"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <CheckCircle2 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.today}</p>
              <p className="text-xs text-muted-foreground">{isRTL ? "مهام اليوم" : "Today's Tasks"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 p-3">
          <span className="text-sm font-medium text-foreground">
            {isRTL
              ? `تم تحديد ${selectedIds.size} عنصر`
              : `${selectedIds.size} items selected`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              {isRTL ? "إلغاء التحديد" : "Deselect"}
            </Button>
            <Button size="sm" onClick={bulkApprove} disabled={approving}>
              <CheckCircle2 className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {approving
                ? (isRTL ? "جاري الاعتماد..." : "Approving...")
                : (isRTL ? "اعتماد الكل" : "Approve All")}
            </Button>
          </div>
        </div>
      )}

      {/* Pending Items */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {isRTL ? "المهام المعلقة" : "Pending Tasks"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={selectAll}>
              {selectedIds.size === pendingItems.length
                ? (isRTL ? "إلغاء الكل" : "Deselect All")
                : (isRTL ? "تحديد الكل" : "Select All")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              {isRTL ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : pendingItems.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-accent/40 mb-3" />
              <p className="text-muted-foreground">
                {isRTL ? "لا توجد مهام معلقة 🎉" : "No pending tasks 🎉"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingItems.map((item) => {
                const Icon = typeIcons[item.type] || FileText;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => toggleSelect(item.id)}
                  >
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className={`flex h-8 w-8 items-center justify-center rounded-md ${typeColors[item.type]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{item.number}</span>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {item.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {item.amount.toLocaleString()} <span className="text-xs text-muted-foreground">SAR</span>
                      </p>
                      <Badge variant="secondary" className="text-[10px]">{item.status}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts Reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            {isRTL ? "اختصارات لوحة المفاتيح" : "Keyboard Shortcuts"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {[
              { keys: "⌘ + K", desc: isRTL ? "لوحة الأوامر" : "Command Palette" },
              { keys: "⌘ + ⇧ + A", desc: isRTL ? "تحديد الكل" : "Select All" },
              { keys: "↑ ↓", desc: isRTL ? "تنقل بين العناصر" : "Navigate Items" },
            ].map((s) => (
              <div key={s.keys} className="flex items-center gap-2">
                <kbd className="inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">
                  {s.keys}
                </kbd>
                <span className="text-muted-foreground">{s.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountantDashboard;
