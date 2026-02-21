import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Search, FileText, Eye, Filter, ScanLine, Palette } from "lucide-react";
import SmartEmptyState from "@/components/ui/smart-empty-state";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateShort, getStatusLabel, getStatusColor } from "@/lib/invoice-utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ResponsiveTable, { type TableColumn, type MobileCardConfig, type TableAction } from "@/components/dashboard/ResponsiveTable";
import PageHeader from "@/components/dashboard/PageHeader";
import { PageLoading } from "@/components/dashboard/PageStates";
import { useLanguage } from "@/hooks/useLanguage";

interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  grand_total: number;
  amount_due: number;
  status: string;
  customer_id: string;
  customers: { name: string } | null;
}

interface InvoiceListProps {
  onCreateNew: () => void;
  onOcrImport?: () => void;
  onManageTemplates?: () => void;
  onViewInvoice: (id: string) => void;
}

const InvoiceList = ({ onCreateNew, onOcrImport, onManageTemplates, onViewInvoice }: InvoiceListProps) => {
  const { tenantId } = useAuth();
  const { currentLang } = useLanguage();
  const isAr = currentLang === "ar";
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchInvoices = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, due_date, grand_total, amount_due, status, customer_id, customers(name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (data) setInvoices(data as unknown as InvoiceRow[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchInvoices();
    const channel = supabase
      .channel('invoice-list-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchInvoices())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchInvoices]);

  const filteredInvoices = invoices.filter((inv) => {
    const customerName = inv.customers?.name || "";
    const matchesSearch = inv.invoice_number.includes(searchTerm) || customerName.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusFilters = [
    { value: "all", label: isAr ? "الكل" : "All" },
    { value: "draft", label: isAr ? "مسودة" : "Draft" },
    { value: "pending_approval", label: isAr ? "قيد الموافقة" : "Pending" },
    { value: "issued", label: isAr ? "صادرة" : "Issued" },
    { value: "paid", label: isAr ? "مدفوعة" : "Paid" },
    { value: "partially_paid", label: isAr ? "جزئية" : "Partial" },
    { value: "overdue", label: isAr ? "متأخرة" : "Overdue" },
  ];

  const totalIssued = invoices.filter(i => ['issued', 'sent', 'partially_paid', 'overdue'].includes(i.status)).reduce((s, i) => s + i.grand_total, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.grand_total, 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount_due, 0);

  const columns: TableColumn<InvoiceRow>[] = [
    {
      key: "number",
      header: isAr ? "رقم الفاتورة" : "Invoice #",
      render: (row) => (
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-accent shrink-0" />
          <span className="font-medium font-english text-foreground">{row.invoice_number}</span>
        </div>
      ),
    },
    {
      key: "customer",
      header: isAr ? "العميل" : "Customer",
      render: (row) => <span className="text-foreground">{row.customers?.name || "—"}</span>,
    },
    {
      key: "date",
      header: isAr ? "تاريخ الإصدار" : "Issue Date",
      render: (row) => <span className="text-muted-foreground text-xs">{formatDateShort(row.invoice_date)}</span>,
    },
    {
      key: "due",
      header: isAr ? "الاستحقاق" : "Due Date",
      render: (row) => <span className="text-muted-foreground text-xs">{formatDateShort(row.due_date)}</span>,
    },
    {
      key: "total",
      header: isAr ? "المبلغ" : "Amount",
      render: (row) => (
        <span className="font-english font-medium text-foreground" dir="ltr">
          {formatCurrency(row.grand_total)} <span className="text-[10px] text-muted-foreground">{isAr ? "ر.س" : "SAR"}</span>
        </span>
      ),
    },
    {
      key: "remaining",
      header: isAr ? "المتبقي" : "Remaining",
      render: (row) => (
        <span className="font-english font-medium text-foreground" dir="ltr">
          {formatCurrency(row.amount_due)} <span className="text-[10px] text-muted-foreground">{isAr ? "ر.س" : "SAR"}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: isAr ? "الحالة" : "Status",
      render: (row) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${getStatusColor(row.status)}`}>
          {getStatusLabel(row.status)}
        </span>
      ),
    },
  ];

  const actions: TableAction<InvoiceRow>[] = [
    {
      label: isAr ? "عرض" : "View",
      icon: <Eye size={14} />,
      onClick: (row) => onViewInvoice(row.id),
    },
  ];

  const mobileCard: MobileCardConfig<InvoiceRow> = {
    title: (row) => (
      <div className="flex items-center gap-2">
        <FileText size={14} className="text-accent shrink-0" />
        <span className="font-english">{row.invoice_number}</span>
      </div>
    ),
    subtitle: (row) => row.customers?.name || "—",
    badge: (row) => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${getStatusColor(row.status)}`}>
        {getStatusLabel(row.status)}
      </span>
    ),
    meta: (row) => formatDateShort(row.invoice_date),
    value: (row) => (
      <span className="font-english" dir="ltr">
        {formatCurrency(row.grand_total)} {isAr ? "ر.س" : "SAR"}
      </span>
    ),
    onClick: (row) => onViewInvoice(row.id),
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header with Quick Actions */}
      <PageHeader
        title={isAr ? "الفواتير" : "Invoices"}
        description={isAr ? "إدارة وتتبع فواتيرك الضريبية" : "Manage and track your tax invoices"}
        actions={[
          ...(onManageTemplates ? [{ label: isAr ? "القوالب" : "Templates", icon: <Palette size={16} />, onClick: onManageTemplates, variant: "outline" as const }] : []),
          ...(onOcrImport ? [{ label: isAr ? "استيراد OCR" : "OCR Import", icon: <ScanLine size={16} />, onClick: onOcrImport, variant: "outline" as const }] : []),
        ]}
      >
        <Button onClick={onCreateNew} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 h-9">
          <Plus size={16} />
          {isAr ? "إنشاء فاتورة" : "New Invoice"}
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {[
          { label: isAr ? "إجمالي المستحق" : "Total Due", value: totalIssued, color: "text-info" },
          { label: isAr ? "المدفوع" : "Paid", value: totalPaid, color: "text-success" },
          { label: isAr ? "المتأخر" : "Overdue", value: totalOverdue, color: "text-destructive" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-xl font-bold font-english ${stat.color}`} dir="ltr">
              {formatCurrency(stat.value)}
              <span className="text-xs font-normal text-muted-foreground ms-1">{isAr ? "ر.س" : "SAR"}</span>
            </p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md w-full">
          <Search size={16} className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={isAr ? "ابحث برقم الفاتورة أو اسم العميل..." : "Search by invoice # or customer..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background ps-10 pe-4 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={14} className="text-muted-foreground me-1" />
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                statusFilter === f.value
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <ResponsiveTable
        data={filteredInvoices}
        columns={columns}
        actions={actions}
        mobileCard={mobileCard}
        loading={loading}
        keyExtractor={(row) => row.id}
        emptyState={
          invoices.length === 0 ? (
            <SmartEmptyState
              icon={FileText}
              title={isAr ? "لا توجد فواتير بعد" : "No invoices yet"}
              description={isAr ? "أنشئ أول فاتورة ضريبية متوافقة مع هيئة الزكاة والدخل" : "Create your first ZATCA-compliant tax invoice"}
              tips={isAr ? [
                "أضف عميلاً أولاً من صفحة العملاء",
                "أنشئ فاتورة وأضف البنود والكميات",
                "يتم احتساب الضريبة ١٥٪ ورمز QR تلقائياً",
              ] : [
                "Add a customer first from the Customers page",
                "Create an invoice and add items",
                "VAT 15% and QR code are calculated automatically",
              ]}
              actionLabel={isAr ? "إنشاء أول فاتورة" : "Create First Invoice"}
              onAction={onCreateNew}
            />
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              {isAr ? "لا توجد فواتير مطابقة للبحث" : "No matching invoices found"}
            </div>
          )
        }
      />
    </div>
  );
};

export default InvoiceList;
