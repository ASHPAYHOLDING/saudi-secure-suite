import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, Check, X, Loader2 } from "lucide-react";

interface DiscountResult {
  success: boolean;
  error?: string;
  code?: string;
  discount_type?: string;
  discount_value?: number;
  amount_before?: number;
  amount_after?: number;
  discount_amount?: number;
}

interface DiscountCodeInputProps {
  planId: string;
  originalPrice: number;
  onDiscountApplied?: (result: DiscountResult) => void;
}

const DiscountCodeInput = ({ planId, originalPrice, onDiscountApplied }: DiscountCodeInputProps) => {
  const { tenantId } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiscountResult | null>(null);

  const handleApply = async () => {
    if (!code.trim() || !tenantId || !planId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("apply_subscription_discount", {
        _code: code.trim(),
        _tenant_id: tenantId,
        _plan_id: planId,
      });

      if (error) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
        setResult({ success: false, error: error.message });
        setLoading(false);
        return;
      }

      const res = data as unknown as DiscountResult;
      setResult(res);

      if (res.success) {
        toast({ title: "تم تطبيق الخصم", description: `خصم ${res.discount_type === "percentage" ? res.discount_value + "%" : res.discount_amount + " ر.س"}` });
        onDiscountApplied?.(res);
      } else {
        toast({ title: "فشل", description: res.error || "كود غير صالح", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleReset = () => {
    setCode("");
    setResult(null);
    onDiscountApplied?.({ success: false });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Tag size={16} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground">كود خصم</span>
      </div>

      {result?.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-emerald-600" />
              <span className="text-sm font-bold text-emerald-700">تم تطبيق الخصم</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-6 px-2">
              <X size={14} />
            </Button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <Badge variant="outline" className="font-mono">{result.code}</Badge>
            <span className="text-emerald-700 font-bold">
              {result.discount_type === "percentage" ? `${result.discount_value}%` : `${result.discount_amount} ر.س`}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm border-t border-emerald-200 pt-2">
            <span className="text-muted-foreground line-through">{result.amount_before} ر.س</span>
            <span className="text-lg font-bold text-emerald-700">{result.amount_after} ر.س</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            placeholder="أدخل كود الخصم"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="font-mono flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
          />
          <Button onClick={handleApply} disabled={loading || !code.trim()} size="sm">
            {loading ? <Loader2 size={14} className="animate-spin" /> : "تحقق"}
          </Button>
        </div>
      )}

      {result && !result.success && result.error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <X size={12} />
          {result.error}
        </p>
      )}
    </div>
  );
};

export default DiscountCodeInput;
