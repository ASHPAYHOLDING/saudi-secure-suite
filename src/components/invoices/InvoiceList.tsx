import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Search, FileText, Eye, Filter, Loader2, ScanLine, Palette } from "lucide-react";
import SmartEmptyState from "@/components/ui/smart-empty-state";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateShort, getStatusLabel, getStatusColor } from "@/lib/invoice-utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
    const matchesSearch =
      inv.invoice_number.includes(searchTerm) ||
      customerName.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusFilters = [
    { value: "all", label: "الكل" },
    { value: "draft", label: "مسودة" },
    { value: "issued", label: "صادرة" },
    { value: "paid", label: "مدفوعة" },
    { value: "partially_paid", label: "جزئية" },
    { value: "overdue", label: "متأخرة" },
  ];

  const totalIssued = invoices.filter(i => ['issued', 'sent', 'partially_paid', 'overdue'].includes(i.status)).reduce((s, i) => s + i.grand_total, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.grand_total, 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount_due, 0);

  return (
    <div dir="rtl" className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الفواتير</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة وتتبع فواتيرك الضريبية</p>
        </div>
        <div className="flex items-center gap-2">
          {onManageTemplates && (
            <Button variant="outline" onClick={onManageTemplates} className="gap-2">
              <Palette size={18} />
              القوالب
            </Button>
          )}
          {onOcrImport && (
            <Button variant="outline" onClick={onOcrImport} className="gap-2">
              <ScanLine size={18} />
              استيراد OCR
            </Button>
          )}
          <Button onClick={onCreateNew} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus size={18} />
            إنشاء فاتورة
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {[
          { label: "إجمالي المستحق", value: totalIssued, color: "text-info" },
          { label: "المدفوع", value: totalPaid, color: "text-success" },
          { label: "المتأخر", value: totalOverdue, color: "text-destructive" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-border bg-card p-5 shadow-card"
          >
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-xl font-bold font-english ${stat.color}`} dir="ltr">
              {formatCurrency(stat.value)}
              <span className="text-xs font-normal text-muted-foreground mr-1"> ر.س</span>
            </p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md w-full">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="ابحث برقم الفاتورة أو اسم العميل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background pr-10 pl-4 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={14} className="text-muted-foreground ml-1" />
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
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
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
        >
          {/* Mobile Cards */}
          <div className="sm:hidden divide-y divide-border">
            {filteredInvoices.map((inv) => (
              <div key={inv.id} className="p-4 hover:bg-secondary/10 transition-colors" onClick={() => onViewInvoice(inv.id)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-accent shrink-0" />
                    <span className="font-medium font-english text-foreground text-sm">{inv.invoice_number}</span>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${getStatusColor(inv.status)}`}>
                    {getStatusLabel(inv.status)}
                  </span>
                </div>
                <p className="text-sm text-foreground mb-1">{inv.customers?.name || "—"}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDateShort(inv.invoice_date)}</span>
                  <span className="font-english font-semibold text-foreground" dir="ltr">{formatCurrency(inv.grand_total)} ر.س</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">رقم الفاتورة</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">العميل</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">تاريخ الإصدار</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">الاستحقاق</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">المبلغ</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">المتبقي</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">الحالة</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv, i) => (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.03 * i }}
                    className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-accent shrink-0" />
                        <span className="font-medium font-english text-foreground">{inv.invoice_number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground">{inv.customers?.name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateShort(inv.invoice_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateShort(inv.due_date)}</td>
                    <td className="px-4 py-3 font-english font-medium text-foreground" dir="ltr">
                      {formatCurrency(inv.grand_total)} <span className="text-[10px] text-muted-foreground">ر.س</span>
                    </td>
                    <td className="px-4 py-3 font-english font-medium text-foreground" dir="ltr">
                      {formatCurrency(inv.amount_due)} <span className="text-[10px] text-muted-foreground">ر.س</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${getStatusColor(inv.status)}`}>
                        {getStatusLabel(inv.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewInvoice(inv.id)}
                        className="gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Eye size={14} />
                        عرض
                      </Button>
                    </td>
                  </motion.tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      {invoices.length === 0 ? (
                        <SmartEmptyState
                          icon={FileText}
                          title="لا توجد فواتير بعد"
                          description="أنشئ أول فاتورة ضريبية متوافقة مع هيئة الزكاة والدخل"
                          tips={[
                            "أضف عميلاً أولاً من صفحة العملاء",
                            "أنشئ فاتورة وأضف البنود والكميات",
                            "يتم احتساب الضريبة ١٥٪ ورمز QR تلقائياً",
                          ]}
                          actionLabel="إنشاء أول فاتورة"
                          onAction={onCreateNew}
                        />
                      ) : (
                        <p className="py-12 text-center text-muted-foreground">لا توجد فواتير مطابقة للبحث</p>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default InvoiceList;
