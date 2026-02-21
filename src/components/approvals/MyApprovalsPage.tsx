import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, FileText, Receipt, Package, Loader2, MessageSquare, AlertTriangle, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { processStep, type WfInstanceStatus } from "@/lib/workflows/engine";
import { formatCurrency } from "@/lib/invoice-utils";
import SmartEmptyState from "@/components/ui/smart-empty-state";

interface PendingItem {
  instance_id: string;
  entity_id: string;
  entity_type: string;
  step_name: string;
  started_at: string;
  entity_label: string;
  entity_amount: number;
  due_at: string | null;
  sla_status: 'on_time' | 'warning' | 'late';
}

const entityTypeLabels: Record<string, { label: string; icon: any }> = {
  invoice: { label: "فاتورة", icon: FileText },
  expense: { label: "مصروف", icon: Receipt },
  purchase_order: { label: "أمر شراء", icon: Package },
};

const MyApprovalsPage = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [showComment, setShowComment] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    if (!tenantId || !user) return;
    setLoading(true);

    // Get all in_progress workflow instances for this tenant
    const { data: instances } = await (supabase as any)
      .from("workflow_instances")
      .select("id, entity_id, entity_type, current_step_order, started_at")
      .eq("tenant_id", tenantId)
      .eq("status", "in_progress");

    if (!instances || instances.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    // Enrich with entity details
    const enriched: PendingItem[] = [];

    for (const inst of instances) {
      // Get current step name and SLA info
      const { data: stepData } = await (supabase as any)
        .from("workflow_instance_steps")
        .select("step_id, due_at, sla_status")
        .eq("instance_id", inst.id)
        .eq("step_order", inst.current_step_order)
        .eq("status", "pending")
        .maybeSingle();

      if (!stepData) continue;

      // Recompute sla_status on the fly for accuracy
      let slaStatus: 'on_time' | 'warning' | 'late' = stepData.sla_status || 'on_time';
      if (stepData.due_at) {
        const dueAt = new Date(stepData.due_at);
        const now = new Date();
        if (dueAt < now) slaStatus = 'late';
        else if (dueAt.getTime() - now.getTime() < 24 * 60 * 60 * 1000) slaStatus = 'warning';
      }

      const { data: stepDef } = await (supabase as any)
        .from("workflow_steps")
        .select("name")
        .eq("id", stepData.step_id)
        .single();

      let entityLabel = "";
      let entityAmount = 0;

      if (inst.entity_type === "invoice") {
        const { data } = await supabase.from("invoices").select("invoice_number, grand_total").eq("id", inst.entity_id).single();
        if (data) { entityLabel = data.invoice_number; entityAmount = data.grand_total; }
      } else if (inst.entity_type === "expense") {
        const { data } = await supabase.from("expenses").select("expense_number, total_amount").eq("id", inst.entity_id).single();
        if (data) { entityLabel = data.expense_number; entityAmount = data.total_amount; }
      } else if (inst.entity_type === "purchase_order") {
        const { data } = await supabase.from("purchase_orders").select("order_number, grand_total").eq("id", inst.entity_id).single();
        if (data) { entityLabel = data.order_number; entityAmount = data.grand_total; }
      }

      enriched.push({
        instance_id: inst.id,
        entity_id: inst.entity_id,
        entity_type: inst.entity_type,
        step_name: stepDef?.name || "موافقة",
        started_at: inst.started_at,
        entity_label: entityLabel,
        entity_amount: entityAmount,
        due_at: stepData.due_at,
        sla_status: slaStatus,
      });
    }

    setItems(enriched);
    setLoading(false);
  }, [tenantId, user]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleAction = async (instanceId: string, action: "approved" | "rejected") => {
    if (!user) return;
    setProcessing(instanceId);
    const comment = commentMap[instanceId] || undefined;
    const result = await processStep(instanceId, user.id, action, comment);

    if ("error" in result) {
      toast({ title: "خطأ", description: result.error, variant: "destructive" });
    } else {
      // Update entity status based on workflow result
      const item = items.find(i => i.instance_id === instanceId);
      if (item) {
        const newStatus: string = result.status === "approved" ? "approved" : result.status === "rejected" ? "rejected" : "pending_approval";
        const table = item.entity_type === "invoice" ? "invoices" : item.entity_type === "expense" ? "expenses" : "purchase_orders";
        
        if (result.status === "approved") {
          // For invoices, approved means "issued"
          const finalStatus = item.entity_type === "invoice" ? "issued" : "approved";
          await (supabase as any).from(table).update({ status: finalStatus }).eq("id", item.entity_id);
        } else if (result.status === "rejected") {
          await (supabase as any).from(table).update({ status: "rejected" }).eq("id", item.entity_id);
        }
      }

      toast({ title: action === "approved" ? "تمت الموافقة" : "تم الرفض" });
      fetchPending();
    }
    setProcessing(null);
  };

  return (
    <div dir="rtl" className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">موافقاتي</h1>
        <p className="text-sm text-muted-foreground mt-1">المستندات التي تحتاج موافقتك</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "بانتظار الموافقة", value: items.length, icon: Clock, color: "text-amber-600" },
          { label: "متأخرة", value: items.filter(i => i.sla_status === "late").length, icon: AlertTriangle, color: "text-destructive" },
          { label: "تنتهي قريباً", value: items.filter(i => i.sla_status === "warning").length, icon: Timer, color: "text-amber-500" },
        ].map((stat) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                <stat.icon size={20} className={stat.color} />
              </div>
              <div>
                <p className={`text-2xl font-bold font-english ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
      ) : items.length === 0 ? (
        <SmartEmptyState
          icon={CheckCircle2}
          title="لا توجد موافقات معلقة"
          description="جميع المستندات تمت مراجعتها"
          tips={["ستظهر هنا أي فاتورة أو مصروف أو أمر شراء يحتاج موافقتك"]}
        />
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => {
            const entityDef = entityTypeLabels[item.entity_type] || { label: item.entity_type, icon: FileText };
            const Icon = entityDef.icon;
            return (
              <motion.div
                key={item.instance_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-xl border border-border bg-card p-5 shadow-card"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                     <div className="flex items-center gap-4">
                     <div className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${
                       item.sla_status === 'late' ? 'bg-destructive/10' : item.sla_status === 'warning' ? 'bg-amber-50' : 'bg-amber-50'
                     }`}>
                       <Icon size={22} className={
                         item.sla_status === 'late' ? 'text-destructive' : 'text-amber-600'
                       } />
                     </div>
                     <div>
                       <div className="flex items-center gap-2 mb-1">
                         <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                           {entityDef.label}
                         </Badge>
                         {item.sla_status === 'late' && (
                           <Badge variant="destructive" className="text-[10px] gap-0.5">
                             <AlertTriangle size={10} />
                             متأخر
                           </Badge>
                         )}
                         {item.sla_status === 'warning' && (
                           <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] gap-0.5">
                             <Timer size={10} />
                             ينتهي قريباً
                           </Badge>
                         )}
                         <span className="font-english font-semibold text-foreground">{item.entity_label}</span>
                       </div>
                       <p className="text-xs text-muted-foreground">
                         الخطوة: <span className="text-foreground font-medium">{item.step_name}</span>
                       </p>
                       <div className="flex items-center gap-3 mt-1">
                         <p className="text-lg font-bold font-english text-foreground" dir="ltr">
                           {formatCurrency(item.entity_amount)} <span className="text-xs font-normal text-muted-foreground">ر.س</span>
                         </p>
                         {item.due_at && (
                           <p className={`text-[11px] flex items-center gap-1 ${
                             item.sla_status === 'late' ? 'text-destructive font-medium' : 'text-muted-foreground'
                           }`}>
                             <Clock size={11} />
                             {new Date(item.due_at).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                           </p>
                         )}
                       </div>
                     </div>
                   </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowComment(showComment === item.instance_id ? null : item.instance_id)}
                      className="gap-1 text-muted-foreground"
                    >
                      <MessageSquare size={14} />
                      تعليق
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(item.instance_id, "rejected")}
                      disabled={processing === item.instance_id}
                      className="gap-1 text-destructive hover:bg-destructive/10 border-destructive/30"
                    >
                      <XCircle size={14} />
                      رفض
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAction(item.instance_id, "approved")}
                      disabled={processing === item.instance_id}
                      className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {processing === item.instance_id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      موافقة
                    </Button>
                  </div>
                </div>

                {showComment === item.instance_id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <Textarea
                      value={commentMap[item.instance_id] || ""}
                      onChange={(e) => setCommentMap(prev => ({ ...prev, [item.instance_id]: e.target.value }))}
                      placeholder="أضف تعليقاً (اختياري)..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyApprovalsPage;
