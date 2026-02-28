import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, CreditCard, Shield, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STATUS_DISPLAY: Record<string, { label: string; labelEn: string; icon: any; color: string }> = {
  created: { label: "في انتظار الدفع", labelEn: "Awaiting Payment", icon: Clock, color: "text-info" },
  paid: { label: "تم الدفع بنجاح", labelEn: "Paid Successfully", icon: CheckCircle2, color: "text-success" },
  expired: { label: "انتهت صلاحية الرابط", labelEn: "Link Expired", icon: XCircle, color: "text-muted-foreground" },
  canceled: { label: "تم إلغاء الرابط", labelEn: "Link Canceled", icon: Ban, color: "text-destructive" },
};

interface PublicPaymentInfo {
  amount: number;
  currency: string;
  description: string;
  status: string;
  expires_at: string | null;
  customer_name: string | null;
  tenant_name: string | null;
}

const PublicPaymentPage = () => {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<PublicPaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInfo = async () => {
      if (!token) { setError("رابط غير صالح"); setLoading(false); return; }
      try {
        const { data, error: fnError } = await supabase.functions.invoke("payment-link-public", {
          body: { token },
        });
        if (fnError || !data?.success) {
          setError(data?.error || "رابط غير صالح أو منتهي الصلاحية");
        } else {
          setInfo(data.payment as PublicPaymentInfo);
        }
      } catch {
        setError("حدث خطأ في تحميل بيانات الدفع");
      }
      setLoading(false);
    };
    fetchInfo();
  }, [token]);

  const formatCurrency = (n: number, c: string) =>
    n.toLocaleString("ar-SA", { minimumFractionDigits: 2 }) + (c === "SAR" ? " ر.س" : ` ${c}`);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-4">
            <XCircle className="w-16 h-16 mx-auto text-destructive/60" />
            <h2 className="text-lg font-bold text-foreground">رابط غير صالح</h2>
            <p className="text-sm text-muted-foreground">{error || "لم يتم العثور على رابط الدفع المطلوب."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const st = STATUS_DISPLAY[info.status] || STATUS_DISPLAY.created;
  const isPayable = info.status === "created";
  const isExpired = info.expires_at && new Date(info.expires_at) < new Date();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4" dir="rtl">
      <div className="max-w-md w-full space-y-4">
        {/* Merchant badge */}
        {info.tenant_name && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">دفع إلى</p>
            <p className="text-sm font-semibold text-foreground">{info.tenant_name}</p>
          </div>
        )}

        <Card className="border-border/60 shadow-lg">
          <CardContent className="py-8 space-y-6">
            {/* Amount */}
            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground">المبلغ المطلوب</p>
              <p className="text-4xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">
                {formatCurrency(info.amount, info.currency)}
              </p>
            </div>

            {/* Description */}
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-sm text-foreground">{info.description}</p>
            </div>

            {/* Customer */}
            {info.customer_name && (
              <p className="text-xs text-muted-foreground text-center">
                العميل: <span className="font-medium text-foreground">{info.customer_name}</span>
              </p>
            )}

            {/* Status */}
            <div className="flex justify-center">
              <Badge variant="outline" className={`gap-1.5 px-4 py-1.5 text-sm ${st.color}`}>
                <st.icon className="w-4 h-4" /> {st.label}
              </Badge>
            </div>

            {/* Pay Button */}
            {isPayable && !isExpired && (
              <Button size="lg" className="w-full gap-2 h-12 text-base" disabled>
                <CreditCard className="w-5 h-5" /> ادفع الآن
              </Button>
            )}

            {isExpired && info.status === "created" && (
              <p className="text-center text-xs text-destructive">انتهت صلاحية رابط الدفع</p>
            )}

            {/* Expiry */}
            {info.expires_at && info.status === "created" && !isExpired && (
              <p className="text-center text-xs text-muted-foreground">
                صالح حتى: {new Date(info.expires_at).toLocaleDateString("ar-SA")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Security footer */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5" />
          <span>مدفوعات آمنة بواسطة نيوماكسيو</span>
        </div>
      </div>
    </div>
  );
};

export default PublicPaymentPage;
