import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Search, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SmartEmptyState from "@/components/ui/smart-empty-state";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDateShort } from "@/lib/invoice-utils";

interface CreditNoteRow {
  id: string;
  credit_note_number: string;
  credit_date: string;
  grand_total: number;
  status: string;
  reason: string;
  invoice_id: string | null;
  customers: { name: string } | null;
  invoices: { invoice_number: string } | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-muted text-muted-foreground" },
  issued: { label: "صادرة", color: "bg-blue-100 text-blue-700" },
  applied: { label: "مطبّقة", color: "bg-green-100 text-green-700" },
  cancelled: { label: "ملغاة", color: "bg-red-100 text-red-700" },
};

const CreditNoteList = ({ onCreateNew }: { onCreateNew: (invoiceId?: string) => void }) => {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<CreditNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from("credit_notes")
      .select("id, credit_note_number, credit_date, grand_total, status, reason, invoice_id, customers(name), invoices(invoice_number)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (data) setItems(data as unknown as CreditNoteRow[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchData();
    const ch = supabase.channel("cn-list").on("postgres_changes", { event: "*", schema: "public", table: "credit_notes" }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const filtered = items.filter(i =>
    i.credit_note_number.includes(search) || (i.customers?.name || "").includes(search)
  );

  const totalIssued = items.filter(i => i.status !== "draft" && i.status !== "cancelled").reduce((s, i) => s + i.grand_total, 0);

  return (
    <div dir="rtl" className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إشعارات دائنة</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة المرتجعات والاسترداد</p>
        </div>
        <Button onClick={() => onCreateNew()} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus size={18} />إنشاء إشعار دائن
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-xs text-muted-foreground mb-1">إجمالي الإشعارات الصادرة</p>
          <p className="text-xl font-bold font-english text-destructive" dir="ltr">{formatCurrency(totalIssued)} <span className="text-xs text-muted-foreground">ر.س</span></p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-xs text-muted-foreground mb-1">عدد الإشعارات</p>
          <p className="text-xl font-bold text-foreground">{items.length}</p>
        </motion.div>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="ابحث برقم الإشعار أو العميل..." value={search} onChange={e => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background pr-10 pl-4 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">رقم الإشعار</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">العميل</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الفاتورة المرتبطة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التاريخ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المبلغ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">السبب</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cn, i) => {
                  const st = STATUS_MAP[cn.status] || STATUS_MAP.draft;
                  return (
                    <motion.tr key={cn.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-medium font-english text-foreground">{cn.credit_note_number}</td>
                      <td className="px-4 py-3 text-foreground">{cn.customers?.name || "—"}</td>
                      <td className="px-4 py-3 font-english text-muted-foreground">{cn.invoices?.invoice_number || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateShort(cn.credit_date)}</td>
                      <td className="px-4 py-3 font-english font-medium text-destructive" dir="ltr">{formatCurrency(cn.grand_total)} ر.س</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">{cn.reason || "—"}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${st.color}`}>{st.label}</span></td>
                    </motion.tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7}>
                    <SmartEmptyState icon={FileText} title="لا توجد إشعارات دائنة" description="أنشئ إشعاراً دائناً مرتبطاً بفاتورة لمعالجة المرتجعات" tips={["اربط الإشعار بالفاتورة الأصلية", "يتم خصم المبلغ تلقائياً"]} actionLabel="إنشاء إشعار دائن" onAction={() => onCreateNew()} />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default CreditNoteList;
