import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Building2, Briefcase, Calendar, Phone, Mail } from "lucide-react";

interface Props {
  employee: any;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: "نشط", cls: "bg-success/10 text-success" },
  on_leave: { label: "في إجازة", cls: "bg-warning/10 text-warning" },
  terminated: { label: "منتهي", cls: "bg-destructive/10 text-destructive" },
  probation: { label: "تحت التجربة", cls: "bg-info/10 text-info" },
};

const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) => {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <Icon size={16} className="text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
};

const EssProfileTab = ({ employee }: Props) => {
  const status = STATUS_MAP[employee.status] || { label: employee.status, cls: "bg-muted text-muted-foreground" };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Basic Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User size={18} className="text-primary" />
            البيانات الشخصية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <InfoRow icon={User} label="الاسم" value={`${employee.first_name} ${employee.last_name}`} />
          <InfoRow icon={User} label="رقم الموظف" value={employee.employee_number} />
          <InfoRow icon={Mail} label="البريد" value={employee.email} />
          <InfoRow icon={Phone} label="الهاتف" value={employee.phone} />
          <div className="flex items-center gap-3 py-2.5">
            <User size={16} className="text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground w-28 shrink-0">الحالة</span>
            <Badge className={status.cls}>{status.label}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Work Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase size={18} className="text-primary" />
            بيانات العمل
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <InfoRow icon={Building2} label="القسم" value={employee.org_departments?.name} />
          <InfoRow icon={Briefcase} label="المسمى الوظيفي" value={employee.org_positions?.title} />
          <InfoRow icon={Calendar} label="تاريخ التعيين" value={employee.hire_date} />
          <InfoRow icon={User} label="الجنسية" value={employee.nationality} />
          <InfoRow icon={User} label="الجنس" value={employee.gender === "male" ? "ذكر" : employee.gender === "female" ? "أنثى" : employee.gender} />
        </CardContent>
      </Card>
    </div>
  );
};

export default EssProfileTab;
