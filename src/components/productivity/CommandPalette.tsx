import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  CreditCard, FileText, Receipt, Users, Package, ShoppingCart,
  FileSignature, Truck, BookOpen, BarChart3, Settings, Search,
  Plus, ArrowRight, Wallet, MessageCircle, Shield,
} from "lucide-react";

interface SearchResult {
  type: string;
  id: string;
  label: string;
  sublabel?: string;
}

const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { t, currentLang } = useLanguage();
  const { tenantId } = useAuth();
  const isRTL = currentLang === "ar";

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Search across entities
  const doSearch = useCallback(
    async (query: string) => {
      if (!query || query.length < 2 || !tenantId) {
        setSearchResults([]);
        return;
      }
      const results: SearchResult[] = [];

      const [invoices, customers, quotations, expenses] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_number, grand_total, status")
          .eq("tenant_id", tenantId)
          .ilike("invoice_number", `%${query}%`)
          .limit(5),
        supabase
          .from("customers")
          .select("id, name, name_en, email")
          .eq("tenant_id", tenantId)
          .or(`name.ilike.%${query}%,name_en.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(5),
        supabase
          .from("quotations")
          .select("id, quotation_number, grand_total, status")
          .eq("tenant_id", tenantId)
          .ilike("quotation_number", `%${query}%`)
          .limit(5),
        supabase
          .from("expenses")
          .select("id, expense_number, title, total_amount, status")
          .eq("tenant_id", tenantId)
          .or(`expense_number.ilike.%${query}%,title.ilike.%${query}%`)
          .limit(5),
      ]);

      invoices.data?.forEach((inv) =>
        results.push({
          type: "invoice",
          id: inv.id,
          label: inv.invoice_number,
          sublabel: `${inv.grand_total} SAR · ${inv.status}`,
        })
      );
      customers.data?.forEach((c) =>
        results.push({
          type: "customer",
          id: c.id,
          label: isRTL ? c.name : (c.name_en || c.name),
          sublabel: c.email || "",
        })
      );
      quotations.data?.forEach((q) =>
        results.push({
          type: "quotation",
          id: q.id,
          label: q.quotation_number,
          sublabel: `${q.grand_total} SAR · ${q.status}`,
        })
      );
      expenses.data?.forEach((e) =>
        results.push({
          type: "expense",
          id: e.id,
          label: e.expense_number,
          sublabel: e.title || `${e.total_amount} SAR`,
        })
      );

      setSearchResults(results);
    },
    [tenantId, isRTL]
  );

  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const createActions = [
    { icon: CreditCard, label: isRTL ? "فاتورة جديدة" : "New Invoice", path: "/dashboard/billing" },
    { icon: Receipt, label: isRTL ? "مصروف جديد" : "New Expense", path: "/dashboard/expenses" },
    { icon: FileText, label: isRTL ? "عرض سعر جديد" : "New Quotation", path: "/dashboard/quotations" },
    { icon: ShoppingCart, label: isRTL ? "أمر بيع جديد" : "New Sales Order", path: "/dashboard/sales-orders" },
    { icon: Package, label: isRTL ? "أمر شراء جديد" : "New Purchase Order", path: "/dashboard/purchase-orders" },
    { icon: Truck, label: isRTL ? "إشعار تسليم" : "New Delivery Note", path: "/dashboard/delivery-notes" },
    { icon: FileSignature, label: isRTL ? "عقد جديد" : "New Contract", path: "/dashboard/contracts" },
    { icon: Users, label: isRTL ? "عميل جديد" : "New Customer", path: "/dashboard/customers" },
  ];

  const navActions = [
    { icon: CreditCard, label: isRTL ? "الفواتير" : "Invoices", path: "/dashboard/billing" },
    { icon: Users, label: isRTL ? "العملاء" : "Customers", path: "/dashboard/customers" },
    { icon: Receipt, label: isRTL ? "المصروفات" : "Expenses", path: "/dashboard/expenses" },
    { icon: FileText, label: isRTL ? "عروض الأسعار" : "Quotations", path: "/dashboard/quotations" },
    { icon: Wallet, label: isRTL ? "النظرة المالية" : "Financial Overview", path: "/dashboard/finance" },
    { icon: BookOpen, label: isRTL ? "قيود اليومية" : "Journal Entries", path: "/dashboard/journal-entries" },
    { icon: BarChart3, label: isRTL ? "التحليلات" : "Analytics", path: "/dashboard/analytics" },
    { icon: Shield, label: isRTL ? "الإقرار الضريبي" : "VAT Return", path: "/dashboard/vat-return" },
    { icon: MessageCircle, label: isRTL ? "المحادثات" : "Chat", path: "/dashboard/chat" },
    { icon: Settings, label: isRTL ? "الإعدادات" : "Settings", path: "/dashboard/settings" },
  ];

  const resultIcons: Record<string, any> = {
    invoice: CreditCard,
    customer: Users,
    quotation: FileText,
    expense: Receipt,
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={isRTL ? "اكتب أمراً أو ابحث..." : "Type a command or search..."}
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>{isRTL ? "لا توجد نتائج" : "No results found."}</CommandEmpty>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <CommandGroup heading={isRTL ? "نتائج البحث" : "Search Results"}>
            {searchResults.map((r) => {
              const Icon = resultIcons[r.type] || Search;
              return (
                <CommandItem
                  key={`${r.type}-${r.id}`}
                  onSelect={() => go(`/dashboard/${r.type === "invoice" ? "billing" : r.type + "s"}`)}
                >
                  <Icon className="mr-2 h-4 w-4 shrink-0" />
                  <span>{r.label}</span>
                  {r.sublabel && (
                    <span className="ml-2 text-xs text-muted-foreground">{r.sublabel}</span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Quick Create */}
        <CommandGroup heading={isRTL ? "إنشاء سريع" : "Quick Create"}>
          {createActions.map((a) => (
            <CommandItem key={a.path + "-create"} onSelect={() => go(a.path)}>
              <Plus className="mr-2 h-4 w-4 shrink-0" />
              <span>{a.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading={isRTL ? "انتقل إلى" : "Go to"}>
          {navActions.map((a) => (
            <CommandItem key={a.path + "-nav"} onSelect={() => go(a.path)}>
              <a.icon className="mr-2 h-4 w-4 shrink-0" />
              <span>{a.label}</span>
              <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
