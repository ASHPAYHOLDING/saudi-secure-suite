import { useEffect, useState } from "react";
import { BookOpen, Loader2, Search, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { formatCurrency } from "@/lib/invoice-utils";

const sourceLabels: Record<string, { ar: string; en: string }> = {
  invoice: { ar: "فاتورة", en: "Invoice" },
  expense: { ar: "مصروف", en: "Expense" },
  sales_order: { ar: "أمر بيع", en: "Sales Order" },
  purchase_order: { ar: "أمر شراء", en: "Purchase Order" },
  manual: { ar: "يدوي", en: "Manual" },
};

const statusLabels: Record<string, { ar: string; en: string }> = {
  draft: { ar: "مسودة", en: "Draft" },
  posted: { ar: "مُرحّل", en: "Posted" },
  voided: { ar: "ملغى", en: "Voided" },
};

const JournalEntriesPage = () => {
  const { tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      let q = supabase
        .from("journal_entries")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (sourceFilter !== "all") q = q.eq("source_type", sourceFilter);

      const { data } = await q;
      setEntries(data || []);
      setLoading(false);
    };
    load();
  }, [tenantId, sourceFilter]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!lines[id]) {
      const { data } = await supabase
        .from("journal_entry_lines")
        .select("*")
        .eq("journal_entry_id", id)
        .order("sort_order");
      setLines((prev) => ({ ...prev, [id]: data || [] }));
    }
  };

  const filtered = entries.filter((e) =>
    !search || e.entry_number?.toLowerCase().includes(search.toLowerCase()) || e.description?.includes(search)
  );

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen size={24} />
          {isRTL ? "قيود اليومية" : "Journal Entries"}
        </h1>
        <p className="text-sm text-muted-foreground">{isRTL ? "جميع القيود المحاسبية التلقائية واليدوية" : "All auto-generated and manual accounting entries"}</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isRTL ? "بحث بالرقم أو الوصف..." : "Search..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
            <SelectItem value="invoice">{isRTL ? "فواتير" : "Invoices"}</SelectItem>
            <SelectItem value="expense">{isRTL ? "مصروفات" : "Expenses"}</SelectItem>
            <SelectItem value="sales_order">{isRTL ? "أوامر بيع" : "Sales Orders"}</SelectItem>
            <SelectItem value="purchase_order">{isRTL ? "أوامر شراء" : "Purchase Orders"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {isRTL ? "لا توجد قيود يومية" : "No journal entries"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div
                onClick={() => toggleExpand(entry.id)}
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-accent/5 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold font-english text-sm">{entry.entry_number}</span>
                    {entry.source_type && (
                      <Badge variant="outline" className="text-[10px]">
                        {sourceLabels[entry.source_type]?.[isRTL ? "ar" : "en"] || entry.source_type}
                      </Badge>
                    )}
                    <Badge variant={entry.status === "posted" ? "default" : entry.status === "voided" ? "destructive" : "secondary"} className="text-[10px]">
                      {statusLabels[entry.status]?.[isRTL ? "ar" : "en"] || entry.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.description}</p>
                </div>
                <div className="text-end shrink-0">
                  <p className="font-semibold font-english text-sm">{formatCurrency(entry.total_debit)} {isRTL ? "ر.س" : "SAR"}</p>
                  <p className="text-[10px] text-muted-foreground font-english">{entry.entry_date}</p>
                </div>
                {expandedId === entry.id ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
              </div>

              {expandedId === entry.id && (
                <div className="border-t border-border bg-muted/20 p-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-start py-1.5 px-2 font-semibold text-muted-foreground">{isRTL ? "الحساب" : "Account"}</th>
                        <th className="text-start py-1.5 px-2 font-semibold text-muted-foreground">{isRTL ? "البيان" : "Description"}</th>
                        <th className="text-end py-1.5 px-2 font-semibold text-muted-foreground">{isRTL ? "مدين" : "Debit"}</th>
                        <th className="text-end py-1.5 px-2 font-semibold text-muted-foreground">{isRTL ? "دائن" : "Credit"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(lines[entry.id] || []).map((line) => (
                        <tr key={line.id} className="border-b border-border/50">
                          <td className="py-1.5 px-2 font-medium">{line.account_name}</td>
                          <td className="py-1.5 px-2 text-muted-foreground">{line.description}</td>
                          <td className="py-1.5 px-2 text-end font-english">{line.debit > 0 ? formatCurrency(line.debit) : "—"}</td>
                          <td className="py-1.5 px-2 text-end font-english">{line.credit > 0 ? formatCurrency(line.credit) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border font-semibold">
                        <td colSpan={2} className="py-1.5 px-2">{isRTL ? "الإجمالي" : "Total"}</td>
                        <td className="py-1.5 px-2 text-end font-english">{formatCurrency(entry.total_debit)}</td>
                        <td className="py-1.5 px-2 text-end font-english">{formatCurrency(entry.total_credit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JournalEntriesPage;
