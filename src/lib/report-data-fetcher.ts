/**
 * Report Data Fetcher — Executes queries for each report type
 * Returns read-only row arrays. All data is cached in-memory per session.
 */
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, startOfQuarter, endOfQuarter } from "date-fns";

export type CurrencyDisplayMode = "original" | "base";

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  branchId?: string;
  customerId?: string;
  costCenterId?: string;
  profitCenterId?: string;
  currencyCode?: string;
  currencyDisplayMode?: CurrencyDisplayMode;
}

const cache = new Map<string, { data: any[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (reportKey: string, tenantId: string, filters: ReportFilters) =>
  `${reportKey}:${tenantId}:${JSON.stringify(filters)}`;

const cached = (key: string): any[] | null => {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
};

const store = (key: string, data: any[]) => {
  cache.set(key, { data, ts: Date.now() });
  return data;
};

export const clearReportCache = () => cache.clear();

// ── Helper: group by month ──
const groupByMonth = <T extends Record<string, any>>(
  items: T[],
  dateKey: string,
  aggregator: (group: T[]) => Record<string, any>
) => {
  const map: Record<string, T[]> = {};
  items.forEach((item) => {
    const d = new Date(item[dateKey]);
    const key = format(d, "yyyy-MM");
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return Object.entries(map)
    .map(([month, group]) => ({ month, period: month, ...aggregator(group) }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

const groupByDay = <T extends Record<string, any>>(
  items: T[],
  dateKey: string,
  aggregator: (group: T[]) => Record<string, any>
) => {
  const map: Record<string, T[]> = {};
  items.forEach((item) => {
    const d = item[dateKey];
    if (!map[d]) map[d] = [];
    map[d].push(item);
  });
  return Object.entries(map)
    .map(([date, group]) => ({ date, ...aggregator(group) }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const sum = (arr: any[], key: string) => arr.reduce((s, i) => s + (Number(i[key]) || 0), 0);
const fmt = (n: number) => Math.round(n * 100) / 100;

const STATUS_AR: Record<string, string> = {
  draft: "مسودة", issued: "صادرة", sent: "مرسلة", paid: "مدفوعة",
  cancelled: "ملغاة", overdue: "متأخرة", approved: "معتمد",
  rejected: "مرفوض", pending: "معلق", active: "نشط", signed: "موقع",
  expired: "منتهي", partial: "جزئي", fulfilled: "مكتمل", unfulfilled: "غير مكتمل",
};

// ── Main Fetcher ──
export const fetchReportData = async (
  reportKey: string,
  tenantId: string,
  filters: ReportFilters
): Promise<any[]> => {
  const ck = getCacheKey(reportKey, tenantId, filters);
  const hit = cached(ck);
  if (hit) return hit;

  const { dateFrom, dateTo, branchId, customerId, costCenterId, profitCenterId, currencyCode, currencyDisplayMode } = filters;
  const useBase = currencyDisplayMode === "base";

  // Helper: normalize currency amounts — if base mode, multiply by exchange_rate_at_creation
  const normalizeCurrencyFields = (row: any, amountFields: string[]) => {
    if (!useBase) return row;
    const rate = Number(row.exchange_rate_at_creation) || 1;
    const normalized = { ...row };
    for (const field of amountFields) {
      if (normalized[field] != null) {
        normalized[field] = Math.round(Number(normalized[field]) * rate * 100) / 100;
      }
    }
    return normalized;
  };

  // ─── INVOICES base query ───
  const fetchInvoices = async () => {
    let q = supabase
      .from("invoices")
      .select("*, customers(name, vat_number)")
      .eq("tenant_id", tenantId)
      .gte("invoice_date", dateFrom)
      .lte("invoice_date", dateTo);
    if (branchId) q = q.eq("branch_id", branchId);
    if (customerId) q = q.eq("customer_id", customerId);
    if (costCenterId) q = q.eq("cost_center_id", costCenterId);
    if (profitCenterId) q = q.eq("profit_center_id", profitCenterId);
    if (currencyCode) q = (q as any).eq("currency_code", currencyCode);
    const { data } = await q.order("invoice_date", { ascending: true });
    return (data || []).map((inv: any) => {
      const row = normalizeCurrencyFields(inv, ["subtotal", "vat_total", "grand_total", "amount_paid", "amount_due", "base_currency_total"]);
      return {
        ...row,
        customer_name: inv.customers?.name || "—",
        vat_number: inv.customers?.vat_number || null,
      };
    });
  };

  // ─── EXPENSES base query ───
  const fetchExpenses = async () => {
    let q = supabase
      .from("expenses")
      .select("*, expense_categories(name, name_en)")
      .eq("tenant_id", tenantId)
      .gte("expense_date", dateFrom)
      .lte("expense_date", dateTo);
    if (branchId) q = q.eq("branch_id", branchId);
    if (costCenterId) q = q.eq("cost_center_id", costCenterId);
    if (profitCenterId) q = q.eq("profit_center_id", profitCenterId);
    if (currencyCode) q = (q as any).eq("currency_code", currencyCode);
    const { data } = await q.order("expense_date", { ascending: true });
    return (data || []).map((exp: any) => {
      const row = normalizeCurrencyFields(exp, ["amount", "vat_amount", "total_amount"]);
      return {
        ...row,
        category_name: exp.expense_categories?.name || "بدون فئة",
      };
    });
  };

  switch (reportKey) {
    // ═══════════ SALES ═══════════
    case "sales_summary": {
      const invoices = await fetchInvoices();
      return store(ck, groupByMonth(invoices, "invoice_date", (group) => ({
        invoice_count: group.length,
        subtotal: fmt(sum(group, "subtotal")),
        vat_total: fmt(sum(group, "vat_total")),
        grand_total: fmt(sum(group, "grand_total")),
      })));
    }

    case "sales_by_customer": {
      const invoices = await fetchInvoices();
      const map: Record<string, any[]> = {};
      invoices.forEach((inv: any) => {
        const k = inv.customer_name;
        if (!map[k]) map[k] = [];
        map[k].push(inv);
      });
      return store(ck, Object.entries(map).map(([name, items]) => ({
        customer_name: name,
        invoice_count: items.length,
        subtotal: fmt(sum(items, "subtotal")),
        grand_total: fmt(sum(items, "grand_total")),
        amount_paid: fmt(sum(items, "amount_paid")),
        amount_due: fmt(sum(items, "amount_due")),
      })).sort((a, b) => b.grand_total - a.grand_total));
    }

    case "sales_by_status": {
      const invoices = await fetchInvoices();
      const map: Record<string, any[]> = {};
      invoices.forEach((inv: any) => {
        const k = inv.status;
        if (!map[k]) map[k] = [];
        map[k].push(inv);
      });
      return store(ck, Object.entries(map).map(([status, items]) => ({
        status: STATUS_AR[status] || status,
        count: items.length,
        subtotal: fmt(sum(items, "subtotal")),
        grand_total: fmt(sum(items, "grand_total")),
      })));
    }

    case "sales_by_branch": {
      const { data: branches } = await supabase.from("branches").select("id, name").eq("tenant_id", tenantId);
      const branchMap = new Map((branches || []).map((b: any) => [b.id, b.name]));
      const invoices = await fetchInvoices();
      const map: Record<string, any[]> = {};
      invoices.forEach((inv: any) => {
        const k = inv.branch_id || "no-branch";
        if (!map[k]) map[k] = [];
        map[k].push(inv);
      });
      return store(ck, Object.entries(map).map(([bid, items]) => ({
        branch_name: branchMap.get(bid) || "الفرع الرئيسي",
        invoice_count: items.length,
        subtotal: fmt(sum(items, "subtotal")),
        grand_total: fmt(sum(items, "grand_total")),
      })));
    }

    case "revenue_monthly": {
      const invoices = await fetchInvoices();
      const paid = invoices.filter((i: any) => i.status === "paid");
      return store(ck, groupByMonth(paid, "invoice_date", (group) => ({
        invoice_count: group.length,
        revenue: fmt(sum(group, "grand_total")),
        vat: fmt(sum(group, "vat_total")),
      })));
    }

    case "top_products": {
      let q = supabase
        .from("invoice_items")
        .select("description, quantity, line_total, vat_amount, invoice_id, invoices!inner(invoice_date, tenant_id)")
        .eq("tenant_id", tenantId);
      const { data } = await q;
      const items = (data || []).filter((item: any) => {
        const d = item.invoices?.invoice_date;
        return d && d >= dateFrom && d <= dateTo;
      });
      const map: Record<string, { qty: number; rev: number; vat: number }> = {};
      items.forEach((item: any) => {
        const k = item.description;
        if (!map[k]) map[k] = { qty: 0, rev: 0, vat: 0 };
        map[k].qty += Number(item.quantity) || 0;
        map[k].rev += Number(item.line_total) || 0;
        map[k].vat += Number(item.vat_amount) || 0;
      });
      return store(ck, Object.entries(map)
        .map(([desc, v]) => ({
          description: desc,
          total_qty: v.qty,
          total_revenue: fmt(v.rev),
          total_vat: fmt(v.vat),
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 50));
    }

    case "payment_aging": {
      const invoices = await fetchInvoices();
      const unpaid = invoices.filter((i: any) => i.status !== "paid" && i.status !== "cancelled" && i.amount_due > 0);
      const today = new Date();
      return store(ck, unpaid.map((inv: any) => {
        const days = differenceInDays(today, new Date(inv.due_date));
        let bucket = "حالي";
        if (days > 0 && days <= 30) bucket = "1-30 يوم";
        else if (days > 30 && days <= 60) bucket = "31-60 يوم";
        else if (days > 60 && days <= 90) bucket = "61-90 يوم";
        else if (days > 90) bucket = "+90 يوم";
        return {
          customer_name: inv.customer_name,
          invoice_number: inv.invoice_number,
          due_date: inv.due_date,
          days_overdue: Math.max(0, days),
          amount_due: fmt(inv.amount_due),
          aging_bucket: bucket,
        };
      }).sort((a: any, b: any) => b.days_overdue - a.days_overdue));
    }

    case "daily_sales": {
      const invoices = await fetchInvoices();
      return store(ck, groupByDay(invoices, "invoice_date", (group) => ({
        invoice_count: group.length,
        total: fmt(sum(group, "grand_total")),
      })));
    }

    case "credit_notes": {
      const invoices = await fetchInvoices();
      const credits = invoices.filter((i: any) => i.invoice_type === "credit");
      return store(ck, credits.map((inv: any) => ({
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        customer_name: inv.customer_name,
        grand_total: fmt(inv.grand_total),
        status: STATUS_AR[inv.status] || inv.status,
      })));
    }

    case "unpaid_invoices": {
      const invoices = await fetchInvoices();
      const unpaid = invoices.filter((i: any) => i.status !== "paid" && i.status !== "cancelled" && i.amount_due > 0);
      return store(ck, unpaid.map((inv: any) => ({
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        customer_name: inv.customer_name,
        due_date: inv.due_date,
        grand_total: fmt(inv.grand_total),
        amount_paid: fmt(inv.amount_paid),
        amount_due: fmt(inv.amount_due),
      })));
    }

    case "quotation_conversion": {
      let q = supabase
        .from("quotations")
        .select("*, customers(name)")
        .eq("tenant_id", tenantId)
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59");
      if (branchId) q = q.eq("branch_id", branchId);
      if (customerId) q = q.eq("customer_id", customerId);
      const { data } = await q;
      const quotations = data || [];
      return store(ck, groupByMonth(quotations, "created_at", (group) => {
        const converted = group.filter((q: any) => q.converted_invoice_id);
        return {
          total_quotations: group.length,
          converted: converted.length,
          conversion_rate: group.length ? fmt((converted.length / group.length) * 100) : 0,
          total_value: fmt(sum(group, "grand_total")),
        };
      }));
    }

    case "sales_order_fulfillment": {
      let q = supabase
        .from("sales_orders")
        .select("*, customers(name)")
        .eq("tenant_id", tenantId)
        .gte("order_date", dateFrom)
        .lte("order_date", dateTo);
      if (branchId) q = q.eq("branch_id", branchId);
      if (customerId) q = q.eq("customer_id", customerId);
      const { data } = await q.order("order_date");
      return store(ck, (data || []).map((o: any) => ({
        order_number: o.order_number,
        customer_name: o.customers?.name || "—",
        order_date: o.order_date,
        fulfillment_status: STATUS_AR[o.fulfillment_status] || o.fulfillment_status,
        grand_total: fmt(o.grand_total),
      })));
    }

    // ═══════════ EXPENSES ═══════════
    case "expense_summary": {
      const expenses = await fetchExpenses();
      return store(ck, groupByMonth(expenses, "expense_date", (group) => ({
        count: group.length,
        amount: fmt(sum(group, "amount")),
        vat_amount: fmt(sum(group, "vat_amount")),
        total_amount: fmt(sum(group, "total_amount")),
      })));
    }

    case "expense_by_category": {
      const expenses = await fetchExpenses();
      const total = sum(expenses, "total_amount");
      const map: Record<string, any[]> = {};
      expenses.forEach((exp: any) => {
        const k = exp.category_name;
        if (!map[k]) map[k] = [];
        map[k].push(exp);
      });
      return store(ck, Object.entries(map).map(([cat, items]) => ({
        category_name: cat,
        count: items.length,
        amount: fmt(sum(items, "amount")),
        vat_amount: fmt(sum(items, "vat_amount")),
        total_amount: fmt(sum(items, "total_amount")),
        pct: total ? fmt((sum(items, "total_amount") / total) * 100) : 0,
      })).sort((a, b) => b.total_amount - a.total_amount));
    }

    case "expense_by_payment": {
      const expenses = await fetchExpenses();
      const map: Record<string, any[]> = {};
      expenses.forEach((exp: any) => {
        const k = exp.payment_method;
        if (!map[k]) map[k] = [];
        map[k].push(exp);
      });
      const METHODS_AR: Record<string, string> = { cash: "نقدي", bank_transfer: "تحويل بنكي", card: "بطاقة", check: "شيك" };
      return store(ck, Object.entries(map).map(([method, items]) => ({
        payment_method: METHODS_AR[method] || method,
        count: items.length,
        total_amount: fmt(sum(items, "total_amount")),
      })));
    }

    case "expense_by_branch": {
      const { data: branches } = await supabase.from("branches").select("id, name").eq("tenant_id", tenantId);
      const branchMapLocal = new Map((branches || []).map((b: any) => [b.id, b.name]));
      const expenses = await fetchExpenses();
      const map: Record<string, any[]> = {};
      expenses.forEach((exp: any) => {
        const k = exp.branch_id || "no-branch";
        if (!map[k]) map[k] = [];
        map[k].push(exp);
      });
      return store(ck, Object.entries(map).map(([bid, items]) => ({
        branch_name: branchMapLocal.get(bid) || "الفرع الرئيسي",
        count: items.length,
        amount: fmt(sum(items, "amount")),
        total_amount: fmt(sum(items, "total_amount")),
      })));
    }

    case "expense_monthly": {
      const expenses = await fetchExpenses();
      return store(ck, groupByMonth(expenses, "expense_date", (group) => ({
        count: group.length,
        amount: fmt(sum(group, "amount")),
        vat_amount: fmt(sum(group, "vat_amount")),
        total_amount: fmt(sum(group, "total_amount")),
      })));
    }

    case "expense_approval": {
      const expenses = await fetchExpenses();
      const map: Record<string, any[]> = {};
      expenses.forEach((exp: any) => {
        const k = exp.status;
        if (!map[k]) map[k] = [];
        map[k].push(exp);
      });
      return store(ck, Object.entries(map).map(([status, items]) => ({
        status: STATUS_AR[status] || status,
        count: items.length,
        total_amount: fmt(sum(items, "total_amount")),
      })));
    }

    case "purchase_order_summary": {
      let q = supabase
        .from("purchase_orders")
        .select("*, suppliers:supplier_id(name)")
        .eq("tenant_id", tenantId)
        .gte("order_date", dateFrom)
        .lte("order_date", dateTo);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q.order("order_date");
      return store(ck, (data || []).map((po: any) => ({
        order_number: po.order_number,
        supplier_name: po.suppliers?.name || "—",
        order_date: po.order_date,
        delivery_status: STATUS_AR[po.delivery_status] || po.delivery_status,
        status: STATUS_AR[po.status] || po.status,
        grand_total: fmt(po.grand_total),
      })));
    }

    // ═══════════ TAX ═══════════
    case "vat_summary": {
      const [invoices, expenses] = await Promise.all([fetchInvoices(), fetchExpenses()]);
      const months = new Set<string>();
      invoices.forEach((i: any) => months.add(format(new Date(i.invoice_date), "yyyy-MM")));
      expenses.forEach((e: any) => months.add(format(new Date(e.expense_date), "yyyy-MM")));
      return store(ck, [...months].sort().map((m) => {
        const mInv = invoices.filter((i: any) => format(new Date(i.invoice_date), "yyyy-MM") === m);
        const mExp = expenses.filter((e: any) => format(new Date(e.expense_date), "yyyy-MM") === m);
        const vatCollected = sum(mInv, "vat_total");
        const vatPaid = sum(mExp, "vat_amount");
        return {
          period: m,
          vat_collected: fmt(vatCollected),
          vat_paid: fmt(vatPaid),
          net_vat: fmt(vatCollected - vatPaid),
        };
      }));
    }

    case "vat_detailed": {
      const invoices = await fetchInvoices();
      return store(ck, invoices.filter((i: any) => i.status !== "cancelled").map((inv: any) => ({
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        customer_name: inv.customer_name,
        vat_number: inv.vat_number || "—",
        subtotal: fmt(inv.subtotal),
        vat_total: fmt(inv.vat_total),
        grand_total: fmt(inv.grand_total),
        status: STATUS_AR[inv.status] || inv.status,
      })));
    }

    case "vat_quarterly": {
      const [invoices, expenses] = await Promise.all([fetchInvoices(), fetchExpenses()]);
      const quarters = new Set<string>();
      const getQ = (d: string) => {
        const date = new Date(d);
        return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
      };
      invoices.forEach((i: any) => quarters.add(getQ(i.invoice_date)));
      expenses.forEach((e: any) => quarters.add(getQ(e.expense_date)));
      return store(ck, [...quarters].sort().map((q) => {
        const qInv = invoices.filter((i: any) => getQ(i.invoice_date) === q);
        const qExp = expenses.filter((e: any) => getQ(e.expense_date) === q);
        const vatCollected = sum(qInv, "vat_total");
        const vatPaid = sum(qExp, "vat_amount");
        return {
          quarter: q,
          sales_subtotal: fmt(sum(qInv, "subtotal")),
          vat_collected: fmt(vatCollected),
          expense_total: fmt(sum(qExp, "total_amount")),
          vat_paid: fmt(vatPaid),
          net_vat: fmt(vatCollected - vatPaid),
        };
      }));
    }

    case "zatca_compliance": {
      const invoices = await fetchInvoices();
      return store(ck, invoices.map((inv: any) => ({
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        zatca_status: STATUS_AR[inv.zatca_status] || inv.zatca_status || "—",
        zatca_clearance_status: inv.zatca_clearance_status || "—",
        grand_total: fmt(inv.grand_total),
      })));
    }

    case "tax_deviation": {
      let q = supabase
        .from("invoice_items")
        .select("description, vat_rate, line_total, invoice_id, invoices!inner(invoice_number, invoice_date, tenant_id)")
        .eq("tenant_id", tenantId)
        .neq("vat_rate", 15);
      const { data } = await q;
      const items = (data || []).filter((item: any) => {
        const d = item.invoices?.invoice_date;
        return d && d >= dateFrom && d <= dateTo;
      });
      return store(ck, items.map((item: any) => ({
        invoice_number: item.invoices?.invoice_number,
        description: item.description,
        vat_rate: item.vat_rate,
        line_total: fmt(item.line_total),
      })));
    }

    // ═══════════ CUSTOMERS ═══════════
    case "customer_list": {
      let q = supabase.from("customers").select("*").eq("tenant_id", tenantId);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q.order("name");
      return store(ck, (data || []).map((c: any) => ({
        name: c.name,
        customer_type: c.customer_type === "business" ? "شركة" : "فرد",
        email: c.email || "—",
        phone: c.phone || "—",
        vat_number: c.vat_number || "—",
        is_active: c.is_active ? "نعم" : "لا",
      })));
    }

    case "customer_balance": {
      const invoices = await fetchInvoices();
      const map: Record<string, any[]> = {};
      invoices.forEach((inv: any) => {
        const k = inv.customer_name;
        if (!map[k]) map[k] = [];
        map[k].push(inv);
      });
      return store(ck, Object.entries(map).map(([name, items]) => ({
        customer_name: name,
        total_invoices: items.length,
        total_billed: fmt(sum(items, "grand_total")),
        total_paid: fmt(sum(items, "amount_paid")),
        balance: fmt(sum(items, "amount_due")),
      })).filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance));
    }

    case "customer_activity": {
      let q = supabase
        .from("customer_activities")
        .select("*, customers(name)")
        .eq("tenant_id", tenantId)
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59");
      if (customerId) q = q.eq("customer_id", customerId);
      const { data } = await q.order("created_at", { ascending: false }).limit(200);
      return store(ck, (data || []).map((a: any) => ({
        customer_name: a.customers?.name || "—",
        activity_type: a.activity_type,
        title: a.title,
        created_at: format(new Date(a.created_at), "yyyy-MM-dd HH:mm"),
      })));
    }

    // ═══════════ INVENTORY ═══════════
    case "stock_levels": {
      let q = supabase.from("products").select("*").eq("tenant_id", tenantId).eq("is_active", true);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q.order("name");
      return store(ck, (data || []).map((p: any) => ({
        name: p.name,
        sku: p.sku || "—",
        stock_quantity: p.stock_quantity,
        low_stock_threshold: p.low_stock_threshold || 0,
        unit_price: fmt(p.unit_price),
        stock_value: fmt(p.stock_quantity * p.unit_price),
      })));
    }

    case "low_stock": {
      let q = supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("track_stock", true);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q;
      const low = (data || []).filter((p: any) => p.stock_quantity <= (p.low_stock_threshold || 0));
      return store(ck, low.map((p: any) => ({
        name: p.name,
        sku: p.sku || "—",
        stock_quantity: p.stock_quantity,
        low_stock_threshold: p.low_stock_threshold || 0,
        shortage: Math.max(0, (p.low_stock_threshold || 0) - p.stock_quantity),
      })).sort((a: any, b: any) => b.shortage - a.shortage));
    }

    case "stock_movements_report": {
      const { data: movements } = await supabase
        .from("stock_movements")
        .select("*, products(name)")
        .eq("tenant_id", tenantId)
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59")
        .order("created_at", { ascending: false })
        .limit(500);
      const TYPES_AR: Record<string, string> = { in: "وارد", out: "صادر", adjustment: "تعديل", return: "مرتجع" };
      return store(ck, (movements || []).map((m: any) => ({
        product_name: m.products?.name || "—",
        movement_type: TYPES_AR[m.movement_type] || m.movement_type,
        quantity: m.quantity,
        previous_quantity: m.previous_quantity,
        new_quantity: m.new_quantity,
        created_at: format(new Date(m.created_at), "yyyy-MM-dd HH:mm"),
      })));
    }

    case "inventory_valuation": {
      let q = supabase.from("products").select("*").eq("tenant_id", tenantId).eq("is_active", true);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q;
      const map: Record<string, any[]> = {};
      (data || []).forEach((p: any) => {
        const k = p.category || "بدون فئة";
        if (!map[k]) map[k] = [];
        map[k].push(p);
      });
      return store(ck, Object.entries(map).map(([cat, items]) => ({
        category: cat,
        product_count: items.length,
        total_stock: sum(items, "stock_quantity"),
        total_cost: fmt(items.reduce((s: number, p: any) => s + (p.stock_quantity * (p.cost_price || 0)), 0)),
        total_retail: fmt(items.reduce((s: number, p: any) => s + (p.stock_quantity * p.unit_price), 0)),
      })));
    }

    // ═══════════ CONTRACTS ═══════════
    case "contract_summary": {
      let q = supabase
        .from("contracts")
        .select("*, customers(name)")
        .eq("tenant_id", tenantId)
        .gte("start_date", dateFrom)
        .lte("start_date", dateTo);
      if (branchId) q = q.eq("branch_id", branchId);
      if (customerId) q = q.eq("customer_id", customerId);
      const { data } = await q.order("start_date");
      return store(ck, (data || []).map((c: any) => ({
        contract_number: c.contract_number,
        title: c.title,
        customer_name: c.customers?.name || "—",
        start_date: c.start_date,
        end_date: c.end_date || "—",
        status: STATUS_AR[c.status] || c.status,
        total_value: fmt(c.total_value),
      })));
    }

    case "expiring_contracts": {
      const today = new Date();
      const in90 = new Date();
      in90.setDate(in90.getDate() + 90);
      let q = supabase
        .from("contracts")
        .select("*, customers(name)")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "signed"])
        .gte("end_date", format(today, "yyyy-MM-dd"))
        .lte("end_date", format(in90, "yyyy-MM-dd"));
      if (branchId) q = q.eq("branch_id", branchId);
      if (customerId) q = q.eq("customer_id", customerId);
      const { data } = await q.order("end_date");
      return store(ck, (data || []).map((c: any) => ({
        contract_number: c.contract_number,
        title: c.title,
        customer_name: c.customers?.name || "—",
        end_date: c.end_date,
        days_remaining: differenceInDays(new Date(c.end_date), today),
        total_value: fmt(c.total_value),
      })));
    }

    // ═══════════ GENERAL ═══════════
    case "profit_loss": {
      const [invoices, expenses] = await Promise.all([fetchInvoices(), fetchExpenses()]);
      const paidInvoices = invoices.filter((i: any) => i.status === "paid");
      const approvedExpenses = expenses.filter((e: any) => e.status !== "rejected");
      const months = new Set<string>();
      paidInvoices.forEach((i: any) => months.add(format(new Date(i.invoice_date), "yyyy-MM")));
      approvedExpenses.forEach((e: any) => months.add(format(new Date(e.expense_date), "yyyy-MM")));
      return store(ck, [...months].sort().map((m) => {
        const mRev = paidInvoices.filter((i: any) => format(new Date(i.invoice_date), "yyyy-MM") === m);
        const mExp = approvedExpenses.filter((e: any) => format(new Date(e.expense_date), "yyyy-MM") === m);
        const rev = sum(mRev, "grand_total");
        const exp = sum(mExp, "total_amount");
        return {
          period: m,
          revenue: fmt(rev),
          expenses_total: fmt(exp),
          gross_profit: fmt(rev - exp),
          margin: rev ? fmt(((rev - exp) / rev) * 100) : 0,
        };
      }));
    }

    case "cash_flow": {
      const [invoices, expenses] = await Promise.all([fetchInvoices(), fetchExpenses()]);
      const months = new Set<string>();
      invoices.forEach((i: any) => months.add(format(new Date(i.invoice_date), "yyyy-MM")));
      expenses.forEach((e: any) => months.add(format(new Date(e.expense_date), "yyyy-MM")));
      return store(ck, [...months].sort().map((m) => {
        const mInv = invoices.filter((i: any) => format(new Date(i.invoice_date), "yyyy-MM") === m && i.status === "paid");
        const mExp = expenses.filter((e: any) => format(new Date(e.expense_date), "yyyy-MM") === m && e.status !== "rejected");
        const cashIn = sum(mInv, "amount_paid");
        const cashOut = sum(mExp, "total_amount");
        return {
          period: m,
          cash_in: fmt(cashIn),
          cash_out: fmt(cashOut),
          net_cash: fmt(cashIn - cashOut),
        };
      }));
    }

    case "audit_trail": {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").eq("tenant_id", tenantId);
      const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59")
        .order("created_at", { ascending: false })
        .limit(500);
      return store(ck, (data || []).map((l: any) => ({
        created_at: format(new Date(l.created_at), "yyyy-MM-dd HH:mm"),
        user_name: nameMap.get(l.user_id) || "النظام",
        action: l.action,
        entity_type: l.entity_type,
        entity_label: l.entity_label || "—",
      })));
    }

    default:
      return [];
  }
};
