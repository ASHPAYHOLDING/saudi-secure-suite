import { useEffect, useState, useMemo } from "react";
import {
  Receipt, Search, Download, Filter, DollarSign, TrendingUp,
  Building2, Calendar, FileText, ShieldCheck, BarChart3, Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  vat_total: number;
  discount_total: number;
  grand_total: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  customer_id: string;
  created_at: string;
  tenant_name?: string;
  customer_name?: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-muted text-muted-foreground" },
  issued: { label: "صادرة", color: "bg-blue-100 text-blue-700" },
  sent: { label: "مرسلة", color: "bg-indigo-100 text-indigo-700" },
  paid: { label: "مدفوعة", color: "bg-emerald-100 text-emerald-700" },
  partially_paid: { label: "مدفوعة جزئياً", color: "bg-amber-100 text-amber-700" },
  overdue: { label: "متأخرة", color: "bg-red-100 text-red-700" },
  cancelled: { label: "ملغاة", color: "bg-destructive/10 text-destructive" },
};

const TYPE_MAP: Record<string, string> = {
  tax: "ضريبية",
  simplified: "مبسطة",
  credit: "إشعار دائن",
  debit: "إشعار مدين",
};

const MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const AdminFinance = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tenantMap, setTenantMap] = useState<Record<string, string>>({});
  const [customerMap, setCustomerMap] = useState<Record<string, string>>({});
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [invoicesRes, tenantsRes, customersRes] = await Promise.all([
        supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("tenants").select("id, name"),
        supabase.from("customers").select("id, name"),
      ]);

      const tMap: Record<string, string> = {};
      tenantsRes.data?.forEach(t => { tMap[t.id] = t.name; });
      setTenantMap(tMap);

      const cMap: Record<string, string> = {};
      customersRes.data?.forEach(c => { cMap[c.id] = c.name; });
      setCustomerMap(cMap);

      if (invoicesRes.data) {
        setInvoices(invoicesRes.data.map(inv => ({
          ...inv,
          tenant_name: tMap[inv.tenant_id] || "غير معروف",
          customer_name: cMap[inv.customer_id] || "غير معروف",
        })));
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch = inv.invoice_number.includes(search) || inv.tenant_name?.includes(search) || inv.customer_name?.includes(search);
      const matchTenant = tenantFilter === "all" || inv.tenant_id === tenantFilter;
      const matchStatus = statusFilter === "all" || inv.status === statusFilter;
      const matchType = typeFilter === "all" || inv.invoice_type === typeFilter;
      const matchDateFrom = !dateFrom || inv.invoice_date >= dateFrom;
      const matchDateTo = !dateTo || inv.invoice_date <= dateTo;
      return matchSearch && matchTenant && matchStatus && matchType && matchDateFrom && matchDateTo;
    });
  }, [invoices, search, tenantFilter, statusFilter, typeFilter, dateFrom, dateTo]);

  // KPIs
  const totalRevenue = useMemo(() => filtered.reduce((s, i) => s + Number(i.grand_total), 0), [filtered]);
  const totalVAT = useMemo(() => filtered.reduce((s, i) => s + Number(i.vat_total), 0), [filtered]);
  const totalPaid = useMemo(() => filtered.reduce((s, i) => s + Number(i.amount_paid), 0), [filtered]);
  const totalDue = useMemo(() => filtered.reduce((s, i) => s + Number(i.amount_due), 0), [filtered]);
  const paidCount = useMemo(() => filtered.filter(i => i.status === "paid").length, [filtered]);
  const overdueCount = useMemo(() => filtered.filter(i => i.status === "overdue").length, [filtered]);

  // Monthly revenue chart
  const revenueChartData = useMemo(() => {
    const data: Record<string, { month: string; revenue: number; vat: number; count: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      data[key] = { month: MONTH_NAMES[d.getMonth()], revenue: 0, vat: 0, count: 0 };
    }
    invoices.forEach(inv => {
      const key = inv.invoice_date.slice(0, 7);
      if (data[key]) {
        data[key].revenue += Number(inv.grand_total);
        data[key].vat += Number(inv.vat_total);
        data[key].count += 1;
      }
    });
    return Object.values(data);
  }, [invoices]);

  // Tenant revenue breakdown
  const tenantRevenueData = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; vat: number; count: number }> = {};
    filtered.forEach(inv => {
      const name = inv.tenant_name || "غير معروف";
      if (!map[inv.tenant_id]) map[inv.tenant_id] = { name, revenue: 0, vat: 0, count: 0 };
      map[inv.tenant_id].revenue += Number(inv.grand_total);
      map[inv.tenant_id].vat += Number(inv.vat_total);
      map[inv.tenant_id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filtered]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(inv => { map[inv.status] = (map[inv.status] || 0) + 1; });
    return Object.entries(map).map(([k, v]) => ({ status: STATUS_MAP[k]?.label || k, count: v }));
  }, [filtered]);

  const exportCSV = () => {
    const headers = ["رقم الفاتورة", "المنشأة", "العميل", "النوع", "الحالة", "التاريخ", "الاستحقاق", "الإجمالي", "الضريبة", "المدفوع", "المتبقي", "العملة"];
    const rows = filtered.map(i => [
      i.invoice_number, i.tenant_name || "", i.customer_name || "",
      TYPE_MAP[i.invoice_type] || i.invoice_type, STATUS_MAP[i.status]?.label || i.status,
      i.invoice_date, i.due_date,
      String(i.grand_total), String(i.vat_total), String(i.amount_paid), String(i.amount_due), i.currency,
    ]);
    const bom = "\uFEFF";
    const csv = bom + [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "تم التصدير", description: `تم تصدير ${filtered.length} فاتورة` });
  };

  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="text-accent" size={28} />
            المراقبة المالية
          </h1>
          <p className="text-sm text-muted-foreground">عرض الفواتير والإيرادات والضرائب على مستوى المنصة — للقراءة فقط</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1 text-xs"><ShieldCheck size={12} /> وضع المراقبة</Badge>
          <Button variant="outline" onClick={exportCSV} className="gap-2">
            <Download size={16} /> تصدير
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-100 p-2"><DollarSign size={20} className="text-emerald-600" /></div>
            <div>
              <p className="text-lg font-bold">{fmt(totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">إجمالي الإيرادات</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-red-100 p-2"><Receipt size={20} className="text-red-600" /></div>
            <div>
              <p className="text-lg font-bold">{fmt(totalVAT)}</p>
              <p className="text-xs text-muted-foreground">إجمالي الضريبة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-100 p-2"><TrendingUp size={20} className="text-blue-600" /></div>
            <div>
              <p className="text-lg font-bold">{fmt(totalPaid)}</p>
              <p className="text-xs text-muted-foreground">المحصّل</p>
            </div>
          </CardContent>
        </Card>
        <Card className={totalDue > 0 ? "border-amber-200" : ""}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`rounded-lg p-2 ${totalDue > 0 ? "bg-amber-100" : "bg-muted"}`}>
              <Calendar size={20} className={totalDue > 0 ? "text-amber-600" : "text-muted-foreground"} />
            </div>
            <div>
              <p className="text-lg font-bold">{fmt(totalDue)}</p>
              <p className="text-xs text-muted-foreground">المتبقي</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-purple-100 p-2"><FileText size={20} className="text-purple-600" /></div>
            <div>
              <p className="text-lg font-bold">{filtered.length}</p>
              <p className="text-xs text-muted-foreground">إجمالي الفواتير</p>
            </div>
          </CardContent>
        </Card>
        <Card className={overdueCount > 0 ? "border-destructive/50" : ""}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`rounded-lg p-2 ${overdueCount > 0 ? "bg-destructive/10" : "bg-muted"}`}>
              <BarChart3 size={20} className={overdueCount > 0 ? "text-destructive" : "text-muted-foreground"} />
            </div>
            <div>
              <p className="text-lg font-bold">{overdueCount}</p>
              <p className="text-xs text-muted-foreground">متأخرة</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">📋 الفواتير</TabsTrigger>
          <TabsTrigger value="analytics">📊 تحليلات الإيرادات</TabsTrigger>
          <TabsTrigger value="compliance">✅ الامتثال الضريبي</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Invoices ─── */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input placeholder="بحث برقم الفاتورة أو المنشأة أو العميل..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
            </div>
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="كل المنشآت" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المنشآت</SelectItem>
                {Object.entries(tenantMap).map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {Object.entries(TYPE_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" placeholder="من تاريخ" />
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" placeholder="إلى تاريخ" />
          </div>

          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم الفاتورة</TableHead>
                    <TableHead className="text-right">المنشأة</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-center">النوع</TableHead>
                    <TableHead className="text-center">الحالة</TableHead>
                    <TableHead className="text-center">التاريخ</TableHead>
                    <TableHead className="text-left">الإجمالي</TableHead>
                    <TableHead className="text-left">الضريبة</TableHead>
                    <TableHead className="text-left">المتبقي</TableHead>
                    <TableHead className="text-center">عرض</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(inv => {
                    const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm font-medium">{inv.invoice_number}</TableCell>
                        <TableCell className="text-sm">{inv.tenant_name}</TableCell>
                        <TableCell className="text-sm">{inv.customer_name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">{TYPE_MAP[inv.invoice_type] || inv.invoice_type}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs ${st.color}`}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {new Date(inv.invoice_date).toLocaleDateString("ar-SA")}
                        </TableCell>
                        <TableCell className="text-left font-medium text-sm">{fmt(Number(inv.grand_total))}</TableCell>
                        <TableCell className="text-left text-sm text-muted-foreground">{fmt(Number(inv.vat_total))}</TableCell>
                        <TableCell className={`text-left text-sm ${Number(inv.amount_due) > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                          {fmt(Number(inv.amount_due))}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" variant="ghost" onClick={() => setDetailInvoice(inv)}>
                            <Eye size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">لا توجد فواتير</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* ─── Tab 2: Revenue Analytics ─── */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">اتجاه الإيرادات الشهري</CardTitle>
                <CardDescription>آخر 6 أشهر — الإيرادات والضريبة</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="finRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="finVatGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip formatter={(v: number) => fmt(v) + " ر.س"} />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke="hsl(var(--accent))" fill="url(#finRevGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="vat" name="الضريبة" stroke="hsl(var(--destructive))" fill="url(#finVatGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">عدد الفواتير الشهري</CardTitle>
                <CardDescription>آخر 6 أشهر</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="count" name="عدد الفواتير" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top tenants by revenue */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">أعلى المنشآت إيراداً</CardTitle>
              <CardDescription>أعلى 10 منشآت حسب إجمالي الفواتير</CardDescription>
            </CardHeader>
            <CardContent>
              {tenantRevenueData.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">لا توجد بيانات</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">#</TableHead>
                      <TableHead className="text-right">المنشأة</TableHead>
                      <TableHead className="text-center">عدد الفواتير</TableHead>
                      <TableHead className="text-left">الإيرادات</TableHead>
                      <TableHead className="text-left">الضريبة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenantRevenueData.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-center">{t.count}</TableCell>
                        <TableCell className="text-left font-medium">{fmt(t.revenue)} ر.س</TableCell>
                        <TableCell className="text-left text-muted-foreground">{fmt(t.vat)} ر.س</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 3: Compliance ─── */}
        <TabsContent value="compliance" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-foreground">{fmt(totalVAT)}</p>
                <p className="text-sm text-muted-foreground mt-1">إجمالي ضريبة القيمة المضافة</p>
                <p className="text-xs text-muted-foreground">ر.س</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-foreground">
                  {filtered.length > 0 ? (totalVAT / totalRevenue * 100).toFixed(1) : "0"}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">نسبة الضريبة الفعلية</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-foreground">
                  {filtered.filter(i => i.invoice_type === "tax").length}
                </p>
                <p className="text-sm text-muted-foreground mt-1">فواتير ضريبية</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-foreground">
                  {filtered.filter(i => i.invoice_type === "simplified").length}
                </p>
                <p className="text-sm text-muted-foreground mt-1">فواتير مبسطة</p>
              </CardContent>
            </Card>
          </div>

          {/* Status distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">توزيع حالات الفواتير</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={statusDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="status" type="category" className="text-xs" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" name="العدد" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* VAT by tenant */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">الضريبة حسب المنشأة</CardTitle>
              <CardDescription>تفصيل ضريبة القيمة المضافة لكل منشأة</CardDescription>
            </CardHeader>
            <CardContent>
              {tenantRevenueData.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">لا توجد بيانات</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المنشأة</TableHead>
                      <TableHead className="text-left">المبيعات (قبل الضريبة)</TableHead>
                      <TableHead className="text-left">الضريبة</TableHead>
                      <TableHead className="text-left">النسبة الفعلية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenantRevenueData.map((t, i) => {
                      const net = t.revenue - t.vat;
                      const rate = net > 0 ? ((t.vat / net) * 100).toFixed(1) : "0";
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell className="text-left">{fmt(net)} ر.س</TableCell>
                          <TableCell className="text-left">{fmt(t.vat)} ر.س</TableCell>
                          <TableCell className="text-left">
                            <Badge variant="outline" className={Number(rate) >= 14.5 && Number(rate) <= 15.5 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>
                              {rate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Invoice Detail Dialog ─── */}
      <Dialog open={!!detailInvoice} onOpenChange={() => setDetailInvoice(null)}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={18} className="text-accent" />
              تفاصيل الفاتورة
            </DialogTitle>
          </DialogHeader>
          {detailInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">رقم الفاتورة</p>
                  <p className="font-mono font-medium">{detailInvoice.invoice_number}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">النوع</p>
                  <p>{TYPE_MAP[detailInvoice.invoice_type] || detailInvoice.invoice_type}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">المنشأة</p>
                  <p className="font-medium">{detailInvoice.tenant_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">العميل</p>
                  <p className="font-medium">{detailInvoice.customer_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">تاريخ الإصدار</p>
                  <p>{new Date(detailInvoice.invoice_date).toLocaleDateString("ar-SA")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">تاريخ الاستحقاق</p>
                  <p>{new Date(detailInvoice.due_date).toLocaleDateString("ar-SA")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">الحالة</p>
                  <Badge className={`text-xs ${(STATUS_MAP[detailInvoice.status] || STATUS_MAP.draft).color}`}>
                    {(STATUS_MAP[detailInvoice.status] || STATUS_MAP.draft).label}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">العملة</p>
                  <p>{detailInvoice.currency}</p>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المبلغ قبل الضريبة</span>
                  <span>{fmt(Number(detailInvoice.subtotal))} ر.س</span>
                </div>
                {Number(detailInvoice.discount_total) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">الخصم</span>
                    <span className="text-destructive">-{fmt(Number(detailInvoice.discount_total))} ر.س</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ضريبة القيمة المضافة</span>
                  <span>{fmt(Number(detailInvoice.vat_total))} ر.س</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>الإجمالي</span>
                  <span>{fmt(Number(detailInvoice.grand_total))} ر.س</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المدفوع</span>
                  <span className="text-emerald-600">{fmt(Number(detailInvoice.amount_paid))} ر.س</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المتبقي</span>
                  <span className={Number(detailInvoice.amount_due) > 0 ? "text-amber-600 font-medium" : ""}>{fmt(Number(detailInvoice.amount_due))} ر.س</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFinance;
