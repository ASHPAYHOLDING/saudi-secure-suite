import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileText, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const DOC_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  national_id: { ar: "الهوية الوطنية", en: "National ID" },
  national_id_or_iqama: { ar: "الهوية / الإقامة", en: "ID / Iqama" },
  passport: { ar: "جواز السفر", en: "Passport" },
  iqama: { ar: "الإقامة", en: "Iqama" },
  gosi_contract: { ar: "عقد التأمينات", en: "GOSI" },
  work_contract: { ar: "عقد العمل", en: "Work Contract" },
  medical_insurance: { ar: "التأمين الطبي", en: "Medical Insurance" },
  driving_license: { ar: "رخصة القيادة", en: "Driving License" },
  degree_certificate: { ar: "شهادة جامعية", en: "Degree" },
  training_certificate: { ar: "شهادة تدريب", en: "Training" },
  bank_letter: { ar: "خطاب البنك", en: "Bank Letter" },
  other: { ar: "أخرى", en: "Other" },
};

export default function ExpiringDocumentsWidget() {
  const { tenantId } = useAuth();
  const navigate = useNavigate();

  const { data: expiringDocs = [] } = useQuery({
    queryKey: ["hr-expiring-docs", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);
      const { data } = await supabase
        .from("employee_documents")
        .select("id, title, document_type, expiry_date, employee_id, employee:hr_employees!employee_id(first_name, last_name)")
        .eq("tenant_id", tenantId!)
        .not("expiry_date", "is", null)
        .neq("document_type", "gosi_contract")
        .lte("expiry_date", in30Days.toISOString().split("T")[0])
        .order("expiry_date", { ascending: true })
        .limit(8);
      return data ?? [];
    },
  });

  const expiredCount = expiringDocs.filter((d: any) => {
    const diff = Math.ceil((new Date(d.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff < 0;
  }).length;

  const warningCount = expiringDocs.length - expiredCount;

  if (expiringDocs.length === 0) return null;

  return (
    <Card className="border-border/50 border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <p className="text-xs font-bold text-foreground">مستندات تحتاج إجراء | Documents Need Action</p>
          </div>
          <div className="flex items-center gap-1.5">
            {expiredCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">{expiredCount} منتهي</Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">{warningCount} قريب</Badge>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {expiringDocs.map((doc: any) => {
            const diff = Math.ceil((new Date(doc.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const expired = diff < 0;
            const emp = doc.employee as any;
            const docLabel = DOC_TYPE_LABELS[doc.document_type]?.ar || doc.title;
            return (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-background/80 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/dashboard/hr/employees/${doc.employee_id}?tab=documents`)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{docLabel}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {emp?.first_name} {emp?.last_name}
                    </p>
                  </div>
                </div>
                <Badge variant={expired ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                  {expired ? "منتهي" : `${diff} يوم`}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
