import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Check, Truck, X, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";
import DocumentLifecycleTimeline from "@/components/lifecycle/DocumentLifecycleTimeline";

interface Props {
  noteId: string | null;
  onBack: () => void;
}

const statusLabels: Record<string, { ar: string; en: string }> = {
  draft: { ar: "مسودة", en: "Draft" },
  confirmed: { ar: "مؤكد", en: "Confirmed" },
  delivered: { ar: "تم التسليم", en: "Delivered" },
  cancelled: { ar: "ملغى", en: "Cancelled" },
};

const DeliveryNotePreview = ({ noteId, onBack }: Props) => {
  const { tenantId, user } = useAuth();
  const { isRTL } = useLanguage();
  const [note, setNote] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    if (!noteId) return;
    const [nRes, iRes] = await Promise.all([
      supabase.from("delivery_notes").select("*, customers(name), suppliers(name)").eq("id", noteId).single(),
      supabase.from("delivery_note_items").select("*").eq("delivery_note_id", noteId).order("sort_order"),
    ]);
    setNote(nRes.data);
    setItems(iRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [noteId]);

  const updateStatus = async (status: string) => {
    if (!noteId || !tenantId || !user) return;
    setActionLoading(true);

    // Log lifecycle
    await supabase.from("document_lifecycle").insert({
      tenant_id: tenantId,
      document_type: "delivery_note",
      document_id: noteId,
      from_status: note.status,
      to_status: status,
      changed_by: user.id,
    });

    const { error } = await supabase.from("delivery_notes").update({ status }).eq("id", noteId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? "تم تحديث الحالة" : "Status updated");
      load();
    }
    setActionLoading(false);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!note) return (
    <div dir={isRTL ? "rtl" : "ltr"} className="p-6">
      <Button variant="ghost" onClick={onBack}>{isRTL ? "العودة" : "Back"}</Button>
      <p className="text-center text-muted-foreground py-16">{isRTL ? "لم يتم العثور على الإشعار" : "Not found"}</p>
    </div>
  );

  const party = note.note_type === "outbound" ? (note.customers as any)?.name : (note.suppliers as any)?.name;

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack}><ArrowRight size={18} /></Button>
          <div>
            <h1 className="text-xl font-bold font-english">{note.note_number}</h1>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="text-[10px]">
                {note.note_type === "outbound" ? (isRTL ? "صادر" : "Outbound") : (isRTL ? "وارد" : "Inbound")}
              </Badge>
              <Badge variant={note.status === "delivered" ? "default" : note.status === "cancelled" ? "destructive" : "secondary"}>
                {statusLabels[note.status]?.[isRTL ? "ar" : "en"] || note.status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {note.status === "draft" && (
            <>
              <Button size="sm" onClick={() => updateStatus("confirmed")} disabled={actionLoading} className="gap-1">
                <Check size={14} /> {isRTL ? "تأكيد" : "Confirm"}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => updateStatus("cancelled")} disabled={actionLoading} className="gap-1">
                <X size={14} /> {isRTL ? "إلغاء" : "Cancel"}
              </Button>
            </>
          )}
          {note.status === "confirmed" && (
            <Button size="sm" onClick={() => updateStatus("delivered")} disabled={actionLoading} className="gap-1">
              <Truck size={14} /> {isRTL ? "تم التسليم" : "Mark Delivered"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Details */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm"><Truck size={16} />{isRTL ? "تفاصيل الإشعار" : "Note Details"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{note.note_type === "outbound" ? (isRTL ? "العميل" : "Customer") : (isRTL ? "المورد" : "Supplier")}</p>
                    <p className="font-medium">{party || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{isRTL ? "تاريخ التسليم" : "Delivery Date"}</p>
                    <p className="font-medium font-english">{note.delivery_date}</p>
                  </div>
                  {note.source_type && (
                    <div>
                      <p className="text-xs text-muted-foreground">{isRTL ? "المستند المصدر" : "Source Document"}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {note.source_type === "sales_order" ? (isRTL ? "أمر بيع" : "Sales Order") : (isRTL ? "أمر شراء" : "Purchase Order")}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Items */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{isRTL ? "البنود" : "Items"}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2 text-start text-xs font-semibold text-muted-foreground">#</th>
                      <th className="px-4 py-2 text-start text-xs font-semibold text-muted-foreground">{isRTL ? "الوصف" : "Description"}</th>
                      <th className="px-4 py-2 text-start text-xs font-semibold text-muted-foreground">{isRTL ? "الكمية" : "Qty"}</th>
                      <th className="px-4 py-2 text-start text-xs font-semibold text-muted-foreground">{isRTL ? "الوحدة" : "Unit"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id} className="border-b border-border/50">
                        <td className="px-4 py-2 text-muted-foreground font-english">{idx + 1}</td>
                        <td className="px-4 py-2">{item.description}</td>
                        <td className="px-4 py-2 font-english">{item.quantity}</td>
                        <td className="px-4 py-2">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </motion.div>

          {note.notes && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-1">{isRTL ? "ملاحظات" : "Notes"}</p>
                <p className="text-sm text-muted-foreground">{note.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Lifecycle Sidebar */}
        <div>
          <DocumentLifecycleTimeline documentType="delivery_note" documentId={noteId!} />
        </div>
      </div>
    </div>
  );
};

export default DeliveryNotePreview;
