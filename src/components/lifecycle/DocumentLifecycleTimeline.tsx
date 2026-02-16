import { useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";

interface Props {
  documentType: string;
  documentId: string;
}

const statusTranslations: Record<string, string> = {
  draft: "مسودة",
  pending: "قيد الانتظار",
  pending_approval: "بانتظار الموافقة",
  approved: "موافق عليه",
  confirmed: "مؤكد",
  rejected: "مرفوض",
  cancelled: "ملغى",
  delivered: "تم التسليم",
  fulfilled: "مكتمل",
  posted: "مُرحّل",
  voided: "ملغى",
  signed: "موقّع",
  partially_fulfilled: "مكتمل جزئياً",
};

const DocumentLifecycleTimeline = ({ documentType, documentId }: Props) => {
  const { tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId || !documentId) return;
    supabase
      .from("document_lifecycle")
      .select("*")
      .eq("document_type", documentType)
      .eq("document_id", documentId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setEvents(data || []);
        setLoading(false);
      });
  }, [tenantId, documentId, documentType]);

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock size={16} />
          {isRTL ? "دورة حياة المستند" : "Document Lifecycle"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {isRTL ? "لم يتم تسجيل أي تغييرات بعد" : "No lifecycle events yet"}
          </p>
        ) : (
          <div className="relative space-y-4">
            {/* Vertical line */}
            <div className="absolute start-[7px] top-2 bottom-2 w-px bg-border" />
            {events.map((event, idx) => (
              <div key={event.id} className="flex items-start gap-3 relative">
                <div className="mt-1.5 h-[14px] w-[14px] rounded-full border-2 border-primary bg-background z-10 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {event.from_status && (
                      <>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                          {isRTL ? (statusTranslations[event.from_status] || event.from_status) : event.from_status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">→</span>
                      </>
                    )}
                    <Badge variant="default" className="text-[9px] px-1.5 py-0">
                      {isRTL ? (statusTranslations[event.to_status] || event.to_status) : event.to_status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 font-english" dir="ltr">
                    {new Date(event.created_at).toLocaleString(isRTL ? "ar-SA" : "en-US")}
                  </p>
                  {event.change_reason && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{event.change_reason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentLifecycleTimeline;
