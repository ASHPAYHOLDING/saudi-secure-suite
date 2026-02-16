import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Search, FileSignature, Eye, Filter, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateShort } from "@/lib/invoice-utils";
import { getContractTypeLabel, getContractStatusLabel, getContractStatusColor } from "@/lib/contract-utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ContractRow {
  id: string;
  contract_number: string;
  title: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  total_value: number;
  status: string;
  customer_id: string | null;
  customers: { name: string } | null;
}

interface ContractListProps {
  onCreateNew: () => void;
  onViewContract: (id: string) => void;
}

const ContractList = ({ onCreateNew, onViewContract }: ContractListProps) => {
  const { tenantId } = useAuth();
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const fetchContracts = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from("contracts")
      .select("id, contract_number, title, contract_type, start_date, end_date, total_value, status, customer_id, customers(name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (data) setContracts(data as unknown as ContractRow[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchContracts();

    const channel = supabase
      .channel('contract-list-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => fetchContracts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchContracts]);

  const filtered = contracts.filter((c) => {
    const customerName = c.customers?.name || "";
    const matchSearch =
      c.contract_number.includes(searchTerm) ||
      c.title.includes(searchTerm) ||
      customerName.includes(searchTerm);
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

  const totalActive = contracts.filter((c) => ["active", "signed"].includes(c.status)).length;
  const totalValue = contracts
    .filter((c) => ["active", "signed"].includes(c.status))
    .reduce((s, c) => s + c.total_value, 0);

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">العقود</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة العقود والاتفاقيات وفق المعايير السعودية</p>
        </div>
        <Button onClick={onCreateNew} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus size={18} />
          إنشاء عقد
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "العقود السارية", value: String(totalActive), color: "text-info" },
          { label: "إجمالي القيمة", value: `${formatCurrency(totalValue)} ر.س`, color: "text-accent" },
          { label: "إجمالي العقود", value: String(contracts.length), color: "text-foreground" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-xl font-bold font-english ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="ابحث برقم العقد أو العنوان أو العميل..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background pr-10 pl-4 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={14} className="text-muted-foreground ml-1" />
          {statusFilters.map((f) => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === f.value ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>{f.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {typeFilters.map((f) => (
            <button key={f.value} onClick={() => setTypeFilter(f.value)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${typeFilter === f.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
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
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.04 * i }} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileSignature size={14} className="text-accent shrink-0" />
                        <span className="font-medium font-english text-foreground">{c.contract_number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium max-w-[200px] truncate">{c.title}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-secondary rounded-full px-2 py-0.5">{getContractTypeLabel(c.contract_type)}</span></td>
                    <td className="px-4 py-3 text-foreground">{c.customers?.name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      <span className="font-english">{formatDateShort(c.start_date)}</span>
                      {c.end_date && <><span className="mx-1">←</span><span className="font-english">{formatDateShort(c.end_date)}</span></>}
                    </td>
                    <td className="px-4 py-3 font-english font-medium text-foreground">{formatCurrency(c.total_value)} <span className="text-xs text-muted-foreground">ر.س</span></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getContractStatusColor(c.status)}`}>{getContractStatusLabel(c.status)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => onViewContract(c.id)} className="gap-1 text-muted-foreground hover:text-foreground"><Eye size={14} />عرض</Button>
                    </td>
                  </motion.tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">{contracts.length === 0 ? "لا توجد عقود بعد. أنشئ أول عقد!" : "لا توجد عقود مطابقة"}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ContractList;
