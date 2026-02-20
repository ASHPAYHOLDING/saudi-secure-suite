import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
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
  TrendingDown, DollarSign, Activity, Zap, Target, BarChart3,
  ArrowUpRight, ArrowDownRight, Wifi, Circle,
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
import { useCountUp } from "@/hooks/useCountUp";

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

const SEGMENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  standard:  { label: "عادي",  icon: User,        color: "text-muted-foreground",  bg: "bg-muted/60" },
  premium:   { label: "مميز",  icon: Star,        color: "text-warning",            bg: "bg-warning/10" },
  vip:       { label: "VIP",   icon: Crown,       color: "text-accent",             bg: "bg-accent/10" },
  inactive:  { label: "خامل", icon: TrendingDown, color: "text-destructive",        bg: "bg-destructive/10" },
};

// ─── Animated Counter Card ───────────────────────────────────────────────────
const AnimatedNumber = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
  const count = useCountUp(value, 1000);
  return <span>{count.toLocaleString("ar-SA")}{suffix}</span>;
};

const StatCard = ({
  icon: Icon, label, value, sub, color, gradient, alert, trend, delay = 0,
}: {
  icon: React.ElementType; label: string; value: number;
  sub?: string; color: string; gradient: string; alert?: boolean;
  trend?: "up" | "down" | "neutral"; delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
    className={`relative overflow-hidden rounded-2xl border bg-card p-5 cursor-default group ${alert ? "border-destructive/40 shadow-[0_0_20px_-5px_hsl(var(--destructive)/0.2)]" : "border-border hover:border-accent/30 hover:shadow-lg"} transition-all duration-300`}
  >
    {/* Gradient blob */}
    <div className={`absolute -top-6 -left-6 h-24 w-24 rounded-full opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500 ${gradient}`} />

    <div className="relative z-10 flex items-start justify-between">
      <div className="flex-1">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
        <p className={`text-3xl font-bold tracking-tight ${color}`}>
          <AnimatedNumber value={value} />
        </p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
          {trend === "up" && <ArrowUpRight size={10} className="text-success" />}
          {trend === "down" && <ArrowDownRight size={10} className="text-destructive" />}
          {sub}
        </p>}
      </div>
      <motion.div
        whileHover={{ rotate: 10, scale: 1.1 }}
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${gradient} shadow-sm`}
      >
        <Icon size={18} className="opacity-90" />
      </motion.div>
    </div>

    {/* Bottom accent line */}
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.6, delay: delay + 0.3 }}
      className={`absolute bottom-0 left-0 right-0 h-0.5 origin-right ${gradient} opacity-30`}
    />
  </motion.div>
);

// ─── Live Pulse Indicator ────────────────────────────────────────────────────
const LiveIndicator = () => (
  <div className="flex items-center gap-1.5 text-xs text-success">
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
    </span>
    <span className="font-medium">مباشر</span>
  </div>
);

// ─── Customer Row Card (Mobile) ──────────────────────────────────────────────
const CustomerRowMobile = ({
  c, inv, atRisk, creditExceeded, selected, onSelect, onView, onEdit, onDelete, isDeleting, index,
}: {
  c: Customer; inv?: InvoiceSummary; atRisk: boolean; creditExceeded: boolean;
  selected: boolean; onSelect: () => void; onView: () => void; onEdit: () => void;
  onDelete: () => void; isDeleting: boolean; index: number;
}) => {
  const seg = SEGMENT_CONFIG[(c as any).segment || "standard"] || SEGMENT_CONFIG.standard;
  const SegIcon = seg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className={`rounded-2xl border bg-card p-4 space-y-3 transition-all duration-200 ${
        selected ? "border-accent/60 bg-accent/5 shadow-md" :
        atRisk ? "border-destructive/30 bg-destructive/3" :
        "border-border hover:border-accent/30 hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-3">
        <button onClick={onSelect} className="mt-0.5">
          {selected ? <CheckSquare size={16} className="text-accent" /> : <Square size={16} className="text-muted-foreground" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={onView} className="font-semibold text-foreground text-sm hover:text-accent transition-colors">{c.name}</button>
            {atRisk && <span className="flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full"><AlertTriangle size={9} /> خطر</span>}
            {creditExceeded && <span className="flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full"><DollarSign size={9} /> تجاوز</span>}
          </div>
          {c.name_en && <p className="text-[11px] text-muted-foreground mt-0.5" dir="ltr">{c.name_en}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${c.is_active ? "bg-success" : "bg-muted-foreground/40"}`} />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${c.customer_type === "business" ? "bg-info/10 text-info" : "bg-primary/10 text-primary"}`}>
          {c.customer_type === "business" ? "🏢 شركة" : "👤 فرد"}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium flex items-center gap-1 ${seg.bg} ${seg.color}`}>
          <SegIcon size={9} /> {seg.label}
        </span>
        {c.address_city && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin size={9} /> {c.address_city}</span>}
      </div>

      {inv && (inv.total_sales > 0 || inv.outstanding > 0) && (
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
          <div>
            <p className="text-[10px] text-muted-foreground">المبيعات</p>
            <p className="text-xs font-semibold text-foreground">{inv.total_sales.toLocaleString()} ر.س</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">المستحقات</p>
            <p className={`text-xs font-semibold ${creditExceeded ? "text-destructive" : "text-foreground"}`}>{inv.outstanding.toLocaleString()} ر.س</p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-1 pt-1 border-t border-border">
        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs gap-1.5 hover:bg-accent/10 hover:text-accent" onClick={onView}>
          <Eye size={12} /> عرض
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={onEdit}>
          <Edit2 size={12} /> تعديل
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs gap-1.5 hover:text-destructive" disabled={isDeleting} onClick={onDelete}>
          {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </Button>
      </div>
    </motion.div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
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
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

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
      setStats(prev => ({
        ...prev,
        total: cList.length,
        newThisMonth: cList.filter(c => { const d = new Date(c.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length,
        businesses: cList.filter(c => c.customer_type === "business").length,
        individuals: cList.filter(c => c.customer_type === "individual").length,
        vip: cList.filter(c => (c as any).segment === "vip").length,
      }));
      setLastUpdated(new Date());
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
    const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const atRisk = Object.values(map).filter(s => s.last_purchase && new Date(s.last_purchase) < ninetyDaysAgo).length;
    setStats(prev => ({ ...prev, atRisk }));
  }, [tenantId]);

  useEffect(() => {
    fetchCustomers();
    fetchInvoiceSummaries();
    const ch = supabase.channel("customers-rt-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers", filter: `tenant_id=eq.${tenantId}` }, () => {
        fetchCustomers();
        fetchInvoiceSummaries();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchCustomers, fetchInvoiceSummaries, tenantId]);

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
    if (sortField !== field) return <ChevronsUpDown size={11} className="text-muted-foreground/40" />;
    return sortDir === "asc" ? <ChevronUp size={11} className="text-accent" /> : <ChevronDown size={11} className="text-accent" />;
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

  const totalSales = Object.values(invoiceSummaries).reduce((s, i) => s + i.total_sales, 0);
  const totalOutstanding = Object.values(invoiceSummaries).reduce((s, i) => s + i.outstanding, 0);

  return (
    <div dir="rtl" className="min-h-screen">
      {/* ── Hero Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-accent/80 p-6 md:p-8 mb-6 text-primary-foreground"
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-accent blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-primary-foreground blur-3xl" />
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, repeatType: "reverse" }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20"
              >
                <Users size={22} className="text-primary-foreground" />
              </motion.div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-primary-foreground">إدارة العملاء</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <LiveIndicator />
                  <span className="text-xs text-primary-foreground/60">·</span>
                  <span className="text-xs text-primary-foreground/60">
                    آخر تحديث: {lastUpdated.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-primary-foreground/70">منصة CRM متكاملة لإدارة علاقات العملاء وتتبع المبيعات</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-primary-foreground backdrop-blur-sm text-xs"
              onClick={handleExport}
            >
              <Download size={13} /> تصدير
            </Button>
            <label>
              <Button variant="ghost" size="sm" className="h-9 gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-primary-foreground backdrop-blur-sm text-xs cursor-pointer" asChild>
                <span><Upload size={13} /> استيراد</span>
              </Button>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
            </label>
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                onClick={openCreate}
                size="sm"
                className="h-9 gap-2 bg-white text-primary hover:bg-white/90 font-semibold text-xs shadow-lg"
              >
                <Plus size={14} /> عميل جديد
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Mini stats row in header */}
        <div className="relative z-10 grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-white/15">
          {[
            { label: "إجمالي العملاء", value: stats.total.toLocaleString("ar-SA"), icon: Users },
            { label: "إجمالي المبيعات", value: `${(totalSales / 1000).toFixed(0)}K ر.س`, icon: BarChart3 },
            { label: "المستحقات", value: `${(totalOutstanding / 1000).toFixed(0)}K ر.س`, icon: DollarSign },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="text-center"
            >
              <p className="text-lg md:text-xl font-bold text-primary-foreground">{item.value}</p>
              <p className="text-[10px] md:text-xs text-primary-foreground/60 flex items-center justify-center gap-1">
                <item.icon size={9} /> {item.label}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard icon={Users}         label="إجمالي العملاء"    value={stats.total}        color="text-foreground"   gradient="bg-accent/15 text-accent"      delay={0.0} />
        <StatCard icon={UserCheck}     label="جديد هذا الشهر"   value={stats.newThisMonth} color="text-success"      gradient="bg-success/15 text-success"    delay={0.05} trend="up" sub={`هذا الشهر`} />
        <StatCard icon={Building2}     label="شركات ومؤسسات"    value={stats.businesses}   color="text-info"         gradient="bg-info/15 text-info"          delay={0.1} />
        <StatCard icon={User}          label="أفراد"              value={stats.individuals}  color="text-primary"      gradient="bg-primary/15 text-primary"    delay={0.15} />
        <StatCard icon={Crown}         label="عملاء VIP"          value={stats.vip}          color="text-warning"      gradient="bg-warning/15 text-warning"    delay={0.2} trend="up" />
        <StatCard icon={AlertTriangle} label="معرضون للمغادرة"  value={stats.atRisk}       color="text-destructive"  gradient="bg-destructive/15 text-destructive" delay={0.25} alert={stats.atRisk > 0} sub={stats.atRisk > 0 ? "90+ يوم بدون نشاط" : undefined} trend={stats.atRisk > 0 ? "down" : undefined} />
      </div>

      {/* ── Search + Toolbar ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="flex flex-col sm:flex-row gap-3 mb-4"
      >
        <div className="relative flex-1">
          <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث بالاسم، البريد، الهاتف، السجل التجاري..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pr-10 h-10 bg-card border-border focus:border-accent focus:ring-1 focus:ring-accent/30 rounded-xl transition-all duration-200"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            className={`h-10 gap-2 rounded-xl transition-all duration-200 ${showFilters ? "bg-accent text-accent-foreground" : ""}`}
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter size={14} /> فلترة
            {hasFilters && <span className="h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold">{[filterType, filterCity, filterStatus, filterSegment, filterAtRisk].filter(Boolean).length}</span>}
          </Button>
          <Button
            variant={filterAtRisk ? "destructive" : "outline"}
            size="sm"
            className="h-10 gap-1.5 rounded-xl text-xs"
            onClick={() => { setFilterAtRisk(v => !v); setPage(1); }}
          >
            <Zap size={13} /> خطر المغادرة
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-10 gap-1.5 rounded-xl text-muted-foreground text-xs" onClick={clearFilters}>
              <XCircle size={13} /> مسح
            </Button>
          )}
          <div className="flex items-center gap-1.5 px-3 h-10 rounded-xl border border-border bg-card text-xs text-muted-foreground">
            <button onClick={() => { fetchCustomers(); fetchInvoiceSummaries(); }} className="hover:text-accent transition-colors">
              <RefreshCw size={12} />
            </button>
            <span className="text-border">|</span>
            <span className="font-medium text-foreground">{filtered.length}</span>
            <span>نتيجة</span>
          </div>
        </div>
      </motion.div>

      {/* ── Filter Panel ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden mb-4"
          >
            <div className="rounded-2xl border border-accent/20 bg-accent/3 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 backdrop-blur-sm">
              {[
                {
                  label: "النوع", value: filterType,
                  onChange: (v: string) => { setFilterType(v as typeof filterType); setPage(1); },
                  options: [{ v: "", l: "الكل" }, { v: "business", l: "شركة / مؤسسة" }, { v: "individual", l: "فرد" }],
                },
                {
                  label: "التصنيف", value: filterSegment,
                  onChange: (v: string) => { setFilterSegment(v); setPage(1); },
                  options: [{ v: "", l: "الكل" }, ...Object.entries(SEGMENT_CONFIG).map(([k, c]) => ({ v: k, l: c.label }))],
                },
                {
                  label: "المدينة", value: filterCity,
                  onChange: (v: string) => { setFilterCity(v); setPage(1); },
                  options: [{ v: "", l: "الكل" }, ...cities.map(c => ({ v: c, l: c }))],
                },
                {
                  label: "الحالة", value: filterStatus,
                  onChange: (v: string) => { setFilterStatus(v as typeof filterStatus); setPage(1); },
                  options: [{ v: "", l: "الكل" }, { v: "active", l: "نشط" }, { v: "inactive", l: "غير نشط" }],
                },
              ].map(({ label, value, onChange, options }) => (
                <div key={label}>
                  <Label className="text-xs text-muted-foreground mb-1.5 block font-medium">{label}</Label>
                  <select
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                  >
                    {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bulk Actions Bar ── */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-2xl border border-accent/40 bg-accent/8 px-4 py-3 mb-4 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                className="h-6 w-6 rounded-full bg-accent flex items-center justify-center"
              >
                <CheckSquare size={13} className="text-accent-foreground" />
              </motion.div>
              <span className="text-sm font-semibold text-accent">تم تحديد {selected.size} عميل</span>
            </div>
            <div className="flex gap-2 sm:mr-auto flex-wrap">
              <select
                value={bulkAction}
                onChange={e => setBulkAction(e.target.value)}
                className="h-8 rounded-xl border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">اختر إجراء...</option>
                <option value="make_vip">⭐ ترقية إلى VIP</option>
                <option value="activate">✅ تفعيل</option>
                <option value="deactivate">⏸ تعطيل</option>
                <option value="delete">🗑 حذف</option>
              </select>
              <Button size="sm" className="h-8 text-xs rounded-xl bg-accent text-accent-foreground hover:bg-accent/90" disabled={!bulkAction} onClick={handleBulkAction}>تنفيذ</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs rounded-xl" onClick={() => setSelected(new Set())}>إلغاء</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Table / Cards ── */}
      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 gap-4"
        >
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
            <Users size={20} className="absolute inset-0 m-auto text-accent" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">جاري تحميل بيانات العملاء...</p>
        </motion.div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-dashed border-border bg-card p-16 text-center"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Users size={48} className="mx-auto text-muted-foreground/20 mb-4" />
          </motion.div>
          <p className="text-base font-medium text-muted-foreground mb-1">{search || hasFilters ? "لا توجد نتائج مطابقة" : "لا يوجد عملاء بعد"}</p>
          <p className="text-sm text-muted-foreground/60 mb-4">{search || hasFilters ? "حاول تغيير معايير البحث" : "أضف أول عميل للبدء!"}</p>
          {!search && !hasFilters && (
            <Button onClick={openCreate} size="sm" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl">
              <Plus size={14} /> إضافة عميل
            </Button>
          )}
        </motion.div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-3.5 w-10">
                      <button onClick={toggleAll} className="text-muted-foreground hover:text-accent transition-colors">
                        {allSelected ? <CheckSquare size={15} className="text-accent" /> : <Square size={15} />}
                      </button>
                    </th>
                    {[
                      { label: "العميل", field: "name" as SortField, always: true },
                      { label: "النوع / التصنيف", field: "customer_type" as SortField, always: true },
                      { label: "البريد / الهاتف", field: null, always: false, lg: true },
                      { label: "إجمالي المبيعات", field: null, always: false, xl: true },
                      { label: "المستحقات", field: null, always: false, xl: true },
                      { label: "المدينة", field: "address_city" as SortField, always: false, xl: true },
                    ].map(({ label, field, always, lg, xl }) => (
                      <th
                        key={label}
                        className={`px-4 py-3.5 text-right ${!always && xl ? "hidden xl:table-cell" : ""} ${!always && lg ? "hidden lg:table-cell" : ""}`}
                      >
                        {field ? (
                          <button onClick={() => toggleSort(field)} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                            {label} <SortIcon field={field} />
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                        )}
                      </th>
                    ))}
                    <th className="px-4 py-3.5 text-center text-xs font-semibold text-muted-foreground w-16">الحالة</th>
                    <th className="px-4 py-3.5 text-center text-xs font-semibold text-muted-foreground w-28">إجراءات</th>
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
                      <motion.tr
                        key={c.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                        className={`border-b border-border/50 group transition-colors duration-150 ${
                          selected.has(c.id) ? "bg-accent/5" :
                          atRisk ? "bg-destructive/[0.02] hover:bg-destructive/5" :
                          "hover:bg-muted/30"
                        }`}
                      >
                        <td className="px-3 py-3.5">
                          <button onClick={() => toggleOne(c.id)} className="text-muted-foreground hover:text-accent transition-colors">
                            {selected.has(c.id) ? <CheckSquare size={15} className="text-accent" /> : <Square size={15} />}
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => setViewingCustomerId(c.id)} className="text-right group/name">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground text-sm group-hover/name:text-accent transition-colors">{c.name}</p>
                              {atRisk && (
                                <motion.span
                                  animate={{ scale: [1, 1.15, 1] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                  title="معرض للمغادرة"
                                >
                                  <AlertTriangle size={12} className="text-destructive" />
                                </motion.span>
                              )}
                              {creditExceeded && <span title="تجاوز الحد الائتماني"><DollarSign size={12} className="text-destructive" /></span>}
                            </div>
                            {c.name_en && <p className="text-[11px] text-muted-foreground mt-0.5" dir="ltr">{c.name_en}</p>}
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${c.customer_type === "business" ? "bg-info/10 text-info" : "bg-primary/10 text-primary"}`}>
                              {c.customer_type === "business" ? "🏢 شركة" : "👤 فرد"}
                            </span>
                            <div>
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium flex items-center gap-1 w-fit ${seg.bg} ${seg.color}`}>
                                <SegIcon size={9} /> {seg.label}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <div className="space-y-0.5">
                            {c.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail size={10} className="text-accent/60" /> {c.email}</p>}
                            {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5" dir="ltr"><Phone size={10} className="text-accent/60" /> {c.phone}</p>}
                            {!c.email && !c.phone && <span className="text-muted-foreground/30 text-xs">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden xl:table-cell">
                          {inv?.total_sales ? (
                            <div>
                              <p className="text-sm font-semibold text-foreground">{inv.total_sales.toLocaleString("ar-SA")}</p>
                              <p className="text-[10px] text-muted-foreground">ر.س</p>
                            </div>
                          ) : <span className="text-muted-foreground/30 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3.5 hidden xl:table-cell">
                          {inv?.outstanding ? (
                            <div>
                              <p className={`text-sm font-semibold ${creditExceeded ? "text-destructive" : "text-foreground"}`}>{inv.outstanding.toLocaleString("ar-SA")}</p>
                              <p className="text-[10px] text-muted-foreground">ر.س</p>
                            </div>
                          ) : <span className="text-muted-foreground/30 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3.5 hidden xl:table-cell text-xs text-muted-foreground">
                          {c.address_city ? <span className="flex items-center gap-1.5"><MapPin size={10} className="text-accent/60" /> {c.address_city}</span> : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <motion.span
                              animate={c.is_active ? { scale: [1, 1.3, 1] } : {}}
                              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                              className={`inline-block h-2.5 w-2.5 rounded-full ${c.is_active ? "bg-success shadow-[0_0_6px_hsl(var(--success))]" : "bg-muted-foreground/30"}`}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-accent/10 hover:text-accent rounded-lg" onClick={() => setViewingCustomerId(c.id)}>
                              <Eye size={13} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary rounded-lg" onClick={() => openEdit(c)}>
                              <Edit2 size={13} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive rounded-lg"
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
            <div className="border-t border-border px-5 py-3 flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-accent" />
                <span>{filtered.length} عميل إجمالاً</span>
                {hasFilters && <span className="text-accent">· مع فلتر نشط</span>}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-lg" disabled={page === 1} onClick={() => setPage(p => p - 1)}>السابق</Button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page + i - 3;
                    if (p < 1 || p > totalPages) return null;
                    return (
                      <Button key={p} variant={page === p ? "default" : "ghost"} size="sm"
                        className={`h-7 w-7 p-0 text-xs rounded-lg ${page === p ? "bg-accent text-accent-foreground shadow-sm" : ""}`}
                        onClick={() => setPage(p)}>{p}</Button>
                    );
                  })}
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-lg" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>التالي</Button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            <AnimatePresence>
              {paginated.map((c, i) => (
                <CustomerRowMobile
                  key={c.id}
                  c={c}
                  inv={invoiceSummaries[c.id]}
                  atRisk={isAtRisk(c.id)}
                  creditExceeded={isCreditExceeded(c)}
                  selected={selected.has(c.id)}
                  onSelect={() => toggleOne(c.id)}
                  onView={() => setViewingCustomerId(c.id)}
                  onEdit={() => openEdit(c)}
                  onDelete={() => setConfirmDeleteId(c.id)}
                  isDeleting={deletingIds.has(c.id)}
                  index={i}
                />
              ))}
            </AnimatePresence>

            {/* Mobile Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" size="sm" className="rounded-xl" disabled={page === 1} onClick={() => setPage(p => p - 1)}>السابق</Button>
                <span className="text-xs text-muted-foreground">{page} من {totalPages}</span>
                <Button variant="outline" size="sm" className="rounded-xl" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>التالي</Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Form Modal ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 100, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl"
            >
              {/* Modal Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-card/95 backdrop-blur-sm rounded-t-3xl sm:rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center">
                    {editingId ? <Edit2 size={16} className="text-accent" /> : <Plus size={16} className="text-accent" />}
                  </div>
                  <h2 className="text-base font-bold text-foreground">{editingId ? "تعديل العميل" : "إضافة عميل جديد"}</h2>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)} className="rounded-xl">
                  <X size={18} />
                </Button>
              </div>

              <div className="p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5"><User size={11} /> الاسم بالعربي *</Label>
                    <Input value={form.name} onChange={e => updateField("name", e.target.value)} className="rounded-xl" placeholder="شركة الأمل" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">الاسم بالإنجليزي</Label>
                    <Input value={form.name_en} onChange={e => updateField("name_en", e.target.value)} className="rounded-xl" dir="ltr" placeholder="Al Amal Co." />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5"><Building2 size={11} /> نوع العميل</Label>
                    <select value={form.customer_type} onChange={e => updateField("customer_type", e.target.value)}
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20">
                      <option value="business">شركة / مؤسسة</option>
                      <option value="individual">فرد</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5"><Crown size={11} /> التصنيف</Label>
                    <select value={form.segment} onChange={e => updateField("segment", e.target.value)}
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20">
                      {Object.entries(SEGMENT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5"><Mail size={11} /> البريد الإلكتروني</Label>
                    <Input value={form.email} onChange={e => updateField("email", e.target.value)} className="rounded-xl" dir="ltr" type="email" placeholder="info@company.com" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5"><Phone size={11} /> الهاتف</Label>
                    <Input value={form.phone} onChange={e => updateField("phone", e.target.value)} className="rounded-xl" dir="ltr" placeholder="+966 5X XXX XXXX" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5"><FileText size={11} /> السجل التجاري</Label>
                    <Input value={form.cr_number} onChange={e => updateField("cr_number", e.target.value)} className="rounded-xl" dir="ltr" placeholder="10XXXXXXXX" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">الرقم الضريبي</Label>
                    <Input value={form.vat_number} onChange={e => updateField("vat_number", e.target.value)} className="rounded-xl" dir="ltr" placeholder="3XXXXXXXXXX00003" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5"><DollarSign size={11} /> الحد الائتماني (ر.س)</Label>
                    <Input value={form.credit_limit} onChange={e => updateField("credit_limit", e.target.value)} className="rounded-xl" dir="ltr" type="number" placeholder="50000" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5"><Tag size={11} /> الوسوم</Label>
                    <Input value={form.tags} onChange={e => updateField("tags", e.target.value)} className="rounded-xl" placeholder="عميل مميز, جملة" />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5"><MapPin size={11} /> العنوان</Label>
                    <div className="grid gap-2 md:grid-cols-3">
                      <Input value={form.address_street} onChange={e => updateField("address_street", e.target.value)} className="rounded-xl" placeholder="الشارع" />
                      <Input value={form.address_city} onChange={e => updateField("address_city", e.target.value)} className="rounded-xl" placeholder="المدينة" />
                      <Input value={form.address_zip} onChange={e => updateField("address_zip", e.target.value)} className="rounded-xl" placeholder="الرمز البريدي" dir="ltr" />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">ملاحظات</Label>
                    <textarea value={form.notes} onChange={e => updateField("notes", e.target.value)} rows={2}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none transition-all"
                      placeholder="ملاحظات إضافية..." />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-5 border-t border-border">
                  <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">إلغاء</Button>
                  <motion.div whileTap={{ scale: 0.97 }}>
                    <Button onClick={handleSave} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl font-semibold w-full sm:w-auto shadow-lg">
                      {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      {editingId ? "حفظ التعديلات" : "إضافة العميل"}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirm Dialogs ── */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={open => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 size={18} className="text-destructive" /> تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl" onClick={confirmDeleteCustomer}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBulkDelete} onOpenChange={open => !open && setConfirmBulkDelete(false)}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 size={18} className="text-destructive" /> تأكيد الحذف الجماعي</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف <strong>{selected.size}</strong> عميل؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel onClick={() => setBulkAction("")} className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl" onClick={confirmBulkDeleteAction}>حذف الجميع</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomersPage;
