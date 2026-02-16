import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, FileText, Eye, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateShort, getStatusLabel, getStatusColor } from "@/lib/invoice-utils";

// Demo data - will be replaced with Supabase queries when auth is ready
const demoInvoices = [
  {
    id: "1",
    invoice_number: "INV-202602-0001",
    customer_name: "شركة النور للتجارة",
    invoice_date: "2026-02-10",
    due_date: "2026-03-12",
    grand_total: 11500,
    amount_due: 11500,
    status: "issued",
  },
  {
    id: "2",
    invoice_number: "INV-202602-0002",
    customer_name: "مؤسسة الأمل للمقاولات",
    invoice_date: "2026-02-08",
    due_date: "2026-03-10",
    grand_total: 34500,
    amount_due: 17250,
    status: "partially_paid",
  },
  {
    id: "3",
    invoice_number: "INV-202601-0015",
    customer_name: "شركة الخليج للتقنية",
    invoice_date: "2026-01-20",
    due_date: "2026-02-19",
    grand_total: 8625,
    amount_due: 0,
    status: "paid",
  },
  {
    id: "4",
    invoice_number: "INV-202601-0014",
    customer_name: "مكتب الريادة للاستشارات",
    invoice_date: "2026-01-15",
    due_date: "2026-02-14",
    grand_total: 5750,
    amount_due: 5750,
    status: "overdue",
  },
  {
    id: "5",
    invoice_number: "INV-202602-0003",
    customer_name: "شركة الوفاء للتوريدات",
    invoice_date: "2026-02-14",
    due_date: "2026-03-16",
    grand_total: 22080,
    amount_due: 22080,
    status: "draft",
  },
];

interface InvoiceListProps {
  onCreateNew: () => void;
  onViewInvoice: (id: string) => void;
}

const InvoiceList = ({ onCreateNew, onViewInvoice }: InvoiceListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredInvoices = demoInvoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_number.includes(searchTerm) ||
      inv.customer_name.includes(searchTerm);
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

  // Summary stats
  const totalIssued = demoInvoices.filter(i => ['issued', 'sent', 'partially_paid', 'overdue'].includes(i.status)).reduce((s, i) => s + i.grand_total, 0);
  const totalPaid = demoInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.grand_total, 0);
  const totalOverdue = demoInvoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount_due, 0);

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الفواتير</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة وتتبع فواتيرك الضريبية</p>
        </div>
        <Button onClick={onCreateNew} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus size={18} />
          إنشاء فاتورة
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
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
            <p className={`text-xl font-bold font-english ${stat.color}`}>
              {formatCurrency(stat.value)}
              <span className="text-xs font-normal text-muted-foreground mr-1">ر.س</span>
            </p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="ابحث برقم الفاتورة أو اسم العميل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background pr-10 pl-4 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">رقم الفاتورة</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">العميل</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">تاريخ الإصدار</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">تاريخ الاستحقاق</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">المبلغ</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">المتبقي</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الحالة</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv, i) => (
                <motion.tr
                  key={inv.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05 * i }}
                  className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-accent shrink-0" />
                      <span className="font-medium font-english text-foreground">{inv.invoice_number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">{inv.customer_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateShort(inv.invoice_date)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateShort(inv.due_date)}</td>
                  <td className="px-4 py-3 font-english font-medium text-foreground">
                    {formatCurrency(inv.grand_total)} <span className="text-xs text-muted-foreground">ر.س</span>
                  </td>
                  <td className="px-4 py-3 font-english font-medium text-foreground">
                    {formatCurrency(inv.amount_due)} <span className="text-xs text-muted-foreground">ر.س</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(inv.status)}`}>
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
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    لا توجد فواتير مطابقة للبحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default InvoiceList;
