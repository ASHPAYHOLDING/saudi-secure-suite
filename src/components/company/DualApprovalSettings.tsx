import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Save, Loader2, Banknote, Wallet, Receipt } from "lucide-react";
import { toast } from "sonner";

interface Threshold {
  entity_type: string;
  min_amount: number;
  roles_required: string[];
}

interface FinancialControls {
  require_dual_approval: boolean;
  thresholds: Threshold[];
}

const ENTITY_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  payment: { label: "الدفعات", icon: Banknote },
  wallet_transfer: { label: "تحويلات المحفظة", icon: Wallet },
  expense: { label: "المصروفات", icon: Receipt },
};

const DualApprovalSettings = () => {
  const { tenantId, userRole } = useAuth();
  const [controls, setControls] = useState<FinancialControls>({
    require_dual_approval: false,
    thresholds: [
      { entity_type: "payment", min_amount: 50000, roles_required: ["cfo", "finance_manager"] },
      { entity_type: "wallet_transfer", min_amount: 50000, roles_required: ["cfo", "finance_manager"] },
      { entity_type: "expense", min_amount: 50000, roles_required: ["cfo", "finance_manager"] },
    ],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenantId) fetchControls();
  }, [tenantId]);

  const fetchControls = async () => {
    const { data } = await (supabase as any)
      .from("tenant_settings")
      .select("financial_controls")
      .eq("tenant_id", tenantId!)
      .maybeSingle();

    if (data?.financial_controls) {
      setControls(data.financial_controls);
    }
    setLoading(false);
  };

  const saveControls = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("tenant_settings")
      .update({ financial_controls: controls, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId!);

    if (error) {
      toast.error("فشل الحفظ");
    } else {
      toast.success("تم حفظ الضوابط المالية");
    }
    setSaving(false);
  };

  const updateThreshold = (entityType: string, field: string, value: number | string[]) => {
    setControls(prev => ({
      ...prev,
      thresholds: prev.thresholds.map(t =>
        t.entity_type === entityType ? { ...t, [field]: value } : t
      ),
    }));
  };

  if (loading) return null;
  if (userRole !== "owner" && userRole !== "admin") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          الضوابط المالية — الموافقة المزدوجة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Master toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/30">
          <div>
            <p className="text-sm font-semibold text-foreground">تفعيل الموافقة المزدوجة</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              العمليات المالية فوق الحد المحدد تتطلب موافقة شخصين مختلفين
            </p>
          </div>
          <Switch
            checked={controls.require_dual_approval}
            onCheckedChange={(v) => setControls(prev => ({ ...prev, require_dual_approval: v }))}
          />
        </div>

        {controls.require_dual_approval && (
          <>
            <Separator />
            <div className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground">حدود المبالغ لكل نوع عملية</p>

              {controls.thresholds.map((threshold) => {
                const meta = ENTITY_LABELS[threshold.entity_type] || { label: threshold.entity_type, icon: Banknote };
                const Icon = meta.icon;
                return (
                  <div key={threshold.entity_type} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className="text-primary" />
                      <span className="text-sm font-semibold text-foreground">{meta.label}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">الحد الأدنى (ر.س)</Label>
                        <Input
                          type="number"
                          value={threshold.min_amount}
                          onChange={(e) => updateThreshold(threshold.entity_type, "min_amount", Number(e.target.value))}
                          className="h-9 text-sm font-english"
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">الأدوار المطلوبة</Label>
                        <Input
                          value={threshold.roles_required.join(", ")}
                          onChange={(e) => updateThreshold(
                            threshold.entity_type,
                            "roles_required",
                            e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                          )}
                          className="h-9 text-sm font-english"
                          dir="ltr"
                          placeholder="cfo, finance_manager"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button onClick={saveControls} disabled={saving} className="gap-1.5" size="sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            حفظ الضوابط
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DualApprovalSettings;
