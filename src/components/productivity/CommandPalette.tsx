import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/contexts/AuthContext";
import { useGranularPermissions } from "@/hooks/useGranularPermissions";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  CreditCard, FileText, Receipt, Users, Package, ShoppingCart,
  FileSignature, Truck, BookOpen, BarChart3, Settings, Search,
  Plus, ArrowRight, Wallet, MessageCircle, Shield, UserCheck,
  Building2, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  type: "customer" | "invoice" | "contract" | "supplier" | "employee";
  id: string;
  label: string;
  sublabel?: string;
}

type ResultGroup = {
  key: SearchResult["type"];
  heading: string;
  icon: any;
  items: SearchResult[];
  path: string;
};

const TYPE_META: Record<SearchResult["type"], { heading: string; icon: any; path: string; permission: string }> = {
  customer: { heading: "العملاء", icon: Users, path: "/dashboard/customers", permission: "customers.view" },
  invoice: { heading: "الفواتير", icon: CreditCard, path: "/dashboard/billing", permission: "invoices.view" },
  contract: { heading: "العقود", icon: FileSignature, path: "/dashboard/contracts", permission: "contracts.view" },
  supplier: { heading: "الموردون", icon: Building2, path: "/dashboard/suppliers", permission: "suppliers.view" },
  employee: { heading: "الموظفون", icon: UserCheck, path: "/dashboard/hr/employees", permission: "hr.view" },
};

const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const { currentLang } = useLanguage();
  const { tenantId } = useAuth();
  const { can } = useGranularPermissions();
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

  // Listen for custom open event (from topbar search button / input)
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-command-palette", handler);
    return () => window.removeEventListener("open-command-palette", handler);
  }, []);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open]);

  // RBAC-aware search across entities
  const doSearch = useCallback(
    async (query: string) => {
      if (!query || query.length < 2 || !tenantId) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      const results: SearchResult[] = [];
      const promises: Promise<void>[] = [];

      // Customers
      if (can("customers.view")) {
        promises.push((async () => {
          const { data } = await supabase
            .from("customers")
            .select("id, name, name_en, email")
            .eq("tenant_id", tenantId)
            .or(`name.ilike.%${query}%,name_en.ilike.%${query}%,email.ilike.%${query}%`)
            .limit(10);
          data?.forEach((c) =>
            results.push({
              type: "customer",
              id: c.id,
              label: isRTL ? c.name : (c.name_en || c.name),
              sublabel: c.email || undefined,
            })
          );
        })());
      }

      // Invoices
      if (can("invoices.view")) {
        promises.push((async () => {
          const { data } = await supabase
            .from("invoices")
            .select("id, invoice_number, grand_total, status")
            .eq("tenant_id", tenantId)
            .ilike("invoice_number", `%${query}%`)
            .limit(10);
          data?.forEach((inv) =>
            results.push({
              type: "invoice",
              id: inv.id,
              label: inv.invoice_number,
              sublabel: `${inv.grand_total} SAR · ${inv.status}`,
            })
          );
        })());
      }

      // Contracts
      if (can("contracts.view")) {
        promises.push((async () => {
          const { data } = await supabase
            .from("contracts")
            .select("id, contract_number, title, status")
            .eq("tenant_id", tenantId)
            .or(`contract_number.ilike.%${query}%,title.ilike.%${query}%`)
            .limit(10);
          data?.forEach((c) =>
            results.push({
              type: "contract",
              id: c.id,
              label: c.contract_number,
              sublabel: c.title,
            })
          );
        })());
      }

      // Suppliers
      if (can("suppliers.view")) {
        promises.push((async () => {
          const { data } = await supabase
            .from("suppliers")
            .select("id, name, name_en, email")
            .eq("tenant_id", tenantId)
            .or(`name.ilike.%${query}%,name_en.ilike.%${query}%`)
            .limit(10);
          data?.forEach((s) =>
            results.push({
              type: "supplier",
              id: s.id,
              label: isRTL ? s.name : (s.name_en || s.name),
              sublabel: s.email || undefined,
            })
          );
        })());
      }

      // HR Employees
      if (can("hr.view")) {
        promises.push((async () => {
          const { data } = await supabase
            .from("hr_employees")
            .select("id, employee_number, first_name, last_name, first_name_en, last_name_en, email")
            .eq("tenant_id", tenantId)
            .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,employee_number.ilike.%${query}%,first_name_en.ilike.%${query}%,last_name_en.ilike.%${query}%`)
            .limit(10);
          data?.forEach((e) =>
            results.push({
              type: "employee",
              id: e.id,
              label: isRTL
                ? `${e.first_name} ${e.last_name}`
                : `${e.first_name_en || e.first_name} ${e.last_name_en || e.last_name}`,
              sublabel: e.employee_number,
            })
          );
        })());
      }

      await Promise.all(promises);
      setSearchResults(results);
      setSearching(false);
    },
    [tenantId, isRTL, can]
  );

  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  // Group results by type
  const grouped: ResultGroup[] = useMemo(() => {
    const groups: ResultGroup[] = [];
    const types = Object.keys(TYPE_META) as SearchResult["type"][];
    for (const type of types) {
      const items = searchResults.filter((r) => r.type === type);
      if (items.length > 0) {
        const meta = TYPE_META[type];
        groups.push({ key: type, heading: meta.heading, icon: meta.icon, items, path: meta.path });
      }
    }
    return groups;
  }, [searchResults]);

  // Quick create actions (RBAC-filtered)
  const createActions = useMemo(() => {
    const all = [
      { icon: CreditCard, label: "فاتورة جديدة", path: "/dashboard/billing", perm: "invoices.create" },
      { icon: Users, label: "عميل جديد", path: "/dashboard/customers", perm: "customers.create" },
      { icon: Receipt, label: "مصروف جديد", path: "/dashboard/expenses", perm: "expenses.create" },
      { icon: FileText, label: "عرض سعر جديد", path: "/dashboard/quotations", perm: "quotations.create" },
      { icon: ShoppingCart, label: "أمر بيع جديد", path: "/dashboard/sales-orders", perm: "invoices.create" },
      { icon: Package, label: "أمر شراء جديد", path: "/dashboard/purchase-orders", perm: "suppliers.view" },
      { icon: Truck, label: "إشعار تسليم", path: "/dashboard/delivery-notes", perm: "invoices.create" },
      { icon: FileSignature, label: "عقد جديد", path: "/dashboard/contracts", perm: "contracts.view" },
    ];
    return all.filter((a) => can(a.perm));
  }, [can]);

  // Navigation actions
  const navActions = useMemo(() => {
    const all = [
      { icon: CreditCard, label: "الفواتير", path: "/dashboard/billing", perm: "invoices.view" },
      { icon: Users, label: "العملاء", path: "/dashboard/customers", perm: "customers.view" },
      { icon: Receipt, label: "المصروفات", path: "/dashboard/expenses", perm: "expenses.view" },
      { icon: Building2, label: "الموردون", path: "/dashboard/suppliers", perm: "suppliers.view" },
      { icon: FileSignature, label: "العقود", path: "/dashboard/contracts", perm: "contracts.view" },
      { icon: UserCheck, label: "الموظفون", path: "/dashboard/hr/employees", perm: "hr.view" },
      { icon: Wallet, label: "النظرة المالية", path: "/dashboard/finance", perm: "finance.view" },
      { icon: BookOpen, label: "قيود اليومية", path: "/dashboard/journal-entries", perm: "journal_entries.view" },
      { icon: BarChart3, label: "التحليلات", path: "/dashboard/analytics", perm: "analytics.view" },
      { icon: Shield, label: "الإقرار الضريبي", path: "/dashboard/vat-return", perm: "vat.view" },
      { icon: MessageCircle, label: "المحادثات", path: "/dashboard/chat", perm: "chat.view" },
      { icon: Settings, label: "الإعدادات", path: "/dashboard/settings", perm: "company.view" },
    ];
    return all.filter((a) => can(a.perm));
  }, [can]);

  const hasQuery = searchQuery.length >= 2;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      {/* Mobile: fullscreen overlay. Desktop: centered modal */}
      <div className="flex items-center border-b px-3">
        <Search className="me-2 h-4 w-4 shrink-0 opacity-50" />
        <input
          className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={isRTL ? "اكتب للبحث أو اختر أمراً..." : "Search or pick a command..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
        {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Badge variant="outline" className="ms-2 shrink-0 text-[10px] px-1.5 py-0.5 font-mono hidden sm:inline-flex">
          ⌘K
        </Badge>
      </div>

      <CommandList className="max-h-[60vh] md:max-h-[400px]">
        <CommandEmpty>
          {searching ? "جاري البحث..." : hasQuery ? "لا توجد نتائج مطابقة" : "اكتب حرفين على الأقل للبحث"}
        </CommandEmpty>

        {/* Grouped Search Results */}
        {grouped.map((group) => {
          const GroupIcon = group.icon;
          return (
            <CommandGroup
              key={group.key}
              heading={
                <span className="flex items-center gap-1.5">
                  <GroupIcon className="h-3.5 w-3.5" />
                  {group.heading}
                  <Badge variant="secondary" className="ms-1 text-[10px] px-1 py-0 h-4">
                    {group.items.length}
                  </Badge>
                </span>
              }
            >
              {group.items.map((r) => (
                <CommandItem
                  key={`${r.type}-${r.id}`}
                  value={`${r.label} ${r.sublabel || ""}`}
                  onSelect={() => go(group.path)}
                  className="gap-2"
                >
                  <GroupIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{r.label}</span>
                  {r.sublabel && (
                    <span className="ms-auto truncate text-xs text-muted-foreground max-w-[180px]">
                      {r.sublabel}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}

        {/* Quick Create */}
        {!hasQuery && createActions.length > 0 && (
          <>
            <CommandGroup heading="⚡ إنشاء سريع">
              {createActions.map((a) => (
                <CommandItem key={a.path + "-create"} onSelect={() => go(a.path)} className="gap-2">
                  <Plus className="h-4 w-4 shrink-0 text-primary" />
                  <span>{a.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Navigation */}
        {!hasQuery && navActions.length > 0 && (
          <CommandGroup heading="الانتقال إلى">
            {navActions.map((a) => (
              <CommandItem key={a.path + "-nav"} onSelect={() => go(a.path)} className="gap-2">
                <a.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{a.label}</span>
                <ArrowRight className="ms-auto h-3 w-3 text-muted-foreground rtl:rotate-180" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
