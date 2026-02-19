import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users, Plus, Search, Edit2, Trash2, X, Building2, User, Phone, Mail,
  MapPin, FileText, Save, Loader2, Eye, Filter, Download, Upload,
  CheckSquare, Square, ChevronUp, ChevronDown, ChevronsUpDown,
  UserCheck, Tag, RefreshCw, XCircle, AlertTriangle, Star, Crown,
  TrendingDown, DollarSign, Receipt, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import CustomerProfile from "./CustomerProfile";
import * as XLSX from "xlsx";

type Customer = Tables<"customers"> & { segment?: string; credit_limit?: number | null };

interface CustomerForm {
  name: string; name_en: string; customer_type: string; email: string;
  phone: string; cr_number: string; vat_number: string;
  address_street: string; address_city: string; address_zip: string;
  notes: string; tags: string; segment: string; credit_limit: string;
}

const emptyForm: CustomerForm = {
  name: "", name_en: "", customer_type: "business", email: "", phone: "",
  cr_number: "", vat_number: "", address_street: "", address_city: "",
  address_zip: "", notes: "", tags: "", segment: "standard", credit_limit: "",
};

type SortField = "name" | "customer_type" | "address_city" | "created_at";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 15;

interface CustomerStats {
  total: number; newThisMonth: number; businesses: number; individuals: number;
  atRisk: number; vip: number;
}

interface InvoiceSummary { customer_id: string; total_sales: number; outstanding: number; last_purchase: string | null; }

const SEGMENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  standard:  { label: "عادي",    icon: User,   color: "bg-secondary text-muted-foreground" },
  premium:   { label: "مميز",    icon: Star,   color: "bg-warning/10 text-warning" },
  vip:       { label: "VIP",     icon: Crown,  color: "bg-accent/10 text-accent" },
  inactive:  { label: "خامل",   icon: TrendingDown, color: "bg-destructive/10 text-destructive" },
};

const StatCard = ({ icon: Icon, label, value, sub, color, alert }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; alert?: boolean;
}) => (
  <div className={`rounded-xl border bg-card p-4 flex items-start gap-3 ${alert ? "border-destructive/40" : "border-border"}`}>
    <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
      <Icon size={16} className="opacity-80" />
    </div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  </div>
);

const CustomersPage = () => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoiceSummaries, setInvoiceSummaries] = useState<Record<string, InvoiceSummary>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<"" | "business" | "individual">("");
  const [filterCity, setFilterCity] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "inactive">("");
  const [filterSegment, setFilterSegment] = useState("");
  const [filterAtRisk, setFilterAtRisk] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  // Bulk
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");

  const [stats, setStats] = useState<CustomerStats>({ total: 0, newThisMonth: 0, businesses: 0, individuals: 0, atRisk: 0, vip: 0 });

  const fetchCustomers = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("customers").select("*").eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const cList = data as Customer[];
      setCustomers(cList);
      const now = new Date();
      const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(now.getDate() - 90);
      setStats({
        total: cList.length,
        newThisMonth: cList.filter(c => { const d = new Date(c.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length,
        businesses: cList.filter(c => c.customer_type === "business").length,
        individuals: cList.filter(c => c.customer_type === "individual").length,
        atRisk: 0, // will update after invoice fetch
        vip: cList.filter(c => (c as any).segment === "vip").length,
      });
    }
    setLoading(false);
  }, [tenantId]);

  const fetchInvoiceSummaries = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("invoices")
      .select("customer_id, grand_total, amount_due, status, invoice_date")
      .eq("tenant_id", tenantId);
    if (!data) return;
    const map: Record<string, InvoiceSummary> = {};
    for (const inv of data) {
      if (!inv.customer_id) continue;
      if (!map[inv.customer_id]) map[inv.customer_id] = { customer_id: inv.customer_id, total_sales: 0, outstanding: 0, last_purchase: null };
      map[inv.customer_id].total_sales += Number(inv.grand_total) || 0;
      map[inv.customer_id].outstanding += Number(inv.amount_due) || 0;
      const d = inv.invoice_date;
      if (!map[inv.customer_id].last_purchase || d > map[inv.customer_id].last_purchase!) map[inv.customer_id].last_purchase = d;
    }
    setInvoiceSummaries(map);
    // Update atRisk count
    const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const atRisk = Object.values(map).filter(s => s.last_purchase && new Date(s.last_purchase) < ninetyDaysAgo).length;
    setStats(prev => ({ ...prev, atRisk }));
  }, [tenantId]);

  useEffect(() => {
    fetchCustomers();
    fetchInvoiceSummaries();
    const ch = supabase.channel("customers-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, fetchCustomers)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchCustomers, fetchInvoiceSummaries]);

  const cities = useMemo(() => {
    const set = new Set(customers.map(c => c.address_city).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [customers]);

  const isAtRisk = (customerId: string) => {
    const s = invoiceSummaries[customerId];
    if (!s?.last_purchase) return false;
    const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return new Date(s.last_purchase) < ninetyDaysAgo;
  };

  const isCreditExceeded = (c: Customer) => {
    const s = invoiceSummaries[c.id];
    const limit = (c as any).credit_limit;
    return limit && s && s.outstanding > limit;
  };

  const filtered = useMemo(() => {
    let list = customers.filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.name_en || "").toLowerCase().includes(q)
        || (c.email || "").toLowerCase().includes(q) || (c.phone || "").includes(q) || (c.cr_number || "").includes(q);
      const matchType = !filterType || c.customer_type === filterType;
      const matchCity = !filterCity || c.address_city === filterCity;
      const matchStatus = !filterStatus || (filterStatus === "active" ? c.is_active : !c.is_active);
      const matchSegment = !filterSegment || (c as any).segment === filterSegment;
      const matchRisk = !filterAtRisk || isAtRisk(c.id);
      return matchSearch && matchType && matchCity && matchStatus && matchSegment && matchRisk;
    });
    list.sort((a, b) => {
      const av = (a[sortField] || "") as string; const bv = (b[sortField] || "") as string;
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [customers, search, filterType, filterCity, filterStatus, filterSegment, filterAtRisk, sortField, sortDir, invoiceSummaries]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
    setPage(1);
  };
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown size={12} className="text-muted-foreground/40" />;
    return sortDir === "asc" ? <ChevronUp size={12} className="text-accent" /> : <ChevronDown size={12} className="text-accent" />;
  };

  const allSelected = paginated.length > 0 && paginated.every(c => selected.has(c.id));
  const toggleAll = () => {
    if (allSelected) setSelected(prev => { const n = new Set(prev); paginated.forEach(c => n.delete(c.id)); return n; });
    else setSelected(prev => { const n = new Set(prev); paginated.forEach(c => n.add(c.id)); return n; });
  };
  const toggleOne = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleBulkAction = async () => {
    if (!bulkAction || selected.size === 0) return;
    const ids = Array.from(selected);
    if (bulkAction === "delete") { setConfirmBulkDelete(true); return; }
    if (bulkAction === "activate") {
      await supabase.from("customers").update({ is_active: true }).in("id", ids);
      toast({ title: `تم تفعيل ${ids.length} عميل` }); setSelected(new Set()); fetchCustomers();
    } else if (bulkAction === "deactivate") {
      await supabase.from("customers").update({ is_active: false }).in("id", ids);
      toast({ title: `تم تعطيل ${ids.length} عميل` }); setSelected(new Set()); fetchCustomers();
    } else if (bulkAction === "make_vip") {
      await (supabase as any).from("customers").update({ segment: "vip" }).in("id", ids);
      toast({ title: `تم ترقية ${ids.length} عميل إلى VIP` }); setSelected(new Set()); fetchCustomers();
    }
    setBulkAction("");
  };

  const handleExport = () => {
    const rows = filtered.map(c => {
      const inv = invoiceSummaries[c.id];
      return {
        "الاسم": c.name, "الاسم الإنجليزي": c.name_en || "",
        "النوع": c.customer_type === "business" ? "شركة" : "فرد",
        "التصنيف": (c as any).segment || "standard",
        "البريد": c.email || "", "الهاتف": c.phone || "",
        "السجل التجاري": c.cr_number || "", "الرقم الضريبي": c.vat_number || "",
        "المدينة": c.address_city || "",
        "إجمالي المبيعات": inv?.total_sales || 0,
        "المستحقات": inv?.outstanding || 0,
        "الحد الائتماني": (c as any).credit_limit || "",
        "الحالة": c.is_active ? "نشط" : "غير نشط",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "العملاء");
    XLSX.writeFile(wb, "customers.xlsx");
    toast({ title: "تم تصدير العملاء بنجاح" });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws) as Record<string, string>[];
        const payload = rows.map(r => ({
          tenant_id: tenantId, name: r["الاسم"] || r["name"] || "",
          name_en: r["الاسم الإنجليزي"] || null,
          customer_type: r["النوع"] === "فرد" ? "individual" : "business",
          email: r["البريد"] || null, phone: r["الهاتف"] || null,
          cr_number: r["السجل التجاري"] || null, vat_number: r["الرقم الضريبي"] || null,
          address_city: r["المدينة"] || null,
        })).filter(r => r.name);
        if (payload.length === 0) { toast({ title: "لا توجد بيانات صالحة", variant: "destructive" }); return; }
        const { error } = await supabase.from("customers").insert(payload);
        if (!error) { toast({ title: `تم استيراد ${payload.length} عميل` }); fetchCustomers(); }
        else toast({ title: "خطأ في الاستيراد", description: error.message, variant: "destructive" });
      } catch { toast({ title: "خطأ في قراءة الملف", variant: "destructive" }); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (c: Customer) => {
    setForm({
      name: c.name, name_en: c.name_en || "", customer_type: c.customer_type,
      email: c.email || "", phone: c.phone || "", cr_number: c.cr_number || "",
      vat_number: c.vat_number || "", address_street: c.address_street || "",
      address_city: c.address_city || "", address_zip: c.address_zip || "",
      notes: c.notes || "", tags: (c.tags || []).join(", "),
      segment: (c as any).segment || "standard",
      credit_limit: (c as any).credit_limit ? String((c as any).credit_limit) : "",
    });
    setEditingId(c.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!tenantId || !form.name.trim()) {
      toast({ title: "خطأ", description: "اسم العميل مطلوب", variant: "destructive" }); return;
    }
    setSaving(true);
    const tagsArr = form.tags.split(",").map(t => t.trim()).filter(Boolean);
    const payload: Record<string, unknown> = {
      tenant_id: tenantId, name: form.name.trim(),
      name_en: form.name_en.trim() || null, customer_type: form.customer_type,
      email: form.email.trim() || null, phone: form.phone.trim() || null,
      cr_number: form.cr_number.trim() || null, vat_number: form.vat_number.trim() || null,
      address_street: form.address_street.trim() || null,
      address_city: form.address_city.trim() || null,
      address_zip: form.address_zip.trim() || null,
      notes: form.notes.trim() || null, tags: tagsArr.length ? tagsArr : null,
      segment: form.segment,
      credit_limit: form.credit_limit ? Number(form.credit_limit) : null,
    };
    const { error } = editingId
      ? await (supabase as any).from("customers").update(payload).eq("id", editingId)
      : await (supabase as any).from("customers").insert(payload);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else toast({ title: editingId ? "تم التحديث" : "تمت الإضافة" });
    setSaving(false); setShowForm(false); fetchCustomers();
  };

  const confirmDeleteCustomer = async () => {
    if (!confirmDeleteId) return;
    setDeletingIds(prev => new Set(prev).add(confirmDeleteId));
    const { error } = await supabase.from("customers").delete().eq("id", confirmDeleteId);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم الحذف بنجاح" }); fetchCustomers(); }
    setDeletingIds(prev => { const n = new Set(prev); n.delete(confirmDeleteId); return n; });
    setConfirmDeleteId(null);
  };

  const confirmBulkDeleteAction = async () => {
    const ids = Array.from(selected);
    const { error } = await supabase.from("customers").delete().in("id", ids);
    if (!error) { toast({ title: `تم حذف ${ids.length} عميل` }); setSelected(new Set()); fetchCustomers(); }
    setConfirmBulkDelete(false); setBulkAction("");
  };

  const updateField = (key: keyof CustomerForm, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const hasFilters = filterType || filterCity || filterStatus || filterSegment || filterAtRisk;
  const clearFilters = () => { setFilterType(""); setFilterCity(""); setFilterStatus(""); setFilterSegment(""); setFilterAtRisk(false); setPage(1); };

  if (viewingCustomerId) {
    return <CustomerProfile customerId={viewingCustomerId} onBack={() => { setViewingCustomerId(null); fetchCustomers(); fetchInvoiceSummaries(); }} />;
  }

  return (
    <div dir="rtl" className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Users size={24} className="text-accent" /> إدارة العملاء
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">إضافة وتعديل وإدارة بيانات العملاء</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}><Download size={14} /> تصدير</Button>
          <label>
            <Button variant="outline" size="sm" className="gap-2 cursor-pointer" asChild>
              <span><Upload size={14} /> استيراد</span>
            </Button>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </label>
          <Button onClick={openCreate} size="sm" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus size={14} /> عميل جديد
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="إجمالي العملاء" value={stats.total} color="bg-accent/10 text-accent" />
        <StatCard icon={UserCheck} label="جديد هذا الشهر" value={stats.newThisMonth} color="bg-success/10 text-success" />
        <StatCard icon={Building2} label="شركات" value={stats.businesses} color="bg-info/10 text-info" />
        <StatCard icon={User} label="أفراد" value={stats.individuals} color="bg-primary/10 text-primary" />
        <StatCard icon={Crown} label="VIP" value={stats.vip} color="bg-warning/10 text-warning" />
        <StatCard icon={AlertTriangle} label="معرضون للمغادرة" value={stats.atRisk} color="bg-destructive/10 text-destructive" alert={stats.atRisk > 0}
          sub={stats.atRisk > 0 ? "90+ يوم بدون شراء" : undefined} />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="ابحث بالاسم، البريد، الهاتف..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} className="pr-9 h-9" />
        </div>
        <Button variant={showFilters ? "default" : "outline"} size="sm" className="gap-2 h-9"
          onClick={() => setShowFilters(v => !v)}>
          <Filter size={14} /> فلترة
          {hasFilters && <span className="h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">!</span>}
        </Button>
        <Button variant={filterAtRisk ? "destructive" : "outline"} size="sm" className="h-9 gap-1 text-xs"
          onClick={() => { setFilterAtRisk(v => !v); setPage(1); }}>
          <AlertTriangle size={13} /> معرضون للمغادرة
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground" onClick={clearFilters}>
            <XCircle size={14} /> مسح الفلاتر
          </Button>
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mr-auto">
          <RefreshCw size={12} className="cursor-pointer hover:text-accent" onClick={() => { fetchCustomers(); fetchInvoiceSummaries(); }} />
          {filtered.length} نتيجة
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-xl border border-border bg-secondary/20 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">النوع</Label>
                <select value={filterType} onChange={e => { setFilterType(e.target.value as typeof filterType); setPage(1); }}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent">
                  <option value="">الكل</option>
                  <option value="business">شركة / مؤسسة</option>
                  <option value="individual">فرد</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">التصنيف</Label>
                <select value={filterSegment} onChange={e => { setFilterSegment(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent">
                  <option value="">الكل</option>
                  {Object.entries(SEGMENT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">المدينة</Label>
                <select value={filterCity} onChange={e => { setFilterCity(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent">
                  <option value="">الكل</option>
                  {cities.map(city => <option key={city} value={city}>{city}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">الحالة</Label>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value as typeof filterStatus); setPage(1); }}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent">
                  <option value="">الكل</option>
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Actions */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5">
            <span className="text-sm font-medium text-accent">تم تحديد {selected.size} عميل</span>
            <div className="flex gap-2 mr-auto">
              <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none">
                <option value="">اختر إجراء...</option>
                <option value="make_vip">ترقية إلى VIP</option>
                <option value="activate">تفعيل</option>
                <option value="deactivate">تعطيل</option>
                <option value="delete">حذف</option>
              </select>
              <Button size="sm" className="h-8 text-xs" disabled={!bulkAction} onClick={handleBulkAction}>تنفيذ</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelected(new Set())}>إلغاء</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Users size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{search || hasFilters ? "لا توجد نتائج مطابقة" : "لا يوجد عملاء بعد. أضف أول عميل!"}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-3 py-3 w-8">
                    <button onClick={toggleAll} className="text-muted-foreground hover:text-accent">
                      {allSelected ? <CheckSquare size={15} className="text-accent" /> : <Square size={15} />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1 font-semibold text-foreground text-xs hover:text-accent">
                      الاسم <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">
                    <button onClick={() => toggleSort("customer_type")} className="flex items-center gap-1 font-semibold text-foreground text-xs hover:text-accent">
                      النوع / التصنيف <SortIcon field="customer_type" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground text-xs hidden lg:table-cell">البريد / الهاتف</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground text-xs hidden xl:table-cell">إجمالي المبيعات</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground text-xs hidden xl:table-cell">المستحقات</th>
                  <th className="px-4 py-3 text-right hidden xl:table-cell">
                    <button onClick={() => toggleSort("address_city")} className="flex items-center gap-1 font-semibold text-foreground text-xs hover:text-accent">
                      المدينة <SortIcon field="address_city" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-foreground text-xs w-8">الحالة</th>
                  <th className="px-4 py-3 text-center font-semibold text-foreground text-xs w-24">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((c, i) => {
                  const inv = invoiceSummaries[c.id];
                  const atRisk = isAtRisk(c.id);
                  const creditExceeded = isCreditExceeded(c);
                  const seg = SEGMENT_CONFIG[(c as any).segment || "standard"] || SEGMENT_CONFIG.standard;
                  const SegIcon = seg.icon;
                  return (
                    <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className={`border-b border-border/50 transition-colors ${selected.has(c.id) ? "bg-accent/5" : atRisk ? "bg-destructive/3 hover:bg-destructive/5" : "hover:bg-secondary/20"}`}>
                      <td className="px-3 py-3">
                        <button onClick={() => toggleOne(c.id)} className="text-muted-foreground hover:text-accent">
                          {selected.has(c.id) ? <CheckSquare size={15} className="text-accent" /> : <Square size={15} />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setViewingCustomerId(c.id)} className="text-right hover:underline">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground text-sm">{c.name}</p>
                            {atRisk && <span title="معرض للمغادرة"><AlertTriangle size={12} className="text-destructive" /></span>}
                            {creditExceeded && <span title="تجاوز الحد الائتماني"><DollarSign size={12} className="text-destructive" /></span>}
                          </div>
                          {c.name_en && <p className="text-[10px] text-muted-foreground">{c.name_en}</p>}
                        </button>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="space-y-1">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.customer_type === "business" ? "bg-info/10 text-info" : "bg-primary/10 text-primary"}`}>
                            {c.customer_type === "business" ? "🏢 شركة" : "👤 فرد"}
                          </span>
                          <div>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium flex items-center gap-1 w-fit ${seg.color}`}>
                              <SegIcon size={10} /> {seg.label}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="space-y-0.5">
                          {c.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail size={10} /> {c.email}</p>}
                          {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={10} /> {c.phone}</p>}
                          {!c.email && !c.phone && <span className="text-muted-foreground/40 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs font-medium text-foreground">
                        {inv?.total_sales ? `${inv.total_sales.toLocaleString()} ر.س` : "—"}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {inv?.outstanding ? (
                          <span className={`text-xs font-medium ${creditExceeded ? "text-destructive" : "text-foreground"}`}>
                            {inv.outstanding.toLocaleString()} ر.س
                          </span>
                        ) : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">
                        {c.address_city ? <span className="flex items-center gap-1"><MapPin size={10} /> {c.address_city}</span> : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block h-2 w-2 rounded-full ${c.is_active ? "bg-success" : "bg-muted-foreground/30"}`} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setViewingCustomerId(c.id)}>
                            <Eye size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-accent" onClick={() => openEdit(c)}>
                            <Edit2 size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            disabled={deletingIds.has(c.id)} onClick={() => setConfirmDeleteId(c.id)}>
                            {deletingIds.has(c.id) ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="border-t border-border px-4 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} عميل إجمالاً</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>السابق</Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page + i - 2;
                  if (p < 1 || p > totalPages) return null;
                  return (
                    <Button key={p} variant={page === p ? "default" : "ghost"} size="sm"
                      className={`h-7 w-7 p-0 text-xs ${page === p ? "bg-accent text-accent-foreground" : ""}`}
                      onClick={() => setPage(p)}>{p}</Button>
                  );
                })}
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>التالي</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-elevated">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-foreground">{editingId ? "تعديل العميل" : "إضافة عميل جديد"}</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X size={18} /></Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><User size={12} /> الاسم بالعربي *</Label>
                  <Input value={form.name} onChange={e => updateField("name", e.target.value)} className="mt-1" placeholder="شركة الأمل" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">الاسم بالإنجليزي</Label>
                  <Input value={form.name_en} onChange={e => updateField("name_en", e.target.value)} className="mt-1" dir="ltr" placeholder="Al Amal Co." />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Building2 size={12} /> نوع العميل</Label>
                  <select value={form.customer_type} onChange={e => updateField("customer_type", e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent">
                    <option value="business">شركة / مؤسسة</option>
                    <option value="individual">فرد</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Crown size={12} /> التصنيف</Label>
                  <select value={form.segment} onChange={e => updateField("segment", e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent">
                    {Object.entries(SEGMENT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Mail size={12} /> البريد الإلكتروني</Label>
                  <Input value={form.email} onChange={e => updateField("email", e.target.value)} className="mt-1" dir="ltr" type="email" placeholder="info@company.com" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={12} /> الهاتف</Label>
                  <Input value={form.phone} onChange={e => updateField("phone", e.target.value)} className="mt-1" dir="ltr" placeholder="+966 5X XXX XXXX" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><FileText size={12} /> السجل التجاري</Label>
                  <Input value={form.cr_number} onChange={e => updateField("cr_number", e.target.value)} className="mt-1" dir="ltr" placeholder="10XXXXXXXX" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">الرقم الضريبي</Label>
                  <Input value={form.vat_number} onChange={e => updateField("vat_number", e.target.value)} className="mt-1" dir="ltr" placeholder="3XXXXXXXXXX00003" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign size={12} /> الحد الائتماني (ر.س)</Label>
                  <Input value={form.credit_limit} onChange={e => updateField("credit_limit", e.target.value)} className="mt-1" dir="ltr" type="number" placeholder="50000" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Tag size={12} /> الوسوم (مفصولة بفاصلة)</Label>
                  <Input value={form.tags} onChange={e => updateField("tags", e.target.value)} className="mt-1" placeholder="عميل مميز, جملة" />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={12} /> العنوان</Label>
                  <div className="grid gap-2 mt-1 md:grid-cols-3">
                    <Input value={form.address_street} onChange={e => updateField("address_street", e.target.value)} placeholder="الشارع" />
                    <Input value={form.address_city} onChange={e => updateField("address_city", e.target.value)} placeholder="المدينة" />
                    <Input value={form.address_zip} onChange={e => updateField("address_zip", e.target.value)} placeholder="الرمز البريدي" dir="ltr" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">ملاحظات</Label>
                  <textarea value={form.notes} onChange={e => updateField("notes", e.target.value)} rows={2}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                    placeholder="ملاحظات إضافية..." />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {editingId ? "حفظ التعديلات" : "إضافة العميل"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Single */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={open => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDeleteCustomer}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Bulk Delete */}
      <AlertDialog open={confirmBulkDelete} onOpenChange={open => !open && setConfirmBulkDelete(false)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف الجماعي</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف <strong>{selected.size}</strong> عميل؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel onClick={() => setBulkAction("")}>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmBulkDeleteAction}>حذف الجميع</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomersPage;
