import { useEffect, useState } from "react";
import { Plus, Loader2, Truck, ArrowDownToLine, ArrowUpFromLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";

interface Props {
  onCreateNew: () => void;
  onView: (id: string) => void;
}

const statusLabels: Record<string, { ar: string; en: string }> = {
  draft: { ar: "مسودة", en: "Draft" },
  confirmed: { ar: "مؤكد", en: "Confirmed" },
  delivered: { ar: "تم التسليم", en: "Delivered" },
  cancelled: { ar: "ملغى", en: "Cancelled" },
};

const DeliveryNoteList = ({ onCreateNew, onView }: Props) => {
  const { tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      let q = supabase
        .from("delivery_notes")
        .select("*, customers(name), suppliers(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (typeFilter !== "all") q = q.eq("note_type", typeFilter);

      const { data } = await q;
      setNotes(data || []);
      setLoading(false);
    };
    load();
  }, [tenantId, typeFilter]);

  const filtered = notes.filter((n) =>
    !search || n.note_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{isRTL ? "إشعارات التسليم" : "Delivery Notes"}</h1>
          <p className="text-sm text-muted-foreground">{isRTL ? "إدارة إشعارات التسليم الصادرة والواردة" : "Manage inbound & outbound delivery notes"}</p>
        </div>
        <Button onClick={onCreateNew} className="gap-2">
          <Plus size={16} />
          {isRTL ? "إشعار جديد" : "New Note"}
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isRTL ? "بحث بالرقم..." : "Search by number..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
            <SelectItem value="outbound">{isRTL ? "صادر" : "Outbound"}</SelectItem>
            <SelectItem value="inbound">{isRTL ? "وارد (GRN)" : "Inbound (GRN)"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {isRTL ? "لا توجد إشعارات تسليم" : "No delivery notes found"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((note) => (
            <div
              key={note.id}
              onClick={() => onView(note.id)}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 cursor-pointer hover:bg-accent/5 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                {note.note_type === "outbound" ? (
                  <ArrowUpFromLine className="h-5 w-5 text-accent" />
                ) : (
                  <ArrowDownToLine className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold font-english text-sm">{note.note_number}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {note.note_type === "outbound" ? (isRTL ? "صادر" : "Outbound") : (isRTL ? "وارد" : "Inbound")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {note.note_type === "outbound"
                    ? (note.customers as any)?.name || "—"
                    : (note.suppliers as any)?.name || "—"
                  }
                </p>
              </div>
              <Badge variant={note.status === "delivered" ? "default" : note.status === "cancelled" ? "destructive" : "secondary"}>
                {statusLabels[note.status]?.[isRTL ? "ar" : "en"] || note.status}
              </Badge>
              <span className="text-xs text-muted-foreground font-english">{note.delivery_date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeliveryNoteList;
