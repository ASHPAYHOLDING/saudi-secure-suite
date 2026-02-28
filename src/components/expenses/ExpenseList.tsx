import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Receipt, Eye, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import SmartEmptyState from "@/components/ui/smart-empty-state";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateShort } from "@/lib/invoice-utils";

const statusLabels: Record<string, string> = {
  draft: "مسودة", pending: "بانتظار الموافقة", pending_approval: "قيد الموافقة", approved: "معتمد", rejected: "مرفوض", paid: "مدفوع",
};
const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground", pending: "bg-amber-100 text-amber-800", pending_approval: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800", rejected: "bg-red-100 text-red-800", paid: "bg-blue-100 text-blue-800",
};
const paymentLabels: Record<string, string> = {
  cash: "نقدي", bank_transfer: "تحويل بنكي", credit_card: "بطاقة ائتمان", other: "أخرى",
};

interface ExpenseListProps {
  onCreateNew: () => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}

const ExpenseList = ({ onCreateNew, onView, onEdit }: ExpenseListProps) => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select("*, expense_categories(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "تم حذف المصروف" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const filtered = expenses.filter((e: any) => {
    const matchSearch = e.expense_number.includes(search) || e.title?.includes(search) || e.expense_categories?.name?.includes(search);
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    const matchMonth = monthFilter === "all" || e.expense_date?.startsWith(monthFilter);
    return matchSearch && matchStatus && matchMonth;
  });

  // Stats
  const totalExpenses = expenses.filter((e: any) => e.status !== "rejected").reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
  const pendingCount = expenses.filter((e: any) => e.status === "pending").length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyTotal = expenses.filter((e: any) => e.expense_date?.startsWith(thisMonth) && e.status !== "rejected").reduce((s: number, e: any) => s + (e.total_amount || 0), 0);

  // Generate month options
  const months = Array.from(new Set(expenses.map((e: any) => e.expense_date?.slice(0, 7)).filter(Boolean))).sort().reverse();

  return (
    <div className="p-4 sm:p-6 space-y-6" dir="rtl">
      <PageHeader title="المصروفات" description="تتبع وإدارة المصروفات">
        <Button onClick={onCreateNew} className="gap-1.5">
          <Plus size={16} /> مصروف جديد
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "إجمالي المصروفات", value: `${formatCurrency(totalExpenses)} ر.س`, color: "text-foreground" },
          { label: "بانتظار الموافقة", value: pendingCount, color: "text-amber-600" },
          { label: "مصروفات الشهر", value: `${formatCurrency(monthlyTotal)} ر.س`, color: "text-blue-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 px-5">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold font-english mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Receipt size={20} />
            المصروفات ({filtered.length})
          </CardTitle>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search size={16} className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9 w-full sm:w-48" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="draft">مسودة</SelectItem>
                <SelectItem value="pending">بانتظار الموافقة</SelectItem>
                <SelectItem value="approved">معتمد</SelectItem>
                <SelectItem value="rejected">مرفوض</SelectItem>
                <SelectItem value="paid">مدفوع</SelectItem>
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأشهر</SelectItem>
                {months.map((m: string) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
          ) : filtered.length === 0 ? (
            expenses.length === 0 ? (
              <SmartEmptyState
                icon={Receipt}
                title="لا توجد مصروفات بعد"
                description="سجّل مصروفاتك لتتبع النفقات وإعداد التقارير المالية"
                tips={[
                  "أضف عنوان المصروف والمبلغ وطريقة الدفع",
                  "ارفق إيصال الدفع أو فاتورة المورد",
                  "أرسل للاعتماد من المدير المسؤول",
                ]}
                actionLabel="إضافة أول مصروف"
                onAction={onCreateNew}
              />
            ) : (
              <p className="text-center text-muted-foreground py-8">لا توجد مصروفات مطابقة للبحث</p>
            )
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرقم</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>الضريبة</TableHead>
                    <TableHead>الإجمالي</TableHead>
                    <TableHead>الدفع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.expense_number}</TableCell>
                      <TableCell className="font-medium">{e.title || "—"}</TableCell>
                      <TableCell className="text-xs">{e.expense_categories?.name || "—"}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(e.amount)}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCurrency(e.vat_amount)}</TableCell>
                      <TableCell className="font-mono font-semibold">{formatCurrency(e.total_amount)} ر.س</TableCell>
                      <TableCell className="text-xs">{paymentLabels[e.payment_method] || e.payment_method}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[e.status]} variant="outline">
                          {statusLabels[e.status] || e.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{formatDateShort(e.expense_date)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => onView(e.id)}><Eye size={14} /></Button>
                          {(e.status === "draft" || e.status === "rejected") && (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => onEdit(e.id)}><Pencil size={14} /></Button>
                              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(e.id)}><Trash2 size={14} /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpenseList;
