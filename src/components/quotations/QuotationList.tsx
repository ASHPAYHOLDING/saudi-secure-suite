import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, Eye, Pencil, Trash2 } from "lucide-react";
import SmartEmptyState from "@/components/ui/smart-empty-state";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateShort } from "@/lib/invoice-utils";

const statusLabels: Record<string, string> = {
  draft: "مسودة", sent: "مُرسل", approved: "موافق عليه", rejected: "مرفوض", converted: "تم التحويل",
};
const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  converted: "bg-purple-100 text-purple-800",
};

interface QuotationListProps {
  onCreateNew: () => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}

const QuotationList = ({ onCreateNew, onView, onEdit }: QuotationListProps) => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ["quotations", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("quotations")
        .select("*, customers(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete items first then quotation
      await supabase.from("quotation_items").delete().eq("quotation_id", id);
      const { error } = await supabase.from("quotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast({ title: "تم حذف عرض السعر" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const filtered = quotations.filter((q: any) =>
    q.quotation_number.includes(search) || q.title?.includes(search) || q.customers?.name?.includes(search)
  );

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">عروض الأسعار</h1>
          <p className="text-sm text-muted-foreground mt-1">إنشاء وإدارة عروض الأسعار</p>
        </div>
        <Button onClick={onCreateNew} className="gap-1.5">
          <Plus size={16} /> عرض سعر جديد
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText size={20} />
            عروض الأسعار ({filtered.length})
          </CardTitle>
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9 w-60" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
          ) : filtered.length === 0 ? (
            quotations.length === 0 ? (
              <SmartEmptyState
                icon={FileText}
                title="لا توجد عروض أسعار بعد"
                description="أنشئ عروض أسعار احترافية وأرسلها لعملائك"
                tips={[
                  "أضف بيانات العميل والبنود المطلوبة",
                  "حدد تاريخ صلاحية العرض",
                  "بعد موافقة العميل يمكنك تحويله لفاتورة مباشرة",
                ]}
                actionLabel="إنشاء عرض سعر"
                onAction={onCreateNew}
              />
            ) : (
              <p className="text-center text-muted-foreground py-8">لا توجد عروض مطابقة للبحث</p>
            )
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم العرض</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>الإجمالي</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>صالح حتى</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((q: any) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono text-xs">{q.quotation_number}</TableCell>
                      <TableCell className="font-medium">{q.title || "—"}</TableCell>
                      <TableCell>{q.customers?.name || "—"}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(q.grand_total)} ر.س</TableCell>
                      <TableCell>
                        <Badge className={statusColors[q.status]} variant="outline">
                          {statusLabels[q.status] || q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {q.valid_until ? formatDateShort(q.valid_until) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => onView(q.id)}><Eye size={14} /></Button>
                          {q.status === "draft" && (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => onEdit(q.id)}><Pencil size={14} /></Button>
                              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(q.id)}><Trash2 size={14} /></Button>
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

export default QuotationList;
