import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Loader2, Sparkles, ArrowUpRight, Table2, X, ChevronDown,
  FileText, Users, Receipt, Package, ShoppingCart, Truck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUGGESTIONS = [
  "أرني الفواتير غير المدفوعة فوق 5000 ريال",
  "ما هي المصروفات المعتمدة هذا الشهر؟",
  "أعلى 10 عملاء حسب إجمالي الفواتير",
  "المنتجات التي مخزونها أقل من 10",
  "عقود تنتهي خلال 30 يوم",
  "فواتير متأخرة السداد",
  "Show all expenses above 1000 SAR",
  "Unpaid invoices for this month",
];

const TABLE_ICONS: Record<string, any> = {
  invoices: FileText,
  customers: Users,
  expenses: Receipt,
  products: Package,
  quotations: FileText,
  sales_orders: ShoppingCart,
  purchase_orders: ShoppingCart,
  delivery_notes: Truck,
  contracts: FileText,
  suppliers: Users,
};

interface QueryResult {
  results: Record<string, any>[];
  count: number;
  explanation_ar: string;
  explanation_en?: string;
  query_info: {
    table: string;
    filters: any[];
    order: any;
    limit: number;
  };
}

const NaturalLanguageQuery = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const executeQuery = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    setShowSuggestions(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("يرجى تسجيل الدخول أولاً");
        return;
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nl-query`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ query: q }),
        }
      );

      if (resp.status === 429) {
        toast.error("تم تجاوز حد الطلبات، حاول لاحقاً");
        return;
      }
      if (resp.status === 402) {
        toast.error("يرجى إضافة رصيد للاستمرار");
        return;
      }

      const data = await resp.json();
      if (!resp.ok) {
        toast.error(data.error || "حدث خطأ");
        return;
      }

      setResult(data);
    } catch (err) {
      console.error(err);
      toast.error("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeQuery(query);
  };

  const handleSuggestion = (s: string) => {
    setQuery(s);
    executeQuery(s);
  };

  const formatValue = (key: string, value: any): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "object") {
      if (value.name) return value.name;
      return JSON.stringify(value);
    }
    if (typeof value === "number") return value.toLocaleString("ar-SA");
    if (typeof value === "boolean") return value ? "نعم" : "لا";
    return String(value);
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      paid: "bg-green-100 text-green-700",
      approved: "bg-green-100 text-green-700",
      draft: "bg-muted text-muted-foreground",
      sent: "bg-blue-100 text-blue-700",
      overdue: "bg-red-100 text-red-700",
      cancelled: "bg-red-100 text-red-700",
      rejected: "bg-red-100 text-red-700",
      pending: "bg-yellow-100 text-yellow-700",
      confirmed: "bg-blue-100 text-blue-700",
      active: "bg-green-100 text-green-700",
      expired: "bg-red-100 text-red-700",
    };
    return map[s] || "bg-muted text-muted-foreground";
  };

  const getVisibleColumns = (data: Record<string, any>[]) => {
    if (!data.length) return [];
    const skip = ["id", "tenant_id", "branch_id", "created_by", "updated_at", "invoice_uuid", "invoice_hash",
      "previous_invoice_hash", "zatca_xml", "zatca_signed_xml", "zatca_response", "zatca_errors",
      "zatca_warnings", "zatca_status", "zatca_clearance_status", "zatca_reporting_status",
      "zatca_submitted_at", "body_html"];
    return Object.keys(data[0]).filter(
      (k) => !skip.includes(k) && typeof data[0][k] !== "object" || (data[0][k] && typeof data[0][k] === "object" && data[0][k].name)
    );
  };

  const TableIcon = result ? TABLE_ICONS[result.query_info.table] || Table2 : Table2;

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles size={24} className="text-accent" />
          استعلامات ذكية
        </h1>
        <p className="text-sm text-muted-foreground">
          اسأل بلغتك الطبيعية عن الفواتير، المصروفات، العملاء، والمخزون
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) setShowSuggestions(true);
            }}
            placeholder="اسأل سؤالك هنا... مثل: أرني الفواتير غير المدفوعة"
            className="w-full rounded-xl border border-input bg-background py-3.5 pr-10 pl-24 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={loading}
          />
          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {result && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => { setResult(null); setQuery(""); setShowSuggestions(true); }}
              >
                <X size={14} />
              </Button>
            )}
            <Button type="submit" size="sm" disabled={loading || !query.trim()} className="h-8 gap-1">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
              بحث
            </Button>
          </div>
        </div>
      </form>

      {/* Suggestions */}
      <AnimatePresence>
        {showSuggestions && !result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <p className="text-xs text-muted-foreground mb-2">اقتراحات:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(s)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground/80 transition hover:bg-accent/10 hover:border-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-16"
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">جاري تحليل سؤالك...</p>
          </div>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Explanation */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <TableIcon size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{result.explanation_ar}</p>
                    {result.explanation_en && (
                      <p className="text-xs text-muted-foreground mt-0.5">{result.explanation_en}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {result.count} نتيجة
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Data Table */}
            {result.results.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="w-full">
                    <div className="min-w-[600px]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">#</th>
                            {getVisibleColumns(result.results).map((col) => (
                              <th key={col} className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">
                                {col.replace(/_/g, " ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.results.map((row, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                              {getVisibleColumns(result.results).map((col) => (
                                <td key={col} className="px-3 py-2.5 whitespace-nowrap">
                                  {col === "status" ? (
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(row[col])}`}>
                                      {row[col]}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-foreground">
                                      {formatValue(col, row[col])}
                                    </span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">لا توجد نتائج مطابقة</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NaturalLanguageQuery;
