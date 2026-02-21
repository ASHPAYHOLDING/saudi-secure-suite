import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, FileText, Receipt, Package, Loader2, MessageSquare } from "lucide-react";
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
      // Get current step name
      const { data: stepData } = await (supabase as any)
        .from("workflow_instance_steps")
        .select("step_id")
        .eq("instance_id", inst.id)
        .eq("step_order", inst.current_step_order)
        .eq("status", "pending")
        .maybeSingle();

      if (!stepData) continue;

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
          { label: "فواتير معلقة", value: items.filter(i => i.entity_type === "invoice").length, icon: FileText, color: "text-info" },
          { label: "مصروفات معلقة", value: items.filter(i => i.entity_type === "expense").length, icon: Receipt, color: "text-accent" },
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 shrink-0">
                      <Icon size={22} className="text-amber-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                          {entityDef.label}
                        </Badge>
                        <span className="font-english font-semibold text-foreground">{item.entity_label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        الخطوة: <span className="text-foreground font-medium">{item.step_name}</span>
                      </p>
                      <p className="text-lg font-bold font-english text-foreground mt-1" dir="ltr">
                        {formatCurrency(item.entity_amount)} <span className="text-xs font-normal text-muted-foreground">ر.س</span>
                      </p>
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
