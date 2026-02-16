import { useState, useEffect } from "react";
import { ArrowRight, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";

interface Props {
  sourceType?: string;
  sourceId?: string;
  onBack: () => void;
  onSaved: (id: string) => void;
}

const generateNoteNumber = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const r = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
  return `DN-${y}${m}-${r}`;
};

interface DNItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  product_id?: string;
}

const emptyItem = (): DNItem => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unit: "وحدة",
});

const DeliveryNoteCreate = ({ sourceType, sourceId, onBack, onSaved }: Props) => {
  const { tenantId, user } = useAuth();
  const { isRTL } = useLanguage();
  const [noteNumber] = useState(generateNoteNumber);
  const [noteType, setNoteType] = useState<string>(sourceType === "purchase_order" ? "inbound" : "outbound");
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DNItem[]>([emptyItem()]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      supabase.from("customers").select("id, name").eq("tenant_id", tenantId).eq("is_active", true),
      supabase.from("suppliers").select("id, name").eq("tenant_id", tenantId).eq("is_active", true),
    ]).then(([cRes, sRes]) => {
      setCustomers(cRes.data || []);
      setSuppliers(sRes.data || []);
    });
  }, [tenantId]);

  // Load source items
  useEffect(() => {
    if (!sourceId || !sourceType) return;
    const loadSource = async () => {
      if (sourceType === "sales_order") {
        const [oRes, iRes] = await Promise.all([
          supabase.from("sales_orders").select("customer_id").eq("id", sourceId).single(),
          supabase.from("sales_order_items").select("description, quantity, unit, product_id").eq("sales_order_id", sourceId).order("sort_order"),
        ]);
        if (oRes.data) setCustomerId(oRes.data.customer_id || "");
        if (iRes.data) setItems(iRes.data.map((i) => ({ ...i, id: crypto.randomUUID() })));
      } else if (sourceType === "purchase_order") {
        const [oRes, iRes] = await Promise.all([
          supabase.from("purchase_orders").select("supplier_id").eq("id", sourceId).single(),
          supabase.from("purchase_order_items").select("description, quantity, unit, product_id").eq("purchase_order_id", sourceId).order("sort_order"),
        ]);
        if (oRes.data) setSupplierId(oRes.data.supplier_id || "");
        if (iRes.data) setItems(iRes.data.map((i) => ({ ...i, id: crypto.randomUUID() })));
      }
    };
    loadSource();
  }, [sourceId, sourceType]);

  const updateItem = (id: string, field: keyof DNItem, value: any) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const handleSave = async () => {
    if (!tenantId || !user) return;
    if (noteType === "outbound" && !customerId) {
      toast.error(isRTL ? "الرجاء اختيار العميل" : "Please select a customer");
      return;
    }
    if (noteType === "inbound" && !supplierId) {
      toast.error(isRTL ? "الرجاء اختيار المورد" : "Please select a supplier");
      return;
    }
    if (items.every((i) => !i.description.trim())) {
      toast.error(isRTL ? "الرجاء إضافة بند واحد على الأقل" : "Add at least one item");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.from("delivery_notes").insert({
      tenant_id: tenantId,
      note_number: noteNumber,
      note_type: noteType,
      source_type: sourceType || null,
      source_id: sourceId || null,
      customer_id: noteType === "outbound" ? customerId : null,
      supplier_id: noteType === "inbound" ? supplierId : null,
      delivery_date: deliveryDate,
      notes: notes || null,
      created_by: user.id,
      status: "draft",
    }).select("id").single();

    if (error || !data) {
      toast.error(error?.message || "Error");
      setSaving(false);
      return;
    }

    const dnItems = items
      .filter((i) => i.description.trim())
      .map((i, idx) => ({
        delivery_note_id: data.id,
        tenant_id: tenantId,
        product_id: i.product_id || null,
        description: i.description,
        quantity: i.quantity,
        unit: i.unit,
        sort_order: idx,
      }));

    if (dnItems.length > 0) {
      await supabase.from("delivery_note_items").insert(dnItems);
    }

    // Update source document reference
    if (sourceType === "sales_order" && sourceId) {
      await supabase.from("sales_orders").update({ converted_delivery_note_id: data.id }).eq("id", sourceId);
    } else if (sourceType === "purchase_order" && sourceId) {
      await supabase.from("purchase_orders").update({ converted_grn_id: data.id }).eq("id", sourceId);
    }

    toast.success(isRTL ? "تم إنشاء إشعار التسليم" : "Delivery note created");
    setSaving(false);
    onSaved(data.id);
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack}><ArrowRight size={18} /></Button>
          <div>
            <h1 className="text-xl font-bold">{isRTL ? "إشعار تسليم جديد" : "New Delivery Note"}</h1>
            <p className="text-sm text-muted-foreground font-english">{noteNumber}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isRTL ? "حفظ" : "Save"}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{isRTL ? "النوع" : "Type"}</label>
            <Select value={noteType} onValueChange={setNoteType} disabled={!!sourceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="outbound">{isRTL ? "إشعار تسليم صادر" : "Outbound Delivery Note"}</SelectItem>
                <SelectItem value="inbound">{isRTL ? "إشعار استلام وارد (GRN)" : "Inbound Goods Receipt (GRN)"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{isRTL ? "تاريخ التسليم" : "Delivery Date"}</label>
            <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} dir="ltr" />
          </div>
        </div>

        {noteType === "outbound" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{isRTL ? "العميل" : "Customer"}</label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder={isRTL ? "اختر العميل" : "Select customer"} /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {noteType === "inbound" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{isRTL ? "المورد" : "Supplier"}</label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder={isRTL ? "اختر المورد" : "Select supplier"} /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">{isRTL ? "البنود" : "Items"}</h3>
          <Button size="sm" variant="outline" onClick={() => setItems([...items, emptyItem()])} className="gap-1">
            <Plus size={14} /> {isRTL ? "إضافة" : "Add"}
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2 text-start text-xs font-semibold text-muted-foreground">#</th>
              <th className="px-4 py-2 text-start text-xs font-semibold text-muted-foreground">{isRTL ? "الوصف" : "Description"}</th>
              <th className="px-4 py-2 text-start text-xs font-semibold text-muted-foreground w-24">{isRTL ? "الكمية" : "Qty"}</th>
              <th className="px-4 py-2 text-start text-xs font-semibold text-muted-foreground w-24">{isRTL ? "الوحدة" : "Unit"}</th>
              <th className="px-4 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} className="border-b border-border/50">
                <td className="px-4 py-2 text-muted-foreground font-english">{idx + 1}</td>
                <td className="px-4 py-2">
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                    placeholder={isRTL ? "وصف البند" : "Item description"}
                    className="h-8"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                    className="h-8"
                    dir="ltr"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    value={item.unit}
                    onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                    className="h-8"
                  />
                </td>
                <td className="px-4 py-2">
                  {items.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setItems(items.filter((i) => i.id !== item.id))}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{isRTL ? "ملاحظات" : "Notes"}</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>
    </div>
  );
};

export default DeliveryNoteCreate;
