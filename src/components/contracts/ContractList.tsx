import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, FileSignature, Eye, Filter, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateShort } from "@/lib/invoice-utils";
import {
  getContractTypeLabel,
  getContractStatusLabel,
  getContractStatusColor,
} from "@/lib/contract-utils";

const demoContracts = [
  {
    id: "1",
    contract_number: "CON-2026-0001",
    title: "مطور أنظمة أول",
    contract_type: "employment",
    client_name: "أحمد بن سعيد العتيبي",
    start_date: "2026-01-01",
    end_date: "2027-12-31",
    total_value: 25000,
    status: "signed",
    versions: 3,
  },
  {
    id: "2",
    contract_number: "CON-2026-0002",
    title: "تطوير نظام إدارة الموارد البشرية",
    contract_type: "service",
    client_name: "شركة النور للتجارة",
    start_date: "2026-02-01",
    end_date: "2026-08-31",
    total_value: 180000,
    status: "active",
    versions: 2,
  },
  {
    id: "3",
    contract_number: "CON-2026-0003",
    title: "سداد مستحقات مشروع البنية التحتية",
    contract_type: "payment",
    client_name: "مؤسسة الأمل للمقاولات",
    start_date: "2026-02-10",
    end_date: "2026-06-10",
    total_value: 75000,
    status: "active",
    versions: 1,
  },
  {
    id: "4",
    contract_number: "CON-2026-0004",
    title: "عقد صيانة شبكات — سنوي",
    contract_type: "service",
    client_name: "شركة الخليج للتقنية",
    start_date: "2026-01-15",
    end_date: "2027-01-14",
    total_value: 48000,
    status: "draft",
    versions: 1,
  },
  {
    id: "5",
    contract_number: "CON-2025-0012",
    title: "عقد توظيف — مدير مالي",
    contract_type: "employment",
    client_name: "خالد بن محمد الغامدي",
    start_date: "2025-06-01",
    end_date: "2026-05-31",
    total_value: 35000,
    status: "expired",
    versions: 2,
  },
];

interface ContractListProps {
  onCreateNew: () => void;
  onViewContract: (id: string) => void;
}

const ContractList = ({ onCreateNew, onViewContract }: ContractListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = demoContracts.filter((c) => {
    const matchSearch =
      c.contract_number.includes(searchTerm) ||
      c.title.includes(searchTerm) ||
      c.client_name.includes(searchTerm);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchType = typeFilter === "all" || c.contract_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const statusFilters = [
    { value: "all", label: "الكل" },
    { value: "draft", label: "مسودة" },
    { value: "active", label: "ساري" },
    { value: "signed", label: "موقّع" },
    { value: "expired", label: "منتهي" },
  ];

  const typeFilters = [
    { value: "all", label: "كل الأنواع" },
    { value: "employment", label: "عقد عمل" },
    { value: "service", label: "خدمات" },
    { value: "payment", label: "سداد" },
  ];

  const totalActive = demoContracts.filter((c) => ["active", "signed"].includes(c.status)).length;
  const totalValue = demoContracts
    .filter((c) => ["active", "signed"].includes(c.status))
    .reduce((s, c) => s + c.total_value, 0);

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">العقود</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة العقود والاتفاقيات وفق المعايير السعودية
          </p>
        </div>
        <Button
          onClick={onCreateNew}
          className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Plus size={18} />
          إنشاء عقد
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "العقود السارية", value: String(totalActive), color: "text-info" },
          { label: "إجمالي القيمة", value: `${formatCurrency(totalValue)} ر.س`, color: "text-accent" },
          { label: "إجمالي العقود", value: String(demoContracts.length), color: "text-foreground" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-border bg-card p-5 shadow-card"
          >
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-xl font-bold font-english ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="ابحث برقم العقد أو العنوان أو العميل..."
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
        <div className="flex items-center gap-1.5 flex-wrap">
          {typeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === f.value
                  ? "bg-primary text-primary-foreground"
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
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">رقم العقد</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">العنوان</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">النوع</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الطرف الثاني</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">المدة</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">القيمة</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الحالة</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">النُسخ</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.04 * i }}
                  className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileSignature size={14} className="text-accent shrink-0" />
                      <span className="font-medium font-english text-foreground">
                        {c.contract_number}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium max-w-[200px] truncate">
                    {c.title}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-secondary rounded-full px-2 py-0.5">
                      {getContractTypeLabel(c.contract_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{c.client_name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <span className="font-english">{formatDateShort(c.start_date)}</span>
                    <span className="mx-1">←</span>
                    <span className="font-english">{formatDateShort(c.end_date!)}</span>
                  </td>
                  <td className="px-4 py-3 font-english font-medium text-foreground">
                    {formatCurrency(c.total_value)}{" "}
                    <span className="text-xs text-muted-foreground">ر.س</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getContractStatusColor(c.status)}`}
                    >
                      {getContractStatusLabel(c.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={12} />
                      <span className="font-english">{c.versions}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewContract(c.id)}
                      className="gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Eye size={14} />
                      عرض
                    </Button>
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    لا توجد عقود مطابقة
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

export default ContractList;
